// app/routes/slacktip/tip.js

const debug = require('debug')('lncliweb:routes:slacktip');

module.exports = function (slacktip) {
  return function (req, res) {
    debug(req.body);
    slacktip.lntipCommand(req.body).then((response) => {
      res.json(response);
    }, (err) => {
      res.send(err);
    });
  };
};
