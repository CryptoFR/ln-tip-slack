module.exports = function (app) {

	app.controller("NavBarCtrl", ["$rootScope", "$scope", "$timeout", "$uibModal", "slacktip", "config", require("./navbar")]);
	app.controller("ModalSendTipCtrl", ["$scope", "$uibModalInstance", "defaults", "slacktip", require("./sendtip")]);
	app.controller("UserCtrl", ["$rootScope", "$scope", "$timeout", "$uibModal", "slacktip", "config", require("./user")]);
	app.controller("ModalWithdrawFundsCtrl", ["$rootScope", "$scope", "$uibModalInstance", "defaults", "slacktip", "config", require("./withdrawfunds")]);
	app.controller("ModalAddInvoiceCtrl", ["$scope", "$uibModalInstance", "defaults", "slacktip", require("./addinvoice")]);

};
