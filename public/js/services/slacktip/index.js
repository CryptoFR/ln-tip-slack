module.exports = function (app) {

	app.service("slacktip", ["$rootScope", "$filter", "$http", "$timeout", "$interval", "$q", "ngToast", "localStorageService", "config", "uuid", "webNotification", "iosocket", require("./slacktip")]);

};
