// app/routes/slacktip/addinvoice.js

const debug = require('debug')('lncliweb:routes:slacktip');
const logger = require('winston');

module.exports = function (slacktip) {
  return function (req, res) {
    if (req.session.user) {
      slacktip.addInvoice(req.session.user, req.body.value, req.body.expiry).then((response) => {
        res.json(response);
      }, (err) => {
        res.send(err);
      });
    } else {
      return res.sendStatus(403); // forbidden
    }
  };
};
