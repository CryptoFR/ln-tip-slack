// public/slacktipapp.js

window.jQuery = require('jquery');
require('bootstrap');

const angular = require('angular');
require('angular-ui-bootstrap');
require('angular-local-storage');
require('ngclipboard');
require('angular-sanitize');
const bootbox = require('bootbox');
require('ng-toast');
require('angular-uuid');
window.webNotification = require('simple-web-notification'); // required by angular-web-notification
require('angular-web-notification');
require('angular-base64');
const qrcode = require('qrcode-generator');
const css = require('../css/slacktipapp.css');

window.qrcode = qrcode;
require('angular-qrcode');
require('angular-smart-table');

const slacktipapp = angular.module('slacktipapp', ['ui.bootstrap', 'LocalStorageModule', 'ngclipboard', 'ngSanitize', 'ngToast', 'angular-uuid', 'angular-web-notification', 'base64']);

slacktipapp.value('jQuery', window.jQuery);
slacktipapp.value('bootbox', bootbox);

slacktipapp.config(['localStorageServiceProvider', function (localStorageServiceProvider) {
  localStorageServiceProvider
    .setPrefix('slacktip')
    .setStorageType('localStorage')
    .setNotify(true, true);
}]);

slacktipapp.config(['ngToastProvider', function (ngToast) {
  ngToast.configure({
    // verticalPosition: "bottom",
    // horizontalPosition: "center"
    animation: 'fade',
  });
}]);

slacktipapp.constant('config', {
  keys: {
    AUTO_REFRESH: 'autorefresh',
  },
  defaults: {
    AUTO_REFRESH: 60000, // 1 minute
  },
  notif: {
    SUCCESS: 'SUCCESS',
    INFO: 'INFO',
    WARNING: 'WARNING',
  },
  events: {
    INVOICE_WS: 'invoice',
    USER_REFRESH: 'user.refresh',
    USER_REFRESHED: 'user.refreshed',
  },
  modals: {
  },
});

require('./filters')(slacktipapp);
require('./factories')(slacktipapp);
require('./controllers/slacktip')(slacktipapp);
require('./directives/slacktip')(slacktipapp);
require('./services/slacktip')(slacktipapp);
