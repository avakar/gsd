'use strict';

var app = angular.module('myapp2App', ['ui.bootstrap', 'ui.sortable']);

app.directive('arrowNavigable', function() {
    return {
        link: function(scope, elem, attrs, controller) {
            elem.on('keydown', function(e) {
                if (e.keyCode == 38) {
                    alert('test');
                    e.preventDefault();
                } else if (e.keyCode == 40) {
                    alert('testdown');
                    e.preventDefault();
                }
            })
        }
    }
});

app.controller('tasklistController', function($scope) {
    $scope.tasklist = [
        { text: 'a', value: 1 },
        { text: 'b', value: 2 },
        { text: 'c', value: 3 },
        ];
    $scope.sortableOptions = {
        handle: '> .drag-handle'
    };
});
