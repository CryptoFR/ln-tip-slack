// app/slacktip.js

const debug = require('debug')('lncliweb:slacktip');
const logger = require('winston');
const Promise = require('promise');
const request = require('request');

// TODO
module.exports = function (lightning, lnd, db, server, slackConfig) {
  const module = {};

  const tippingServerUrl = server.getURL();
  debug('tipping server url', tippingServerUrl);

  const accountsCol = db.collection('slacktip-accounts');
  accountsCol.createIndex({ slackid: 1 }, { unique: true });
  const invoicesCol = db.collection('slacktip-invoices');
  const paymentsCol = db.collection('slacktip-payments');
  const transactionsCol = db.collection('slacktip-transactions');

  const txprocessor = require('./txprocessor')(db, accountsCol, transactionsCol);

  const lntipCommandSyntaxHelp = '*Syntax*:\n`/lntip <amount in satoshis> @<valid Slack nick>`, ex: `/lntip 10000 @satoshi`.\n`/lntip balance` will display your current tipping account balance.\n`/lntip history` _(not available yet)_.\n`/lntip help` will display information about lntip command usage.';

  let invoiceListener = null;

  // register the lnd invoices listener
  const registerLndInvoiceListener = function () {
    invoiceListener = {
      dataReceived(data) {
        debug('Slacktip: invoice data received', data);
        try {
          const settleIndex = data.settle_index;
          debug('Slacktip: invoice settle index', settleIndex);
          if (settleIndex > 0) {
            const memo = parseInvoiceMemo(data.memo);
            debug('Slacktip: invoice memo', memo);
            if (memo) {
              paymentsCol.insert([{ data }], { w: 1 }, (err, result) => {
                logger.debug('Invoice data received DB insert:', result);
              });
              const slackId = buildSlackId(memo.identity);
              module.dbGetUser(slackId).then((user) => {
                debug('dbGetUser', user);
                const value = Math.trunc(parseInt(data.amt_paid) / 1000);
                if (user) {
                  const update = { $inc: { balance: value } };
                  module.dbUpdateUser(slackId, update).then((response) => {
                    debug('dbUpdateUser', response);
                  }, (err) => {
                    debug('dbUpdateUser error', err);
                  });
                } else {
                  module.dbCreateUser(slackId, memo.identity, value).then((createdUsers) => {
                    if (createdUsers.length >= 1) {
                      debug(createdUsers[0]);
                    } else {
                      debug('Something went wrong');
                    }
                  }, (err) => {
                    debug('dbCreateUser error', err);
                  });
                }
              }, (err) => {
                debug('dbGetUser error', err);
              });
            }
          }
        } catch (err) {
          logger.warn(err);
        }
      },
    };
    lnd.registerInvoiceListener(invoiceListener);
  };

  registerLndInvoiceListener();

  module.getUser = function (identity) {
    const promise = new Promise(((resolve, reject) => {
      const slackId = buildSlackId(identity);
      module.dbGetUser(slackId).then((user) => {
        debug('dbGetUser', user);
        if (user) {
          if (identity.user.name && (identity.user.name != user.identity.user.name)) {
            user.identity.user.name = identity.user.name;
            const update = { $set: user };
            module.dbUpdateUser(slackId, update).then((result) => {
              resolve(user);
            }, (err) => {
              debug(err);
              resolve(user);
            });
          } else {
            resolve(user);
          }
        } else {
          delete identity.ok;
          module.dbCreateUser(slackId, identity, 0).then((createdUsers) => {
            if (createdUsers.length >= 1) {
              resolve(createdUsers[0]);
            } else {
              reject({ message: 'Something went wrong' });
            }
          }, (err) => {
            reject(err);
          });
        }
      }, (err) => {
        debug('dbGetUser error', err);
        reject(err);
      });
    }));
    return promise;
  };

  module.getSlackUserIdentity = function (accessToken) {
    const promise = new Promise(((resolve, reject) => {
      request.post({ url: 'https://slack.com/api/users.identity', form: { token: accessToken } }, (err, httpResponse, body) => {
        if (err) {
          logger.debug('getSlackUserIdentity Error:', err);
          err.error = err.message;
          reject(err);
        } else {
          debug(httpResponse.body);
          const identity = JSON.parse(httpResponse.body);
          module.getUser(identity).then((user) => {
            resolve(user);
          }, (err) => {
            debug('getUser error', err);
            reject(err);
          });
        }
      });
    }));
    return promise;
  };

  // Requires the users:read scope for the app, we shouldn"t use it
  module.getSlackUserInfo = function (userId) {
    const promise = new Promise(((resolve, reject) => {
      request.post({ url: 'https://slack.com/api/users.info', form: { token: slackConfig.accessToken, user: userId } }, (err, httpResponse, body) => {
        if (err) {
          logger.debug('getSlackUserInfo Error:', err);
          err.error = err.message;
          reject(err);
        } else {
          debug(httpResponse.body);
          const profile = JSON.parse(httpResponse.body);
          resolve(profile);
        }
      });
    }));
    return promise;
  };

  const processTip = function (sourceIdentity, targetIdentity, tipAmount, resolve, reject) {
    const sourceSlackId = buildSlackId(sourceIdentity);
    const targetSlackId = buildSlackId(targetIdentity);
    if (sourceSlackId == targetSlackId) {
      resolve({
        response_type: 'ephemeral',
        text: "You can't send a tip to yourself, sorry.",
      });
    } else {
      module.dbGetUser(sourceSlackId).then((sourceUser) => {
        debug('dbGetUser', sourceUser);
        if (sourceUser) {
          if (sourceUser.balance >= tipAmount) {
            module.dbGetUser(targetSlackId).then((targetUser) => {
              debug('targetUser', targetUser);
              const tipResponse = {
                response_type: 'in_channel',
                text: `A tip of ${tipAmount} satoshi${(tipAmount > 1) ? 's' : ''} has been delivered to @${targetIdentity.user.nick}`,
                attachments: [
                  {
                    text: `Thanx for supporting the <${tippingServerUrl}|Slack LN tipping bot>!`,
                  },
                ],
              };
              if (targetUser) {
                txprocessor.dbExecuteTransaction(sourceSlackId, targetSlackId, tipAmount).then(
                  (result) => {
                    debug(result);
                    resolve(tipResponse);
                  }, (reason) => {
                    debug(reason);
                    resolve(buildInvalidTipResponse(reason));
                  },
                );
              } else {
                module.dbCreateUser(targetSlackId, targetIdentity, 0).then((result) => {
                  // TODO check result
                  txprocessor.dbExecuteTransaction(sourceSlackId, targetSlackId, tipAmount).then(
                    (result) => {
                      debug(result);
                      resolve(tipResponse);
                    }, (reason) => {
                      debug(reason);
                      resolve(buildInvalidTipResponse(reason));
                    },
                  );
                }, (err) => {
                  debug(err);
                  resolve(buildInvalidTipResponse(err));
                });
              }
            }, (err) => {
              debug(err);
              resolve(buildInvalidTipResponse(err));
            });
          } else {
            resolve({
              response_type: 'ephemeral',
              text: "Couldn't send tip, there are not enough funds available in your account.",
              attachments: [
                {
                  text: `You only have ${sourceUser.balance} satoshi${(sourceUser.balance > 1) ? 's' : ''} left in your tipping account.`,
                },
                {
                  text: `You can deposit some funds by connecting to the <${tippingServerUrl}|LN tip website>.`,
                },
              ],
            });
          }
        } else {
          module.dbCreateUser(sourceSlackId, sourceIdentity, 0).then((createdUsers) => {
            resolve({
              response_type: 'ephemeral',
              text: "Couldn't send tip, you need to deposit some funds in your account first.",
              attachments: [
                {
                  text: `You can deposit some funds by connecting to the <${tippingServerUrl}|LN tip website>.`,
                },
              ],
            });
          }, (err) => {
            debug(err);
            resolve(buildInvalidTipResponse(err));
          });
        }
      }, (err) => {
        debug(err);
        resolve(buildInvalidTipResponse(err));
      });
    }
  };

  const processSubcommand = function (sourceIdentity, subcommand, resolve, reject) {
    const sourceSlackId = buildSlackId(sourceIdentity);
    module.dbGetUser(sourceSlackId).then((sourceUser) => {
      debug('dbGetUser', sourceUser);
      if (subcommand === 'balance') {
        resolve({
          response_type: 'ephemeral',
          text: `You have ${sourceUser.balance} satoshi${(sourceUser.balance > 1) ? 's' : ''} in your tipping account.`,
          attachments: [
            {
              text: `You can deposit some funds by connecting to the <${tippingServerUrl}|LN tip website>.`,
            },
          ],
        });
      } else if (subcommand === 'help') {
        resolve(buildHelpResponse());
      } else if (subcommand === 'history') {
        resolve(buildHistoryResponse());
      } else {
        resolve({
          response_type: 'ephemeral',
          text: `Unknown '${subcommand}' subcommand, should be 'balance', 'help' or 'history' (soon).`,
        });
      }
    }, (reason) => {
      debug(reason);
      resolve(buildInvalidTipResponse(reason));
    });
  };

  module.lntipCommand = function (tipRequest) {
    const promise = new Promise(((resolve, reject) => {
      if (tipRequest.token === slackConfig.verificationToken) {
        try {
          // var re = /(\d*)\s+\<@(\w*)\|(\w*)\>.*/;
          const re = /(?:(\d*)\s+<@(\w*)\|([a-z0-9][a-z0-9._-]*)\>|(balance|history|help)).*/;
          const array = tipRequest.text.match(re);
          debug(array);
          if (array && (array.length >= 5)) {
            const sourceIdentity = { user: { id: tipRequest.user_id }, team: { id: tipRequest.team_id } };
            if (array[1]) {
              const targetIdentity = { user: { id: array[2], nick: array[3] }, team: { id: tipRequest.team_id } };
              const tipAmount = parseInt(array[1]);
              processTip(sourceIdentity, targetIdentity, tipAmount, resolve, reject);
            } else if (array[4]) {
              const subcommand = array[4];
              processSubcommand(sourceIdentity, subcommand, resolve, reject);
            } else {
              resolve(buildInvalidTipResponse());
            }
          } else {
            resolve(buildInvalidTipResponse());
          }
        } catch (err) {
          debug(err);
          resolve(buildInvalidTipResponse(err));
        }
      } else {
        resolve({
          response_type: 'ephemeral',
          text: 'Sorry, we detected an invalid Slack app token. Please contact your administrator.',
        });
      }
    }));
    return promise;
  };

  var buildInvalidTipResponse = function (err) {
    const response = {
      response_type: 'ephemeral',
      text: `We did not understand your tipping request, could you try again please?\n${lntipCommandSyntaxHelp}`,
      attachments: [
        {
          text: `Thanx for supporting the <${tippingServerUrl}|Slack LN tipping bot>!`,
        },
      ],
    };
    if (err) {
      response.attachments.push(
        {
          text: `error: ${err}`,
        },
      );
    }
    return response;
  };

  var buildHelpResponse = function () {
    const response = {
      response_type: 'ephemeral',
      text: lntipCommandSyntaxHelp,
      attachments: [
        {
          text: `Thanx for supporting the <${tippingServerUrl}|Slack LN tipping bot>!`,
        },
      ],
    };
    return response;
  };

  var buildHistoryResponse = function () {
    const response = {
      response_type: 'ephemeral',
      text: 'The `history` command is not implemented yet.',
      attachments: [
        {
          text: `Thanx for supporting the <${tippingServerUrl}|Slack LN tipping bot>!`,
        },
      ],
    };
    return response;
  };

  module.sendTip = function (user, targetUserId, targetTeamId, tipAmount) {
    const promise = new Promise(((resolve, reject) => {
      const sourceSlackId = buildSlackId(user.identity);
      module.dbGetUser(sourceSlackId).then((sourceUser) => {
        const tipAmountInt = parseInt(tipAmount);
        if (Number.isInteger(tipAmountInt)) {
          if (sourceUser.balance >= tipAmountInt) {
            const targetIdentity = { user: { id: targetUserId }, team: { id: targetTeamId } };
            const targetSlackId = buildSlackId(targetIdentity);
            if (targetSlackId == sourceSlackId) {
              reject("You can't send a tip to yourself, sorry.");
            } else {
              module.dbGetUser(targetSlackId).then((targetUser) => {
                if (targetUser) {
                  txprocessor.dbExecuteTransaction(sourceSlackId, targetSlackId, tipAmountInt).then(
                    (result) => {
                      resolve(result);
                    }, (reason) => {
                      reject(reason);
                    },
                  );
                } else {
                  reject("Couldn't send tip, recipient hasn't created an account yet.");
                }
              }, (reason) => {
                reject(reason);
              });
            }
          } else {
            reject("Couldn't send tip, there are not enough funds available in your account.");
          }
        } else {
          reject("Couldn't send tip, not a valid tipping amount.");
        }
      }, (reason) => {
        reject(reason);
      });
    }));
    return promise;
  };

  var buildSlackId = function (identity) {
    return `${identity.user.id},${identity.team.id}`;
  };

  const buildInvoiceMemo = function (user) {
    return `#slacktip#${user.identity.user.id},${user.identity.team.id}#${user.identity.user.name}#`;
  };

  var parseInvoiceMemo = function (memoStr) {
    const re = /\#slacktip\#(\w*),(\w*)\#([^#]*)\#/;
    const array = memoStr.match(re);
    let memo;
    if (array && array.length === 4) {
      memo = { identity: { user: { id: array[1], name: array[3] }, team: { id: array[2] } } };
    } else {
      memo = null;
    }
    return memo;
  };

  module.addInvoice = function (user, amount, expiry) {
    const promise = new Promise(((resolve, reject) => {
      try {
        const memo = buildInvoiceMemo(user);
        const params = { memo: memo };
        if (amount) {
          params.value = amount;
        }
        if (expiry) {
          params.expiry = expiry;
        }
        lightning.getActiveClient().addInvoice(params, (err, response) => {
          if (err) {
            logger.debug('AddInvoice Error:', err);
            err.error = err.message;
            reject(err);
          } else {
            logger.debug('AddInvoice:', response);
            module.dbAddInvoice({ params, response });
            resolve(response);
          }
        });
      } catch (err) {
        debug(err);
        reject(err);
      }
    }));
    return promise;
  };

  const cancelledWithdrawalRefund = function (user, amount) {
    // We credit back the funds to the user account in case of a LN payment error
    const sourceSlackId = buildSlackId(user.identity);
    const update = { $inc: { balance: amount } };
    module.dbUpdateUser(sourceSlackId, update).then((result) => {
      logger.debug("Withdrawal cancelled dbUpdateUser", result);
      // TODO should we handle result <> 1?
    }, (reason) => {
      // Information below will be required for manual handling of user withdrawal refunding
      logger.error('Withdrawal cancel error:', { error: reason, user: user, withdraw: amount });
    });
  };

  module.withdrawFunds = function (user, payreq) {
    const promise = new Promise(((resolve, reject) => {
      lightning.getActiveClient().decodePayReq({ pay_req: payreq }, (err, response) => {
        if (err) {
          logger.debug('DecodePayReq Error:', err);
          reject(err.message);
        } else {
          logger.debug('DecodePayReq:', response);
          const sourceSlackId = buildSlackId(user.identity);
          module.dbGetUser(sourceSlackId).then((sourceUser) => {
            debug('dbGetUser', sourceUser);
            const amount = parseInt(response.num_satoshis);
            if (amount <= 0) {
              reject('Withdrawal rejected, invalid amount.');
            } else if (amount > sourceUser.balance) {
              reject('Withdrawal rejected, not enough funds in your account.');
            } else {
              module.dbWithdrawFunds(sourceSlackId, amount).then((result) => {
                const paymentRequest = { payment_request: payreq };
                logger.debug('Sending payment', paymentRequest);
                lightning.getActiveClient().sendPaymentSync(paymentRequest, (err, response) => {
                  if (err) {
                    logger.debug('SendPayment error:', err);
                    cancelledWithdrawalRefund(user, amount);
                    reject(err.message);
                  } else {
                    logger.debug('SendPayment:', response);
                    if (response.payment_error) {
                      cancelledWithdrawalRefund(user, amount);
                      reject(response.payment_error);
                    } else {
                      resolve(response);
                    }
                  }
                });
              }, (reason) => {
                reject(reason);
              });
            }
          }, (reason) => {
            reject(reason);
          });
        }
      });
    }));
    return promise;
  };

  module.dbAddInvoice = function (invoice) {
    const promise = new Promise(((resolve, reject) => {
      invoicesCol.insert([invoice], { w: 1 }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          logger.debug('AddInvoice DB insert:', result);
          resolve(result);
        }
      });
    }));
    return promise;
  };

  module.dbGetUser = function (slackId) {
    const promise = new Promise(((resolve, reject) => {
      accountsCol.find({ slackid: slackId }).toArray((err, accounts) => {
        if (err) {
          reject(err);
        } else if (accounts.length >= 1) {
          resolve(accounts[0]);
        } else {
          resolve(null);
        }
      });
    }));
    return promise;
  };

  module.dbCreateUser = function (slackId, identity, balance) {
    const promise = new Promise(((resolve, reject) => {
      const user = {
        slackid: slackId, identity, balance, pendingTransactions: [],
      };
      accountsCol.insert(user, { w: 1 }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          logger.debug('CreateUser DB insert:', result);
          resolve(result);
        }
      });
    }));
    return promise;
  };

  module.dbUpdateUser = function (slackId, update) {
    const promise = new Promise(((resolve, reject) => {
      accountsCol.update({ slackid: slackId }, update, { w: 1 }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          logger.debug('dbUpdateUser DB update', result);
          resolve(result);
        }
      });
    }));
    return promise;
  };

  module.dbWithdrawFunds = function (slackId, amount) {
    const promise = new Promise(((resolve, reject) => {
      accountsCol.update({ slackid: slackId, balance: { $gte: amount } }, { $inc: { balance: -1 * amount } }, { w: 1 }, (err, result) => {
        if (err) {
          reject(err);
        } else {
          logger.debug('dbWithdrawFunds DB update', result);
          if (result === 1) {
            resolve(result);
          } else {
            reject('Withdrawal rejected, check available funds in your account.');
          }
        }
      });
    }));
    return promise;
  };

  return module;
};
