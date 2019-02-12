module.exports = function (app) {
  app.directive('getUser', [require('./getuser')]);
};
