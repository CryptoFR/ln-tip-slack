// public/js/lnd.js
var css = require("../css/lnd.css");

window.jQuery = require("jquery");
require("bootstrap");

const angular = require("angular");
require("angular-ui-bootstrap");
require("angular-local-storage");
require("ngclipboard");
require("angular-sanitize");
const bootbox = require("bootbox");
require("ng-toast");
require("angular-uuid");
window.webNotification = require("simple-web-notification"); // required by angular-web-notification
require("angular-web-notification");
require("angular-base64");

const lnwebcli = angular.module("lnwebcli", ["ui.bootstrap", "LocalStorageModule", "ngclipboard", "ngSanitize", "ngToast", "angular-uuid", "angular-web-notification", "base64"]);

lnwebcli.value("jQuery", window.jQuery);
lnwebcli.value("bootbox", bootbox);

lnwebcli.config(["localStorageServiceProvider", function (localStorageServiceProvider) {
	localStorageServiceProvider
		.setPrefix("lnwebcli")
		.setStorageType("localStorage")
		.setNotify(true, true);
}]);

lnwebcli.config(["ngToastProvider", function (ngToast) {
	ngToast.configure({
		// verticalPosition: "bottom",
		// horizontalPosition: "center"
		animation: "fade"
	});
}]);

lnwebcli.constant("config", {
	keys: {
		AUTO_REFRESH: "autorefresh",
		MAX_LOG_BUFFER: "maxlogbuffer",
		MAX_NOTIF_BUFFER: "maxnotifbuffer",
		LOG_NOTIFY_PATTERN: "lognotifypattern"
	},
	defaults: {
		AUTO_REFRESH: 60000, // 1 minute
		MAX_LOG_BUFFER: 500, // 500 lines of logs max
		MAX_NOTIF_BUFFER: 500, // 500 lines of notifications max
		LOG_NOTIFY_PATTERN: "\\[ERR\\]"
	},
	notif: {
		SUCCESS: "SUCCESS",
		INFO: "INFO",
		WARNING: "WARNING"
	},
	events: {
		PEER_REFRESH: "peer.refresh",
		CHANNEL_REFRESH: "channel.refresh",
		HELLO_WS: "hello",
		TAIL_WS: "tail",
		INVOICE_WS: "invoice",
		OPENCHANNEL_WS: "openchannel",
		CLOSECHANNEL_WS: "closechannel",
	},
	modals: {
		NEW_ADDRESS: {
			animation: true,
			ariaLabelledBy: "newaddress-modal-title",
			ariaDescribedBy: "newaddress-modal-body",
			templateUrl: "templates/partials/lnd/newaddress.html",
			controller: "ModalNewAddressCtrl",
			controllerAs: "$ctrl",
			size: "lg",
			resolve: {
				defaults: {
					type: 0 // Witness
				}
			}
		},
		SIGN_MESSAGE: {
			animation: true,
			ariaLabelledBy: "signmessage-modal-title",
			ariaDescribedBy: "signmessage-modal-body",
			templateUrl: "templates/partials/lnd/signmessage.html",
			controller: "ModalSignMessageCtrl",
			controllerAs: "$ctrl",
			size: "lg",
			resolve: {
				defaults: {
					message: "lnd rocks!"
				}
			}
		},
		VERIFY_MESSAGE: {
			animation: true,
			ariaLabelledBy: "verifymessage-modal-title",
			ariaDescribedBy: "verifymessage-modal-body",
			templateUrl: "templates/partials/lnd/verifymessage.html",
			controller: "ModalVerifyMessageCtrl",
			controllerAs: "$ctrl",
			size: "lg",
			resolve: {
				defaults: {
					message: "lnd rocks!"
				}
			}
		}
	}
});

require("./filters")(lnwebcli);
require("./factories")(lnwebcli);
require("./controllers/lnd")(lnwebcli);
require("./directives/lnd")(lnwebcli);
require("./services/lnd")(lnwebcli);
