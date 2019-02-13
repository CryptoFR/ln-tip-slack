// app/routes/slacktip/slack-callback.js

const debug = require('debug')('lncliweb:routes:slacktip');
const request = require('request');

module.exports = function (slacktip) {
  return function (req, res) {
    slacktip.getSlackUserIdentity(req.query.access_token).then((user) => {
      req.session.user = user;
      res.redirect('/');
    }, (err) => {
      debug(err);
      res.redirect('/');
    });
  };
};
