// app/routes/slacktip/getuser.js

const debug = require('debug')('lncliweb:routes:slacktip');

module.exports = function (slacktip) {
  return function (req, res) {
    if (req.session.user) {
      debug(req.session.user);
      slacktip.getUser(req.session.user.identity).then((user) => {
        res.json(user);
      }, (err) => {
        res.json({ message: err.message });
      });
    } else {
      res.json({ message: 'Not connected' });
    }
  };
};
