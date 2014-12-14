'use strict';

/**
 * @ngdoc function
 * @name myapp2App.controller:AboutCtrl
 * @description
 * # AboutCtrl
 * Controller of the myapp2App
 */
angular.module('myapp2App')
  .controller('AboutCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];
  });
