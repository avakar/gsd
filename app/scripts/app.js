'use strict';

var app = angular.module('myapp2App', ['ui.bootstrap', 'ui.sortable', 'ui.keypress']);

app.provider('gsignin', function() {
    function Gsignin($rootScope, $timeout, provider) {
        var priv = {
            id_token: null
        };

        function authCallback(authResult) {
            $timeout(function() {
                if (authResult['status']['signed_in']) {
                    priv.id_token = authResult['id_token'];
                } else {
                    priv.id_token = null;
                }

                $rootScope.$broadcast('gsignin', authResult);
            });
        }

        this.render = function(elem) {
            gapi.signin.render(elem[0], {
                clientid: provider.clientid,
                cookiepolicy: provider.cookiepolicy,
                callback: authCallback,
                requestvisibleactions: provider.requestvisibleactions,
                scope: provider.scope,
                width: provider.width
            });
        };

        this.signin = function() {
            gapi.auth.signIn({
                clientid: provider.clientid,
                cookiepolicy: provider.cookiepolicy,
                callback: authCallback,
                requestvisibleactions: provider.requestvisibleactions,
                scope: provider.scope,
            });
        };

        this.signout = function() {
            gapi.auth.signOut();
        };

        Object.defineProperty(this, 'signedin', {
            enumerable: true,
            configurable: false,
            get: function() {
                return priv.id_token !== null;
            }
        });

        Object.defineProperty(this, 'id_token', {
            enumerable: true,
            configurable: false,
            get: function() {
                return priv.id_token;
            }
        });
    }

    this.cookiepolicy = 'single_host_origin';
    this.requestvisibleactions = '';
    this.scope = 'profile email';
    this.width = 'standard';
    this.$get = function($rootScope, $timeout) {
        return new Gsignin($rootScope, $timeout, this);
    };
});

app.config(function(gsigninProvider) {
    gsigninProvider.clientid = '1072740187119-8ls2oofeinouckglv02pq6ao3s82vi70.apps.googleusercontent.com';
    //gsigninProvider.width = 'iconOnly';
});

app.run(function($rootScope, $http, gsignin) {
    $rootScope.$on('gsignin', function(scope, authResult) {
        if (authResult['status']['signed_in']) {
            $http.post('http://localhost:5000/auth/google', {
                id_token: authResult['id_token']
                }).
                success(function(data, status, headers, config) {
                    alert(data);
                }).
                error(function(data, status, headers, config) {
                    alert('error');
                });
        }
    });
});

app.directive('gsignin', function(gsignin) {
    return {
        link: function(scope, elem, attrs, controller) {
            gsignin.render(elem);
        }
    };
});

app.directive('arrowNavigable', function() {

    function findprev(node) {
        do {
            var prev = node.previousSibling;
            if (prev === null) {
                while (prev === null) {
                    node = node.parentNode;
                    if (node === null) {
                        return null;
                    }
                    prev = node.previousSibling;
                }
            }

            do {
                node = prev;
                prev = node.lastChild;
            } while (prev !== null);
        } while (node.nodeType !== Node.ELEMENT_NODE || !node.hasAttribute('arrow-navigable'));

        return node;
    }

    function findnext(node) {
        do {
            var prev = node.nextSibling;
            if (prev === null) {
                while (prev === null) {
                    node = node.parentNode;
                    if (node === null) {
                        return null;
                    }
                    prev = node.nextSibling;
                }
            }

            do {
                node = prev;
                prev = node.firstChild;
            } while (prev !== null);
        } while (node.nodeType !== Node.ELEMENT_NODE || !node.hasAttribute('arrow-navigable'));

        return node;
    }

    function refocus(src, dest) {
        if (dest === null)
            return;

        var pos = src.selectionStart;
        dest.focus();
        dest.selectionStart = pos;
        dest.selectionEnd = pos;
    }

    return {
        link: function(scope, elem, attrs, controller) {
            elem.on('keydown', function(e) {
                if (e.keyCode === 38) {
                    refocus(this, findprev(this));
                    e.preventDefault();
                } else if (e.keyCode === 40) {
                    refocus(this, findnext(this));
                    e.preventDefault();
                }
            });
        }
    };
});

function Task(tasklist, text, complete) {
    Object.defineProperty(this, 'prev', {
        enumerable: false,
        configurable: false,
        value: null,
        writable: true
    });

    Object.defineProperty(this, 'next', {
        enumerable: false,
        configurable: false,
        value: null,
        writable: true
    });

    Object.defineProperty(this, '_private', {
        enumerable: false,
        configurable: false,
        value: {
            tasklist: tasklist,
            text: text,
            complete: complete
        },
        writable: false
    });

    Object.defineProperty(this, 'complete', {
        enumerable: true,
        configurable: false,
        get: function() { return this._private.complete; },
        set: function(v) {
            if (this._private.complete !== v) {
                var old = this._private.complete;
                this._private.complete = v;
                this._private.tasklist.submitChange(this, 'complete', old, v);
            }
        }
    });

    Object.defineProperty(this, 'text', {
        enumerable: true,
        configurable: false,
        get: function() { return this._private.text; },
        set: function(v) {
            if (this._private.text !== v) {
                var old = this._private.text;
                this._private.text = v;
                this._private.tasklist.submitChange(this, 'text', old, v);
            }
        }
    });
}

function ListHead() {
    this.prev = this;
    this.next = this;
}

function Filter(completeOnly) {
    this.completeOnly = completeOnly;

    this.matches = function(task) {
        return !this.completeOnly || !task.complete;
    };
}

function Tasklist(filter) {
    this.taskhead = new ListHead();

    this.filtered = [];
    this.changes = [];

    var taskhead = this.taskhead;
    var oldSplice = this.filtered.splice;
    this.filtered.splice = function(start, deleteCount) {
        var nextTask;
        if (start + deleteCount < this.length)
            nextTask = this[start + deleteCount];
        else
            nextTask = taskhead;

        for (var i = 2; i < arguments.length; ++i) {
            var cur = arguments[i];

            cur.prev.next = cur.next;
            cur.next.prev = cur.prev;

            cur.next = nextTask;
            cur.prev = nextTask.prev;
            nextTask.prev = cur;
            cur.prev.next = cur;
        }

        return oldSplice.apply(this, arguments);
    };

    this._filter = filter;
    Object.defineProperty(this, 'filter', {
        enumerable: true,
        configurable: false,
        get: function() { return this._filter; },
        set: function(v) {
            this._filter = v;
            this.prefilter();
        }
    });

    this.prefilter = function() {
        this.filtered.splice(0, this.filtered.length);
        var cur = this.taskhead.next;
        while (cur !== this.taskhead) {
            if (!this._filter || this._filter.matches(cur))
                this.filtered.push(cur);
            cur = cur.next;
        }
    };

    this.submitChange = function(task, prop, before, after) {
        this.changes.push([task, prop, before, after]);
        this.prefilter();
    };

    this.addTask = function(text, complete) {
        var task = new Task(this, text, complete);

        task.prev = this.taskhead;
        task.next = this.taskhead.next;
        this.taskhead.next = task;
        task.next.prev = task;

        if (!this._filter || this._filter.matches(task))
            this.filtered.unshift(task);
        return task;
    };

    this.toJson = function() {
        var res = [];

        var cur = this.taskhead.next;
        while (cur !== this.taskhead) {
            res.push(cur);
            cur = cur.next;
        }

        return res;
    };
}

app.controller('tasklistController', function($scope, gsignin) {
    $scope.filters = {
        Next: new Filter(true),
        All: new Filter(false)
    };

    $scope.tasklist = new Tasklist($scope.filters.Next);

    $scope.tasklist.addTask('c', false);
    $scope.tasklist.addTask('b', true);
    $scope.tasklist.addTask('a', false);

    Object.defineProperty($scope, 'filter', {
        enumerable: true,
        configurable: false,
        get: function() { return this.tasklist.filter; },
        set: function(v) { this.tasklist.filter = v; }
    });

    $scope.serializeTasklist = function() {
        return this.tasklist.toJson();
    };

    $scope.sortableOptions = {
        handle: '> .drag-handle'
    };
    $scope.createNewTask = function(e) {
        var val = e.target.value;
        e.target.value = '';
        this.tasklist.addTask(val, false);
        e.preventDefault();
    };

    $scope.signout = function() {
        gsignin.signout();
    };

    $scope.gapi = gsignin;
});
