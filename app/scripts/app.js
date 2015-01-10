'use strict';
/*global gapi*/
/*global jQuery*/
/*global taskmoment*/

var app = angular.module('myapp2App', ['ui.bootstrap', 'ui.sortable', 'ui.keypress', 'angular_taglist_directive']);
var apiPath = 'http://gsd.ratatanek.cz/api';

app.provider('gsignin', function() {
    function Gsignin($rootScope, $timeout, provider) {
        var priv = {
            idtoken: null
        };

        function authCallback(authResult) {
            $timeout(function() {
                if (authResult.status.signed_in) {
                    priv.idtoken = authResult.id_token;
                } else {
                    priv.idtoken = null;
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
                return priv.idtoken !== null;
            }
        });

        Object.defineProperty(this, 'idtoken', {
            enumerable: true,
            configurable: false,
            get: function() {
                return priv.idtoken;
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

app.factory('redigest', function($timeout) {
    var promise = null;
    var resolution = 0;

    function start() {
        if (resolution > 0 && resolution < 7) {
            var stopTs = taskmoment.now(resolution).stopDate().getTime();
            var t = stopTs - Date.now();
            promise = $timeout(start, t);
        } else {
            promise = null;
        }
    }

    function restart() {
        if (promise !== null)
            $timeout.cancel(promise);
        start();
    }

    return function(r) {
        resolution = r;
        restart();
    };
});

app.run(function($rootScope, $http, $interval, gsignin, taskapi) {
    $rootScope.$on('gsignin', function(scope, authResult) {
        if (authResult.status.signed_in) {
            $http.post(apiPath + '/auth/google', {
                id_token: authResult.id_token,
                }).
                success(function(data) {
                    taskapi.setToken(data.token);
                }).
                error(function() {
                    taskapi.setToken(null);
                });
        } else {
            taskapi.setToken(null);
        }
    });
});

app.directive('gsignin', function(gsignin) {
    return {
        link: function(scope, elem) {
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
        link: function(scope, elem) {
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

function formatDate(date, format) {
    date = new Date(date.getTime());
    date.setUTCHours(0, 0, 0, 0);
    var now = new Date();

    now.setUTCHours(0, 0, 0, 0);

    var day = date.getUTCDate();

    var diff = date.getTime() - now.getTime();
    if (diff >= 0) {
        if (diff === 0)
            return 'today';
        if (diff === 86400000)
            return 'tomorrow';
        if (diff <= 604800000) {
            var val = (diff / 86400000).toString();
            if (format === 'human')
                return 'in ' + val + ' days';
            else
                return '+' + val + 'd';
        }

        if (format === 'human' && day === 1) {
            var monthDiff =
                (date.getUTCFullYear() * 12 + date.getUTCMonth()) -
                (now.getUTCFullYear() * 12 + now.getUTCMonth());
            if (monthDiff === 1)
                return 'next month';
            if (monthDiff < 12)
                return 'in ' + monthDiff.toString() + ' months';
        }
    }

    var month = (date.getUTCMonth() + 1).toString();
    while (month.length < 2)
        month = '0' + month;

    day = day.toString();
    while (day.length < 2)
        day = '0' + day;
    return date.getUTCFullYear().toString() + '-' + month + '-' + day;
}

function formatStartDate(date, format) {
    if (date instanceof Date)
        return formatDate(date, format);
    return date;
}

function Task(changeCallback, id, textAndDesc) {
    var priv = {
        changeCallback: changeCallback,
        id: id,
        text: '',
        completionTime: null,
        dueDate: null,
        tags: [],
        contexts: [],
        startDate: 'next',
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
        get: function() { return priv.completionTime !== null; },
        set: function(v) {
            if (v) {
                if (priv.completionTime === null) {
                    priv.completionTime = new Date();
                    priv.changeCallback(this);
                }
            } else {
                if (priv.completionTime !== null) {
                    priv.completionTime = null;
                    priv.changeCallback(this);
                }
            }
        }
    });

    Object.defineProperty(this, 'completionTime', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.completionTime; },
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

    Object.defineProperty(this, 'contexts', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.contexts; },
    });

    Object.defineProperty(this, 'startDate', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.startDate; },
    });

    Object.defineProperty(this, 'dueDate', {
        enumerable: true,
        configurable: false,
        get: function() { return priv.dueDate; },
    });

    this.getFriendlyDueDate = function() {
        return priv.dueDate === null? '': 'due ' + priv.dueDate.fromNowFriendly();
    };

    this.load = function(t) {
        priv.id = t.id;
        priv.text = t.text;
        if ('complete' in t) {
            if (t.complete) {
                priv.completionTime = new Date();
            } else {
                priv.completionTime = null;
            }
        } else {
            priv.completionTime = null;
            if ('completionTime' in t) {
                if (typeof t.completionTime === 'string') {
                    priv.completionTime = new Date(t.completionTime);
                } else if (typeof t.completionTime === 'number') {
                    priv.completionTime = new Date(t.completionTime * 1000);
                }
            }
        }

        if ('dueDate' in t && t.dueDate !== null) {
            if (typeof t.dueDate === 'number')
                priv.dueDate = taskmoment(t.dueDate * 1000, 3);
            else
                priv.dueDate = taskmoment(t.dueDate);
        } else {
            priv.dueDate = null;
        }

        var newTags = [];
        if ('tags' in t) {
            t.tags.forEach(function(tag) {
                newTags.push(tag);
            });
        }
        var newCtxs = [];
        if ('contexts' in t) {
            t.contexts.forEach(function(ctx) {
                newCtxs.push(ctx);
            });
        }
        newTags.sort();
        newCtxs.sort();
        priv.tags = jQuery.unique(newTags);
        priv.contexts = jQuery.unique(newCtxs);

        if ('startDate' in t) {
            if (typeof(t.startDate) === 'number') {
                priv.startDate = new Date();
                priv.startDate.setTime(t.startDate * 1000);
            } else {
                priv.startDate = t.startDate;
            }
        } else {
            priv.startDate = 'next';
        }

        priv.changeCallback(this);
    };

    this.store = function() {
        return {
            id: priv.id,
            text: priv.text,
            completionTime: priv.completionTime === null? null: priv.completionTime.getTime() / 1000,
            dueDate: priv.dueDate === null? null: priv.dueDate.store(),
            tags: priv.tags,
            contexts: priv.contexts,
            startDate: priv.startDate instanceof Date? priv.startDate.getTime() / 1000: priv.startDate,
        };
    };

    this.applyDescriptor = function(desc) {
        var comps = desc.split(' ');
        var state = {
            cur: [],
            kind: 0,
            prefix: '',
            newTags: [],
            newCtxs: [],
            newStartDate: priv.startDate,
            newDueDate: null,
            };

        function parseDate(s) {
            var res = null;
            if (s.substr(0, 1) === '+') {
                s = s.substr(1);
                var nonDigitIndex = s.length;
                for (var i = 0; i < s.length; ++i) {
                    var ch = s.charCodeAt(i);
                    if (0x30 > ch || ch > 0x39) {
                        nonDigitIndex = i;
                        break;
                    }
                }

                var value = parseInt(s.substr(0, nonDigitIndex));
                var unit = s.substr(nonDigitIndex);
                var selectedUnit = null;
                if (unit === '') {
                    selectedUnit = 'days';
                } else {
                    ['days', 'weeks', 'months', 'years'].forEach(function(spec) {
                        if (spec.substr(0, unit.length) === unit)
                            selectedUnit = spec;
                    });
                }

                if (selectedUnit === null)
                    return null;

                res = new Date();
                res.setUTCHours(0, 0, 0, 0);

                switch (selectedUnit) {
                case 'days':
                    res.setUTCDate(res.getUTCDate() + value);
                    break;
                case 'weeks':
                    res.setUTCDate(res.getUTCDate() + 7*value);
                    break;
                case 'months':
                    res.setUTCMonth(res.getUTCMonth() + value, 1);
                    break;
                case 'years':
                    res.setUTCFullYear(res.getUTCFullYear() + value, 0, 1);
                    break;
                }

            } else {
                ['tomorrow', 'today', 'now', 'next', 'waiting', 'someday'].forEach(function(spec) {
                    if (spec.substr(0, s.length) === s)
                        res = spec;
                });

                if (res === 'today' || res === 'now') {
                    res = new Date();
                    res.setUTCHours(0, 0, 0, 0);
                }

                if (res === 'tomorrow') {
                    res = new Date();
                    res.setUTCHours(0, 0, 0, 0);
                    res.setUTCDate(res.getUTCDate() + 1);
                }

                if (res === null) {
                    res = Date.parse(s);
                    if (isNaN(res))
                        return null;
                    res = new Date(res);
                }
            }
            return res;
        }

        function addPart() {
            var cur = state.cur.join(' ');
            var tmp;

            switch (state.kind) {
            case 0:
                state.prefix = cur;
                break;
            case 1:
                state.newTags.push(cur);
                break;
            case 2:
                state.newCtxs.push(cur);
                break;
            case 3:
                tmp = parseDate(cur);
                if (tmp !== null)
                    state.newStartDate = tmp;
                break;
            case 4:
                tmp = taskmoment(cur);
                if (tmp !== null)
                    state.newDueDate = tmp;
                break;
            }
        }

        comps.forEach(function(comp) {
            if (comp.length > 0 && comp[0] === '#') {
                addPart();
                state.kind = 1;
                state.cur = [comp.substr(1)];
            } else if (comp.length > 0 && comp[0] === '@') {
                addPart();
                state.kind = 2;
                state.cur = [comp.substr(1)];
            } else if (comp.length > 0 && comp[0] === '^') {
                addPart();
                state.kind = 3;
                state.cur = [comp.substr(1)];
            } else if (comp.length > 0 && comp[0] === '%') {
                addPart();
                state.kind = 4;
                state.cur = [comp.substr(1)];
            } else {
                state.cur.push(comp);
            }
        });

        addPart();
        state.newTags.sort();
        state.newCtxs.sort();
        priv.tags = jQuery.unique(state.newTags);
        priv.contexts = jQuery.unique(state.newCtxs);
        priv.startDate = state.newStartDate;
        priv.dueDate = state.newDueDate;
        changeCallback(this);
        return state.prefix;
    };

    this.getDescriptor = function() {
        var parts = [];
        if (priv.startDate !== 'next')
            parts.push('^' + formatStartDate(priv.startDate, 'desc'));
        if (priv.dueDate !== null)
            parts.push('%' + (priv.dueDate === null? '': priv.dueDate.fromNow()));
        if (priv.tags.length)
            parts.push('#' + priv.tags.join(' #'));
        if (priv.contexts.length)
            parts.push('@' + priv.contexts.join(' @'));
        return parts.join(' ');
    };

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

    if (textAndDesc) {
        var prefix = this.applyDescriptor(textAndDesc);
        priv.text = prefix;
    }
}

function ListHead() {
    this.prev = this;
    this.next = this;
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
        };
    };

    this.$emit = function(event) {
        if (event in regs && !paused[event]) {
            var eventArgs = arguments;
            regs[event].forEach(function(handler) {
                handler.apply(handler, eventArgs);
            });
        }
    };

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

    this.addTask = function(textAndDesc) {
        var task = new Task(onChange, priv.next_id--, textAndDesc);
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
        while (cur !== priv.head) {
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
            } else {
                curTask = new Task(onChange, null);
            }

            curTask.load(t);

            newTaskmap[curTask.id] = curTask;
            curTask.prev = newHead.prev;
            curTask.next = newHead;
            newHead.prev = curTask;
            curTask.prev.next = curTask;
        });

        priv.head = newHead;
        priv.task_map = newTaskmap;
        priv.suppress_events = false;
        onChange();
    };

    this.store = function() {
        var res = [];
        this.forEach(function(task) {
            res.push(task.store());
        });
        return res;
    };

    this.forEach = function(callback, thisArg) {
        var cur = priv.head.next;
        while (cur !== priv.head) {
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
            res.push(cur.store());
            cur = cur.next;
        }

        return angular.toJson(res);
    };

/*    this.verify = function() {
        var prev = priv.head;
        var cur = prev.next;

        if (cur.prev !== prev || prev.next !== cur) {
            debugger;
        }

        var count = 0;
        while (cur !== priv.head) {
            ++count;
            if (cur.prev !== prev || prev.next !== cur) {
                debugger;
            }
            prev = cur;
            cur = cur.next;
        }
    };*/
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
        $http.get(apiPath + '/tasks', {
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

            var data = {
                tasks: priv.tasklist.store(),
                };
            $http.put(apiPath + '/tasks', data, {
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
    };

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

    Object.defineProperty(this, 'contexts', {
        enumerable: false,
        configurable: false,
        get: function() {
            var res = {};
            priv.tasklist.forEach(function(task) {
                task.contexts.forEach(function(ctx) {
                    res[ctx] = true;
                });
            });
            return Object.keys(res).sort();
        },
    });
});

function FilteredTasklist(tasklist, filter, redigest) {
    var priv = {
        filter: filter,
        contextFilter: [],
        suppress_prefilter: false
        };

    this.tasklist = tasklist;

    function filteredSplice(start, deleteCount) {
        /*jshint validthis:true*/
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

        return Array.prototype.splice.apply(this, arguments);
    }

    this.filtered = [];

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
        var filtered = [];
        tasklist.forEach(function(cur) {
            var matchesCtx = priv.contextFilter.length === 0 ||
                    cur.contexts.length === 0;
            if (!matchesCtx) {
                cur.contexts.forEach(function(ctx) {
                    if (priv.contextFilter.indexOf(ctx) !== -1)
                        matchesCtx = true;
                });
            }

            if (matchesCtx)
                filtered.push(cur);
        });

        var newFiltered = priv.filter.filter(filtered);

        var oldCats = {};
        this.filtered.forEach(function(list) {
            oldCats[list.cat] = list;
        });

        this.filtered = [];
        newFiltered.forEach(function(group) {
            group.list.splice = filteredSplice;
            if (group.cat in oldCats) {
                var oldFilter = oldCats[group.cat];
                oldFilter.list = group.list;
                this.filtered.push(oldFilter);
            } else {
                this.filtered.push(group);
            }
        }, this);

        var digestResolution = 0;
        this.filtered.forEach(function(group) {
            group.list.forEach(function(task) {
                if (task.dueDate)
                    digestResolution = Math.max(digestResolution, task.dueDate.resolution());
            });
        });

        redigest(digestResolution);
    };

    this.setContextFilter = function(contexts) {
        priv.contextFilter = contexts;
        this.prefilter();
    };

    this.addTask = function(textAndDesc) {
        return this.tasklist.addTask(textAndDesc);
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

function FilteredList(name, cat, list) {
    this.name = name;
    this.cat = cat;
    this.list = list;
}

var AllFilter = {
    name: 'All',
    allowSort: true,
    filter: function(tasklist) {
        var res = {};
        tasklist.forEach(function(task) {
            if (task.complete)
                return;
            var cat;
            var now = Date.now();
            if (task.startDate instanceof Date) {
                if (task.startDate.getTime() < now) {
                    cat = 'next';
                } else {
                    cat = task.startDate;
                }
            } else {
                cat = task.startDate;
            }

            if (!(cat in res)) {
                var name = cat === 'next'? '': formatStartDate(cat, 'human');
                res[cat] = new FilteredList(name, cat, [task]);
            } else {
                res[cat].list.push(task);
            }
        });
        var resarr = [];
        for (var cat in res) {
            resarr.push(res[cat]);
        }

        function startDateToOrder(d) {
            if (d === 'next')
                return [0];
            if (d === 'waiting')
                return [1];
            if (d === 'someday')
                return [3];
            return [2, d.getTime()];
        }

        resarr.sort(function(lhs, rhs) {
            lhs = startDateToOrder(lhs.cat);
            rhs = startDateToOrder(rhs.cat);
            for (var i = 0; i < lhs.length && i < rhs.length; ++i) {
                if (lhs[i] !== rhs[i])
                    return lhs[i] - rhs[i];
            }
            return lhs.length - rhs.length;
        });
        return resarr;
    }
};

var CompletedFilter = {
    name: 'Completed',
    allowSort: false,
    filter: function(tasklist) {
        var res = [];
        tasklist.forEach(function(task) {
            if (task.complete)
                res.push(task);
        });
        res.sort(function(lhs, rhs) {
            return rhs.completionTime.getTime() - lhs.completionTime.getTime();
        });
        return [new FilteredList('', 'completed', res)];
    }
};

app.controller('tasklistController', function($scope, gsignin, taskapi, redigest) {
    $scope.filters = [AllFilter, CompletedFilter];
    $scope.raw_tasklist = taskapi.tasklist;
    $scope.tasklist = new FilteredTasklist($scope.raw_tasklist, AllFilter, redigest);

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

    var contextFilters = [];
    $scope.createNewTask = function(e) {
        var val = e.target.value;
        e.target.value = '';
        switch (val) {
        case '!debug':
            this.showDebug = !this.showDebug;
            break;
        default:
            if (contextFilters.length)
                val = val + ' @' + contextFilters[0];
            this.tasklist.addTask(val);
        }
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

    $scope.filterByContext = function(ctx, $event) {
        var pos = contextFilters.indexOf(ctx);
        if (pos === -1) {
            if ($event.ctrlKey)
                contextFilters.push(ctx);
            else
                contextFilters = [ctx];
        } else {
            if ($event.ctrlKey || contextFilters.length === 1)
                contextFilters.splice(pos, 1);
            else
                contextFilters = [ctx];
        }
        $scope.tasklist.setContextFilter(contextFilters);
    };

    $scope.getCtxBtnClass = function(ctx) {
        return contextFilters.indexOf(ctx) === -1?
            'context-hidden': 'context-shown';
    };

    $scope.getNewTaskHint = function() {
        if (contextFilters.length)
            return 'New task @' + contextFilters[0];
        else
            return 'New task';
    };

    $scope.showContextLabels = function() {
        return contextFilters.length !== 1;
    };

    $scope.sidebarActive = false;

    $scope.toggleSidebar = function(event) {
        this.sidebarActive = !this.sidebarActive;
        event.stopPropagation();
    };

    $scope.hideSidebar = function() {
        this.sidebarActive = false;
    };

    $scope.applyDescriptor = function(task, value) {
        if (value === '!delete')
            this.deleteTask(task);
        else
            task.applyDescriptor(value);
    };

    $scope.getDueDateClass = function(entry) {
        var dd = entry.dueDate;
        if (dd === null)
            return '';
        return 'item-due-' + entry.dueDate.closeness();
    };

    $scope.showDebug = false;
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

            this.cancelEdit = function() {
                $scope.editting = false;
            };
        },
        link: function($scope, element, attrs) {
            completionAction = $scope.$eval(attrs.inlineEditContext);
            element.on('keydown', function(event) {
                if (event.altKey && !event.ctrlKey && !event.shiftKey &&
                        !event.metaKey && event.keyCode === 13) {
                    $scope.$apply(function() {
                        $scope.beginEdit();
                    });
                }
            });
        },
    };
});

app.directive('inlineEditInput', function($document, $rootScope) {
    return {
        require: '^inlineEditContext',
        link: function(scope, element, attrs, context) {
            var active = false;
            var previousFocus = null;

            function refocus() {
                if (previousFocus) {
                    previousFocus.focus();
                    previousFocus = null;
                }
            }

            function complete() {
                if (active) {
                    $rootScope.$apply(function() {
                        context.completeEdit(element, element.val());
                    });
                    element.hide();
                    active = false;
                }
            }
            
            function cancelEdit() {
                if (active) {
                    $rootScope.$apply(function() {
                        context.cancelEdit(element);
                    });
                    element.hide();
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
                    refocus();
                    break;
                case 27:
                    cancelEdit();
                    refocus();
                    break;
                }
            });
        },
    };
});
