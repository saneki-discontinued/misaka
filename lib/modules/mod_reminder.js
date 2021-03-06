var events = require('events');

var moment;
try {
  moment = require('moment');
} catch(e) {
  throw new Error('`moment` package not installed');
}

function ReminderModule() {
  this.info = {
    name: 'Reminder',
    description: 'State reminders',
    callbacks: {
      join: ReminderModule.prototype.onJoin.bind(this)
    }
  };

  this.reminders = [];
  this.send = undefined;
  this.enabled = true;
}

/**
 * @param {Object} data
 */
ReminderModule.prototype.onJoin = function(data) {
  var roomname = data.room.name,
      config = data.config[roomname];

  this.send = data.send;

  if(config) {
    var reminder = new Reminder(config, [roomname]);
    this.initEvents(reminder);
    this.reminders.push(reminder);
  }
};

/**
 * Initialize the events for a reminder.
 * @param {Reminder} reminder
 */
ReminderModule.prototype.initEvents = function(reminder) {
  var send = this.send,
      _this = this;

  reminder.on('alert', function(alert) {
    if(_this.isEnabled()) {
      send(alert.toString());
    }
  });
};

/**
 * Whether or not sending reminders is enabled.
 * @return {Boolean} true if enabled, false if not
 */
ReminderModule.prototype.isEnabled = function() {
  return this.enabled;
};

/**
 * Set whether or not this module is enabled. If not, will just not
 * send chat events.
 * @param {Boolean} enabled - true if enabled, false if disabled
 */
ReminderModule.prototype.setEnabled = function(enabled) {
  this.enabled = enabled;
};

function Reminder(data, rooms, callback) {
  // Example of 'data':
  // {
  //   name: 'Reminder name',       // Name of reminder
  //   repeat: 'daily',             // When the event repeats (only daily supported for now)
  //   time: '',                    // DateTime String?
  //   alert: [[1, 'hours'],        // When to remind before the event occurs
  //           [30, 'minutes'],
  //           [10, 'minutes']]
  //                                // Always use this timezone?
  // }

  this.data = data;
  this.rooms = rooms;
  this.emitter = new events.EventEmitter();
  this.alerts = [];
  this.setupTimeouts();
};

/**
 * Wrapper method for emitter.on.
 */
Reminder.prototype.on = function() {
  this.emitter.on.apply(this.emitter, arguments);
};

/**
 * Wrapper method for emitter.emit.
 */
Reminder.prototype.emit = function() {
  this.emitter.emit.apply(this.emitter, arguments);
};

/**
 * Get data for alerts.
 * @return {[[Number, String]]}
 */
Reminder.prototype.getAlertsData = function() {
  return this.data.alert;
};

/**
 * Get the reminder's name.
 * @return {String}
 */
Reminder.prototype.getName = function() {
  return this.data.name;
};

/**
 * Get the Moment at which the next event occurs.
 * If daily, it would be either today or tomorrow.
 * Currently assumed daily.
 * @return {Moment}
 */
Reminder.prototype.getNextMoment = function() {
  var eventTime = this.parseTime(this.data.time),
      now = moment(), e = moment();

  //console.log(['eventTime', eventTime]);

  e.hours(eventTime.hour);
  e.minutes(eventTime.minute);
  e.seconds(eventTime.second);

  if(e.isBefore(now)) {
    e.add(1, 'days');
  }

  //var diff = moment.duration(now.diff(e));
  //console.log(['diff', diff.toString()]);

  return e;
};

/**
 * Parse a time string.
 * @param {String} str
 * @return
 */
Reminder.prototype.parseTime = function(str) {
  var patt = /^(\d{1,2})(:\d{1,2}(:\d{1,2})?)?$/,
      match = str.match(patt);

  if(match) {
    var vals = match[0].split(':');

    for(var i = 0; i < vals.length; i++) {
      vals[i] = Number(vals[i]);
    }

    if(vals[0] > 23) vals[0] = 0;
    if(vals[1] > 59) vals[1] = 0;
    if(vals[2] > 59) vals[2] = 0;

    if(vals.length === 1) {
      return { hour: vals[0], minute: 0, second: 0 };
    } else if(vals.length === 2) {
      return { hour: vals[0], minute: vals[1], second: 0 };
    } else {
      return { hour: vals[0], minute: vals[1], second: vals[2] };
    }
  }
};

/**
 * Setup alerts.
 */
Reminder.prototype.setupTimeouts = function() {
  if(this.data.repeat === 'daily') {
    var reminder = this,
        next = this.getNextMoment(),
        alerts = this.getAlertsData();

    // Setup the root alert
    this.rootAlert = new ReminderAlert(reminder, {
      when: next,
      callback: function(alert) {
        reminder.emit('alert', alert);
      }
    });

    alerts.forEach(function(data) {
      var when = moment(next);
      when.subtract(data[0], data[1]);

      var alert = new ReminderAlert(reminder, {
        data: data,
        when: when,
        callback: function(alert) {
          reminder.emit('alert', alert);
        }
      });

      reminder.alerts.push(alert);
    });

  } else {
    // Todo: Use logger
    console.warn('Only \'daily\' repeat for reminders is currently supported, ignoring for room ' + this.rooms[0]);
  }
};

/**
 * @param {Reminder} reminder
 * @param {Object}   opts
 * @param {Object}   opts.data
 * @param {Moment}   opts.when
 * @param {Callback} opts.callback
 */
function ReminderAlert(reminder, opts) {
  if(!opts) opts = {};
  var alertData = opts['data'],
      when = opts['when'],
      callback = opts['callback'];

  this.parent = reminder;
  this.data = alertData;
  this.timeout = undefined;
  this.when = when;
  this.callback = callback;
  this.initTimeout();
}

/**
 * Clear the timeout.
 */
ReminderAlert.prototype.clearTimeout = function() {
  clearTimeout(this.timeout);
};

/**
 * Get the milliseconds until the alert.
 * @return {Number}
 */
ReminderAlert.prototype.getMillisecondsUntil = function() {
  var now = moment(), when = moment(this.when);
  return when.diff(now);
};

/**
 * Initialize the timeout. Will advance once timeout completes.
 */
ReminderAlert.prototype.initTimeout = function() {
  var alert = this, callback = this.callback,
      milli = this.getMillisecondsUntil();

  if(milli >= 0) {
    this.timeout = setTimeout(function() {
      if(callback) {
        callback(alert);
      }
      alert.advance();
    }, milli);
  } else {
    this.advance();
  }
};

/**
 * Advance alert date to the next day and initialize timeout again.
 */
ReminderAlert.prototype.advance = function() {
  this.when.add(1, 'days');
  this.initTimeout();
};

/**
 * Whether or not this is the room alert for a reminder
 * @return {Boolean}
 */
ReminderAlert.prototype.isRoot = function() {
  return !this.data;
};

/**
 * Get a String representation of this alert.
 * @return {String}
 */
ReminderAlert.prototype.toString = function() {
  var name = this.parent.getName();
  if(!this.isRoot()) {
    var val = this.data[0], unit = this.data[1];
    return (val + ' ' + unit + ' until the ' + name + '!');
  } else {
    return ('The ' + name + ' begins now!');
  }
};

module.exports = ReminderModule;
