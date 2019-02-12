(function () {
  module.exports = function ($scope, $uibModalInstance, defaults, slacktip) {
    const $ctrl = this;

    $ctrl.spinner = 0;

    $ctrl.values = defaults;

    $ctrl.ok = function () {
      $ctrl.spinner++;
      slacktip.addInvoice($ctrl.values.memo, $ctrl.values.value).then((response) => {
        $ctrl.spinner--;
        console.log('AddInvoice', response);
        if (response.data.error) {
          if ($ctrl.isClosed) {
            slacktip.alert(response.data.error);
          } else {
            $ctrl.warning = response.data.error;
          }
        } else {
          $ctrl.invoice = response.data.payment_request;
        }
      }, (err) => {
        $ctrl.spinner--;
        console.log(err);
        const errmsg = err.message || err.statusText;
        if ($ctrl.isClosed) {
          slacktip.alert(errmsg);
        } else {
          $ctrl.warning = errmsg;
        }
      });
    };

    $ctrl.cancel = function () {
      $uibModalInstance.dismiss('cancel');
    };

    $ctrl.dismissAlert = function () {
      $ctrl.warning = null;
    };

    $scope.$on('modal.closing', (event, reason, closed) => {
      console.log(`modal.closing: ${closed ? 'close' : 'dismiss'}(${reason})`);
      $ctrl.isClosed = true;
    });
  };
}());
