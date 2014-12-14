'use strict';

/**
 * @ngdoc function
 * @name myapp2App.controller:MainCtrl
 * @description
 * # MainCtrl
 * Controller of the myapp2App
 */
angular.module('myapp2App')
  .controller('MainCtrl', function ($scope) {
    $scope.awesomeThings = [
      'HTML5 Boilerplate',
      'AngularJS',
      'Karma'
    ];
  });
