'use strict';

var app = angular.module('myapp2App', ['ui.bootstrap', 'ui.sortable', 'ui.keypress', 'angular_taglist_directive']);

app.provider('gsignin', function() {
    function Gsignin($rootScope, $timeout, provider) {
        var priv = {
            id_token: null
        };

        function authCallback(authResult) {
            console.log(authResult.status.signed_in);
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

app.factory('$storage', function($window) {
    return $window.localStorage;
});

app.run(function($rootScope, $http, gsignin, taskapi) {
    $rootScope.$on('gsignin', function(scope, authResult) {
        if (authResult['status']['signed_in']) {
            $http.post('http://ratatanek.cz:5000/auth/google', {
                id_token: authResult['id_token']
                }).
                success(function(data, status, headers, config) {
                    taskapi.setToken(data.token);
                }).
                error(function(data, status, headers, config) {
                    taskapi.setToken(null);
                });
        } else {
            taskapi.setToken(null);
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

function Task(changeCallback, id, text, complete) {
    var priv = {
        changeCallback: changeCallback,
        id: id,
        text: text,
        complete: complete,
        tags: [],
    };

    Object.defineProperty(this, 'prev', {
        enumerable: false,
        configurable: false,
        value: this,
        writable: true,
    });

    Object.defineProperty(this, 'next', {
        enumerable: false,
        configurable: false,
        value: this,
        writable: true,
    });

    Object.defineProperty(this, 'id', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.id; },
        set: function(v) { priv.id = v; },
    });

    Object.defineProperty(this, 'complete', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.complete; },
        set: function(v) {
            if (priv.complete !== v) {
                priv.complete = v;
                priv.changeCallback(this);
            }
        }
    });

    Object.defineProperty(this, 'text', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.text; },
        set: function(v) {
            if (priv.text !== v) {
                priv.text = v;
                priv.changeCallback(this);
            }
        }
    });

    Object.defineProperty(this, 'tags', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.tags; },
    });

    this.applyDescriptor = function(desc) {
        var comps = desc.split(' ');
        var state = {
            cur: null,
            newTags: [],
            };
        comps.forEach(function(comp) {
            if (comp.length > 0 && comp[0] == '@') {
                if (state.cur)
                    state.newTags.push(state.cur);
                state.cur = comp.substr(1);
            } else {
                if (state.cur !== null)
                    state.cur = state.cur + ' ' + comp;
            }
        });
        if (state.cur)
            state.newTags.push(state.cur);
        priv.tags = state.newTags;
        changeCallback(this);
    };

    this.getDescriptor = function() {
        return priv.tags.length? '@' + priv.tags.join(' @'): '';
    }

    this.addTag = function(tag) {
        if (priv.tags.indexOf(tag) === -1) {
            priv.tags.push(tag);
            priv.changeCallback(this);
        }
    };

    this.removeTag = function(tag) {
        var pos = priv.tags.indexOf(tag);
        if (pos !== -1) {
            priv.tags.splice(pos, 1);
            priv.changeCallback(this);
        }
    };
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

function EventEmitter() {
    var regs = {};
    var paused = {};

    this.$on = function(event, handler) {
        if (event in regs) {
            regs[event].push(handler);
        } else {
            regs[event] = [handler];
            paused[event] = false;
        }

        return function() {
            var pos = regs[event].indexOf(handler);
            if (pos >= 0)
                regs.splice(pos, 1);
        }
    };

    this.$emit = function(event) {
        if (event in regs && !paused[event]) {
            var eventArgs = arguments;
            regs[event].forEach(function(handler) {
                handler.apply(handler, eventArgs);
            });
        }
    }

    this.$pause = function(event) {
        paused[event] = true;
    };

    this.$unpause = function(event) {
        paused[event] = false;
    };
}

function Tasklist() {
    var priv = {
        head: new ListHead(),
        task_map: {},
        next_id: -1,
        suppress_events: false,
        events: new EventEmitter(),
        };

    this.events = priv.events;

    Object.defineProperty(this, 'sentinel', {
        enumerable: false,
        configurable: false,
        get: function() { return priv.head; },
    });

    function onChange() {
        if (!priv.suppress_events)
            priv.events.$emit('change');
    }

    this.insertAfter = function(task, base) {
        task.prev.next = task.next;
        task.next.prev = task.prev;
        task.prev = base;
        task.next = base.next;
        task.prev.next = task;
        task.next.prev = task;
        onChange();
    };

    this.insertBefore = function(task, base) {
        task.prev.next = task.next;
        task.next.prev = task.prev;
        task.next = base;
        task.prev = base.prev;
        task.next.prev = task;
        task.prev.next = task;
        onChange();
    };

    this.addTask = function(text, complete) {
        var task = new Task(onChange, priv.next_id--, text, complete);
        priv.task_map[task.id] = task;
        this.insertAfter(task, priv.head);
        return task;
    };

    function _remove(task) {
        var res = task.next;
        task.prev.next = task.next;
        task.next.prev = task.prev;
        delete priv.task_map[task.id];
        return res;
    }

    this.remove = function(task) {
        _remove(task);
        onChange();
    };

    function _clear() {
        var cur = priv.head.next;
        while (cur != priv.head) {
            cur = _remove(cur);
        }
    }

    this.clear = function() {
        _clear();
        onChange();
    };

    this.load = function(tasks) {
        priv.suppress_events = true;

        var newHead = new ListHead();
        var newTaskmap = {};

        tasks.forEach(function(t) {
            var curTask;
            if (t.id in priv.task_map) {
                curTask = priv.task_map[t.id];
                curTask.text = t.text;
                curTask.complete = t.complete;
                curTask.tags.splice(0, curTask.tags.length);
            } else {
                curTask = new Task(onChange, t.id, t.text, t.complete);
            }

            if ('tags' in t) {
                t.tags.forEach(function(tag) {
                    curTask.addTag(tag);
                });
            }

            newTaskmap[curTask.id] = curTask;
            curTask.prev = newHead.prev;
            curTask.next = newHead;
            newHead.prev = curTask;
            curTask.prev.next = curTask;
        });

        priv.head = newHead;
        priv.task_map = newTaskmap;
        this.verify();
        priv.suppress_events = false;
        onChange();
    };

    this.forEach = function(callback, thisArg) {
        var cur = priv.head.next;
        while (cur != priv.head) {
            callback.call(thisArg, cur);
            cur = cur.next;
        }
    };

    this.remap_ids = function(m) {
        m.forEach(function(mp) {
            var prev_id = mp[0];
            var new_id = mp[1];

            var task = priv.task_map[prev_id];
            task.id = new_id;
            priv.task_map[new_id] = task;
            delete priv.task_map[prev_id];
        }, this);
    };

    this.toJson = function() {
        var res = [];

        var cur = priv.head.next;
        while (cur !== priv.head) {
            res.push(cur);
            cur = cur.next;
        }

        return angular.toJson(res);
    };

    this.verify = function() {
        var prev = priv.head;
        var cur = prev.next;

        if (cur.prev !== prev || prev.next !== cur) {
            alert('whoops');
        }

        var count = 0;
        while (cur !== priv.head) {
            ++count;
            if (count > 10 || cur.prev !== prev || prev.next !== cur) {
                alert('whoops');
            }
            prev = cur;
            cur = cur.next;
        }
    };
}

app.service('taskapi', function($http, $timeout) {
    var priv = {
        token: null,
        tasklist: new Tasklist(),
        tasklist_version: null,
        load_timeout_promise: null,
        store_scheduled: false,
        store_in_progress: false,
        suppress_store: false,
        };

    Object.defineProperty(this, 'tasklist', {
        enumerable: false,
        configurable: false,
        get: function() { return priv.tasklist; },
    });

    function load_from_server() {
        priv.load_timeout_promise = null;
        $http.get('http://ratatanek.cz:5000/tasks', {
            headers: { 'Authorization': 'Bearer ' + priv.token }
            })
            .success(function(data) {
                if (priv.tasklist_version === null || priv.tasklist_version < data.version) {
                    priv.tasklist_version = data.version;
                    priv.suppress_store = true;
                    priv.tasklist.load(data.tasks);
                    priv.suppress_store = false;
                }
                priv.load_timeout_promise = $timeout(load_from_server, 60000);
            })
            .error(function() {
                priv.load_timeout_promise = $timeout(load_from_server, 300000);
            });
    }

    function store_to_server() {
        if (priv.token === null || priv.suppress_store)
            return;

        priv.store_scheduled = true;
        if (!priv.store_in_progress) {
            priv.store_scheduled = false;
            priv.store_in_progress = true;

            var ser = [];
            priv.tasklist.forEach(function(task) {
                ser.push(task);
            }, this);

            var data = {
                tasks: ser,
                };
            $http.put('http://ratatanek.cz:5000/tasks', data, {
                headers: { 'Authorization': 'Bearer ' + priv.token }
                })
                .success(function(data) {
                    priv.tasklist.remap_ids(data.id_remap);
                    priv.store_in_progress = false;
                    if (priv.store_scheduled)
                        store_to_server();
                })
                .error(function() {
                    priv.store_in_progress = false;
                });
        }
    }

    this.setToken = function(token) {
        if (priv.token !== token) {
            if (priv.load_timeout_promise !== null) {
                $timeout.cancel(priv.load_timeout_promise);
                priv.load_timeout_promise = null;
            }

            priv.token = token;
            if (token) {
                priv.tasklist_version = null;
                load_from_server();
            } else {
                priv.tasklist.clear();
            }
        }
    }

    Object.defineProperty(this, 'signedin', {
        enumerable: true,
        configurable: false,
        get: function() {
            return priv.token !== null;
        }
    });

    priv.tasklist.events.$on('change', function() {
        store_to_server();
    });
});

function FilteredTasklist(tasklist, filter) {
    var priv = {
        filter: filter,
        suppress_prefilter: false
        };

    this.tasklist = tasklist;
    this.filtered = [];

    var oldSplice = this.filtered.splice;
    this.filtered.splice = function(start, deleteCount) {
        var nextTask;
        if (start + deleteCount < this.length)
            nextTask = this[start + deleteCount];
        else
            nextTask = tasklist.sentinel;

        tasklist.events.$pause('change');
        for (var i = 2; i < arguments.length; ++i) {
            var cur = arguments[i];
            tasklist.insertBefore(cur, nextTask);
        }
        tasklist.events.$unpause('change');
        priv.suppress_prefilter = true;
        tasklist.events.$emit('change');
        priv.suppress_prefilter = false;

        return oldSplice.apply(this, arguments);
    };

    Object.defineProperty(this, 'filter', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.filter; },
        set: function(v) {
            priv.filter = v;
            this.prefilter();
        }
    });

    this.prefilter = function() {
        oldSplice.call(this.filtered, 0, this.filtered.length);
        var cur = tasklist.sentinel.next;
        while (cur !== tasklist.sentinel) {
            if (!priv.filter || priv.filter.matches(cur))
                this.filtered.push(cur);
            cur = cur.next;
        }
    };

    this.addTask = function(text, complete) {
        return this.tasklist.addTask(text, complete);
    };

    this.toJson = function() {
        return angular.toJson(this.filtered);
    };

    var self = this;
    this.tasklist.events.$on('change', function() {
        if (!priv.suppress_prefilter)
            self.prefilter();
    });
}

app.controller('tasklistController', function($scope, gsignin, taskapi) {
    $scope.filters = {
        Next: new Filter(true),
        All: new Filter(false)
    };

    $scope.raw_tasklist = taskapi.tasklist;
    $scope.tasklist = new FilteredTasklist($scope.raw_tasklist, $scope.filters.Next);

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

    $scope.deleteTask = function(task) {
        taskapi.tasklist.remove(task);
    };

    $scope.gapi = gsignin;
    $scope.taskapi = taskapi;

    $scope.verify = function() {
        taskapi.tasklist.verify();
    };
});

app.directive('inlineEditContext', function() {
    var completionAction;
    return {
        scope: true,
        controller: function($scope) {
            var registeredInputs = [];

            $scope.editting = false;
            $scope.beginEdit = function() {
                var initial = $scope.$eval(completionAction.get);
                registeredInputs.forEach(function(input) {
                    input(initial);
                });
                $scope.editting = true;
            };
            this.registerInput = function(input) {
                registeredInputs.push(input);
            };

            this.completeEdit = function(input, value) {
                $scope.$eval(completionAction.set, {'$value': value});
                $scope.editting = false;
            };

            this.cancelEdit = function(input) {
                $scope.editting = false;
            };
        },
        link: function($scope, element, attrs) {
            completionAction = $scope.$eval(attrs.inlineEditContext);
            element.on('keydown', function(event) {
                if (event.altKey && !event.ctrlKey && !event.shiftKey && !event.metaKey
                        && event.keyCode == 13) {
                    $scope.$apply(function() {
                        $scope.beginEdit();
                    });
                }
            });
        },
/*        link: function(scope, element, attrs) {
            scope.editting = false;
            scope.beginEdit = function() {
                for (var input in scope.editInputs) {
                    input.show();
                    input.focus();
                }
            };
            scope.editInputs = []
        },*/
    };
});

app.directive('inlineEditInput', function($document, $rootScope) {
    return {
        require: '^inlineEditContext',
        link: function(scope, element, attrs, context) {
            var active = false;
            var previousFocus = null;

            function complete() {
                if (active) {
                    $rootScope.$apply(function() {
                        context.completeEdit(element, element.val());
                    });
                    element.hide();
                    if (previousFocus)
                        previousFocus.focus();
                    active = false;
                }
            }
            
            function cancelEdit() {
                if (active) {
                    $rootScope.$apply(function() {
                        context.cancelEdit(element);
                    });
                    element.hide();
                    if (previousFocus)
                        previousFocus.focus();
                    active = false;
                }
            }

            element.hide();
            context.registerInput(function(startValue) {
                if (!active) {
                    previousFocus = $document[0].activeElement;
                    element.val(startValue);
                    element.show();
                    element.focus();
                    active = true;
                }
            });
            element.on('blur', function() {
                complete();
            });
            element.on('keydown', function(event) {
                switch (event.keyCode) {
                case 13:
                    complete();
                    break;
                case 27:
                    cancelEdit();
                    break;
                }
            });
            
            element.on('keypress', function(event) {
            });
        },
    };
});