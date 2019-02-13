(function () {
  module.exports = function ($rootScope, $filter, $http, $timeout, $interval, $q, ngToast, bootbox, localStorageService, $, config, uuid, webNotification, iosocket) {
    const _this = this;

    const API = {
      LOGOUT: '/api/logout',
      GETUSER: '/api/slacktip/getuser',
      ADDINVOICE: '/api/slacktip/addinvoice',
      WITHDRAWFUNDS: '/api/slacktip/withdrawfunds',
      SENDTIP: '/api/slacktip/sendtip',
    };

    let configCache = null;
    const wsRequestListeners = {};

    let userCache = null;

    const serverUrl = function (path) {
      return window.serverRootPath ? window.serverRootPath + path : path;
    };

    const socket = iosocket.connect(serverUrl('/'), { secure: location.protocol === 'https' });

    socket.on(config.events.HELLO_WS, (data) => {
      console.log('Hello event received:', data);
      const helloMsg = `${(data && data.remoteAddress) ? `${data.remoteAddress} s` : 'S'}ucessfully connected!`;
      _this.notify(config.notif.SUCCESS, helloMsg);
    });

    socket.on(config.events.INVOICE_WS, (data) => {
      console.log('Invoice received:', data);
    });

    const wsRequestListenersFilter = function (response) {
      if (wsRequestListeners.hasOwnProperty(response.rid)) {
        return wsRequestListeners[response.rid].callback(response);
      }
      return true;
    };

    this.registerWSRequestListener = function (requestId, callback, expires) {
      const deferred = $q.defer();
      expires = expires || new Date().getTime() + 5 * 60 * 1000; // defaults to five minutes
      wsRequestListeners[requestId] = {
        expires,
        callback,
        deferred,
      };
      return deferred.promise;
    };

    this.unregisterWSRequestListener = function (requestId) {
      if (wsRequestListeners.hasOwnProperty(requestId)) {
        const requestListener = wsRequestListeners[requestId];
        requestListener.deferred.resolve();
        delete wsRequestListeners[requestId];
      }
    };

    const wsListenersCleaner = $interval(() => {
      const count = 0;
      const now = new Date().getTime();
      for (const requestId in wsRequestListeners) {
        _this.unregisterWSRequestListener();
        if (wsRequestListeners.hasOwnProperty(requestId)) {
          const requestListener = wsRequestListeners[requestId];
          if (requestListener.expires < now) {
            _this.unregisterWSRequestListener(requestId);
          }
        }
      }
      console.log(`${count} websocket listeners cleaned`);
    }, 60 * 1000); // every 60 seconds

    let notifLines = 0;
    this.notify = function (type, message) {
      console.log(`Notification (${type}) :`, message);
      if (message) {
        $timeout(() => {
          if (type === config.notif.INFO) {
            ngToast.info({
              content: message,
            });
          } else if (type === config.notif.SUCCESS) {
            ngToast.success({
              content: message,
            });
          } else if (type === config.notif.WARNING) {
            ngToast.warning({
              content: message,
            });
          }
          webNotification.showNotification('Lnd Web Client notification', {
            body: message,
            icon: 'favicon.ico',
            onClick(event) {
              console.log('Web notification clicked');
              event.currentTarget.close();
            },
            autoClose: 4000, // 4 seconds
          }, (error, hide) => {
            if (error) {
              _this.alert(`Unable to show web notification: ${error.message}`);
            } else {
              console.log('Web notification shown');
            }
          });
        });
        let index = -1;
        while ((index = message.indexOf('\n', index + 1)) > -1) {
          notifLines++;
        }
        const $notifObj = $('#notifications');
        if ($notifObj) {
          let notifHtml = $notifObj.html();
          index = -1;
          const maxLogBuffer = _this.getConfigValue(
            config.keys.MAX_NOTIF_BUFFER, config.defaults.MAX_NOTIF_BUFFER,
          );
          while (notifLines > maxLogBuffer) {
            index = notifHtml.indexOf('\n', index + 1);
            notifLines--;
          }
          notifHtml = notifHtml.substring(index + 1);
          const now = $filter('date')(new Date(), 'yyyy-MM-dd HH:mm:ss Z');
          $notifObj.html(`${notifHtml + now} - ${type} - ${message}\n`);
          $notifObj.scrollTop($notifObj[0].scrollHeight);
        }
      }
    };

    this.alert = function (message) {
      if (message && message.length > 0) {
        bootbox.alert(message);
      }
    };

    const fetchConfig = function () {
      configCache = localStorageService.get('config'); // update cache
      if (!configCache) { configCache = {}; }
      return configCache;
    };

    const writeConfig = function (config) {
      localStorageService.set('config', config);
      configCache = config; // update cache
    };

    this.getConfigValue = function (name, defaultValue) {
      const config = configCache || fetchConfig();
      const value = config[name];
      if (!value && defaultValue) {
        config[name] = defaultValue;
        writeConfig(config);
      }
      return value;
    };

    this.setConfigValue = function (name, value) {
      const config = configCache || fetchConfig();
      config[name] = value;
      writeConfig(config);
      return true;
    };

    this.getConfigValues = function () {
      const config = configCache || fetchConfig();
      return angular.copy(config);
    };

    this.setConfigValues = function (values) {
      const deferred = $q.defer();
      try {
        if (values) {
          const config = configCache || fetchConfig();
          for (const name in values) {
            if (values.hasOwnProperty(name)) {
              config[name] = values[name];
            }
          }
          writeConfig(config);
        }
        deferred.resolve(true);
      } catch (err) {
        deferred.reject(err);
      }
      return deferred.promise;
    };

    this.getUser = function (useCache) {
      const deferred = $q.defer();
      if (useCache && userCache) {
        deferred.resolve(userCache);
      } else {
        $http.get(serverUrl(API.GETUSER)).then((response) => {
          userCache = response;
          deferred.resolve(response);
        }, (err) => {
          deferred.reject(err);
        });
      }
      return deferred.promise;
    };

    this.addInvoice = function (memo, value) {
      const data = { memo, value };
      return $http.post(serverUrl(API.ADDINVOICE), data);
    };

    this.withdrawFunds = function (payreq) {
      const data = { payreq };
      return $http.post(serverUrl(API.WITHDRAWFUNDS), data);
    };

    this.sendTip = function (userid, teamid, amount) {
      const data = { userid, teamid, amount };
      return $http.post(serverUrl(API.SENDTIP), data);
    };

    this.logout = function () {
      return $http.get(serverUrl(API.LOGOUT));
    };

    Object.seal(this);
  };
}());
