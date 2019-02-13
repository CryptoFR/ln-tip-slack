(function () {
  module.exports = function ($rootScope, $scope, $timeout, $uibModal, $, slacktip, config) {
    const $ctrl = this;

    $scope.user = null;

    $scope.refresh = function () {
    };

    $scope.logout = function () {
      slacktip.logout().then((response) => {
        $rootScope.$broadcast(config.events.USER_REFRESH, response);
      }, (err) => {
        console.log(err);
        slacktip.alert(err);
      });
    };

    $scope.sendTip = function () {
      if ($scope.user.identity) {
        const modalInstance = $uibModal.open({
          animation: true,
          ariaLabelledBy: 'sendtip-modal-title',
          ariaDescribedBy: 'sendtip-modal-body',
          templateUrl: 'templates/partials/slacktip/sendtip.html',
          controller: 'ModalSendTipCtrl',
          controllerAs: '$ctrl',
          size: 'lg',
          resolve: {
            defaults() {
              return {
                userid: $scope.user.identity.user.id,
                teamid: $scope.user.identity.team.id,
                amount: 10,
              };
            },
          },
        });

        modalInstance.rendered.then(() => {
          $('#sendtip-userid').focus();
        });

        modalInstance.result.then((values) => {
          console.log('values', values);
        }, () => {
          console.log(`Modal dismissed at: ${new Date()}`);
        });
      } else {
        const message = 'You need to be authentified to use this service.';
        slacktip.alert(message);
      }
    };

    $scope.$on(config.events.USER_REFRESHED, (event, args) => {
      console.log('Received event USER_REFRESHED', event, args);
      $scope.user = args;
      $scope.refresh();
    });
  };
}());
