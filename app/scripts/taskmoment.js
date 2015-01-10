'use strict';
/*exported taskmoment*/

var taskmoment = (function(){

function TaskMoment(parts) {
    this.parts = parts;
}

function partsToDate(parts) {
    var p = [null].concat(parts);
    if (p.length === 2)
        p.push(0);
    return new (Date.bind.apply(Date, p))();
}

TaskMoment.prototype.startDate = function() {
    return partsToDate(this.parts);
};

TaskMoment.prototype.stopDate = function() {
    var p = this.parts.slice();
    p[p.length-1] += 1;
    return partsToDate(p);
};

function unabbrev_index(abbrev, choices) {
    for (var i = 0; i < choices.length; ++i) {
        if (choices[i].substr(0, abbrev.length) === abbrev)
            return i;
    }
    return null;
}

function unabbrev(abbrev, choices) {
    var idx = unabbrev_index(abbrev, choices);
    if (idx === null)
        return null;
    return choices[idx];
}

function fromTs(ts, r) {
    var d = typeof ts === 'number'? new Date(ts): ts;
    var parts = [d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds()];
    return new TaskMoment(parts.slice(0, r));
}

TaskMoment.parse = function(s, r) {
    function parseOne(s) {
        return parseInt(s, 10);
    }

    if (s === null)
        return null;

    if (typeof s === 'number')
        return fromTs(s, r || 3);

    if (s instanceof Array)
        return new TaskMoment(s);

    var parts = s.split('-');
    if (parts.length > 1 && parts.length < 6) {
        parts = parts.map(parseOne);
        if (!parts.some(isNaN))
            return new TaskMoment(parts);
    }

    var d, diff;

    // This also catches the empty string as-if it were 'today'
    switch (unabbrev(s, ['today', 'tomorrow', 'now'])) {
    case 'today':
        return fromTs(new Date(), 3);
    case 'tomorrow': {
        d = new Date();
        d.setDate(d.getDate() + 1);
        return fromTs(d, 3);
    }
    case 'now':
        return fromTs(new Date(), 6);
    }

    if (s.length >= 3) {
        var dow = unabbrev_index(s, ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']);
        if (dow !== null) {
            d = new Date();
            diff = dow - d.getDay();
            if (diff < 0)
                diff += 7;
            d.setDate(d.getDate() + diff);
            return fromTs(d, 3);
        }

        var mon = unabbrev_index(s, ['january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december']);
        if (mon !== null) {
            d = new Date();
            diff = mon - d.getMonth();
            if (diff < 0)
                diff += 12;
            d.setMonth(d.getMonth() + diff);
            return fromTs(d, 2);
        }
    }

    if (s.length > 0) {
        var nonDigitIndex = s.length;
        for (var i = 0; i < s.length; ++i) {
            var ch = s.charCodeAt(i);
            if ((0x30 > ch || ch > 0x39) && ch !== 0x2d && ch !== 0x2b) {
                nonDigitIndex = i;
                break;
            }
        }

        var value = parseInt(s.substr(0, nonDigitIndex));
        if (!isNaN(value)) {
            var unit = s.substr(nonDigitIndex);
            if (unit === '')
                unit = 'd';

            var res = new Date();
            switch (unabbrev(unit, ['seconds', 'minutes', 'hours', 'days', 'weeks', 'months', 'Months', 'years'])) {
            case 'seconds':
                res.setSeconds(res.getSeconds() + value, 0);
                return fromTs(res, 6);
            case 'minutes':
                res.setMinutes(res.getMinutes() + value, 0, 0);
                return fromTs(res, 5);
            case 'hours':
                res.setHours(res.getHours() + value, 0, 0, 0);
                return fromTs(res, 4);
            case 'days':
                res.setHours(0, 0, 0, 0);
                res.setDate(res.getDate() + value);
                return fromTs(res, 3);
            case 'weeks':
                res.setHours(0, 0, 0, 0);
                res.setDate(res.getDate() + 7*value);
                return fromTs(res, 3);
            case 'Months':
            case 'months':
                res.setHours(0, 0, 0, 0);
                res.setMonth(res.getMonth() + value, 1);
                return fromTs(res, 2);
            case 'years':
                res.setHours(0, 0, 0, 0);
                res.setFullYear(res.getFullYear() + value, 0, 1);
                return fromTs(res, 1);
            }
        }
    }

    var ts = Date.parse(s);
    if (isNaN(ts))
        return null;
    return fromTs(ts, 3);
};

TaskMoment.parse.now = function(r) {
    r = r || 3;
    return fromTs(Date.now(), r);
};

TaskMoment.prototype.store = function() {
    return this.parts.slice();
};

function diff(tm, basets) {
    function trunc(n) {
        return Math.round(n + 0.5);
    }

    var startDate = tm.startDate();
    var res, now;

    switch (tm.parts.length) {
    case 6:
        res = trunc((startDate.getTime() - basets) / 1000);
        break;
    case 5:
        res = trunc((startDate.getTime() - basets) / 60000);
        break;
    case 4:
        res = trunc((startDate.getTime() - basets) / 3600000);
        break;
    case 3:
        res = trunc((startDate.getTime() - basets) / 86400000);
        break;
    case 2: {
        now = new Date(basets);
        res = (12*startDate.getFullYear() + startDate.getMonth()) -
            (12*now.getFullYear() + now.getMonth());
        break;
    }
    case 1: {
        now = new Date(basets);
        res = startDate.getFullYear() - now.getFullYear();
        break;
    }
    }

    return { value: res, unit: tm.parts.length };
}

TaskMoment.prototype.resolution = function() {
    return this.parts.length;
};

TaskMoment.prototype.isPast = function() {
    return this.stopDate().getTime() < Date.now();
};

TaskMoment.prototype.fromNow = function() {
    var d = diff(this, Date.now());
    var units = ['y', 'M', 'd', 'h', 'm', 's'];

    if (d.value >= 0)
        return '+' + d.value.toString() + units[d.unit-1];
    else
        return d.value.toString() + units[d.unit-1];
};

var dowNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
var monNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

TaskMoment.prototype.fromNowFriendly = function() {
    var nowts = Date.now();
    var d = diff(this, nowts);
    var day, mon;

    if (d.value === -1)
        return ['last year', 'last month', 'yesterday', 'an hour ago', 'a minute ago', 'a second ago'][d.unit-1];

    if (d.unit === 3 && d.value < 0 && d.value > -7) {
        day = (new Date(nowts)).getDay();
        return 'last ' + dowNames[(day + d.value + 7) % 7];
    }

    if (d.unit === 2 && d.value < 0 && d.value > -12) {
        mon = (new Date(nowts)).getMonth();
        return 'last ' + monNames[(mon + d.value + 12) % 12];
    }

    if (d.value < -1) {
        switch (d.unit) {
        case 6:
            return (-d.value).toString() + ' seconds ago';
        case 5:
            return (-d.value).toString() + ' minutes ago';
        case 4:
            return (-d.value).toString() + ' hours ago';
        case 3:
            return (-d.value).toString() + ' days ago';
        case 2:
            return (-d.value).toString() + ' months ago';
        case 1:
            return (-d.value).toString() + ' years ago';
        }
    }

    if (d.value === 0)
        return ['this year', 'this month', 'today', 'now', 'now', 'now'][d.unit-1];

    if (d.value === 1)
        return ['next year', 'next month', 'tomorrow', 'in an hour', 'in a minute', 'in a second'][d.unit-1];

    if (d.unit === 3 && d.value < 7) {
        day = (new Date(nowts)).getDay();
        return dowNames[(day + d.value) % 7];
    }

    if (d.unit === 2 && d.value < 12) {
        mon = (new Date(nowts)).getMonth();
        return 'in ' + monNames[(mon + d.value) % 12];
    }

    switch (d.unit) {
    case 6:
        return 'in ' + d.value.toString() + ' seconds';
    case 5:
        return 'in ' + d.value.toString() + ' minutes';
    case 4:
        return 'in ' + d.value.toString() + ' hours';
    case 3:
        return 'in ' + d.value.toString() + ' days';
    case 2:
        return 'in ' + d.value.toString() + ' months';
    case 1:
        return 'in ' + d.value.toString() + ' years';
    }
};

TaskMoment.prototype.closeness = function() {
    var diff = this.stopDate().getTime() - Date.now();
    if (diff < 0)
        return 'past';
    if (diff < 172800000)
        return 'high';
    if (diff < 604800000)
        return 'med';
    return 'low';
};

return TaskMoment.parse;

}());
