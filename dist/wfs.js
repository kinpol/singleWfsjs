(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.Wfs = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
EventEmitter.defaultMaxListeners = 10;

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      } else {
        // At least give some kind of context to the user
        var err = new Error('Uncaught, unspecified "error" event. (' + er + ')');
        err.context = er;
        throw err;
      }
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    args = Array.prototype.slice.call(arguments, 1);
    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  // To avoid recursion in the case that type === "newListener"! Before
  // adding it to the listeners, first emit "newListener".
  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    // If we've already got an array, just append.
    this._events[type].push(listener);
  else
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];

  // Check for listener leak
  if (isObject(this._events[type]) && !this._events[type].warned) {
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        // not supported in IE 10
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

// emits a 'removeListener' event iff the listener was removed
EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  // not listening for removeListener, no need to emit
  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  // emit removeListener for all listeners on all events
  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else if (listeners) {
    // LIFO order
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.prototype.listenerCount = function(type) {
  if (this._events) {
    var evlistener = this._events[type];

    if (isFunction(evlistener))
      return 1;
    else if (evlistener)
      return evlistener.length;
  }
  return 0;
};

EventEmitter.listenerCount = function(emitter, type) {
  return emitter.listenerCount(type);
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var BufferController = function (_EventHandler) {
  _inherits(BufferController, _EventHandler);

  function BufferController(wfs) {
    _classCallCheck(this, BufferController);

    var _this = _possibleConstructorReturn(this, (BufferController.__proto__ || Object.getPrototypeOf(BufferController)).call(this, wfs, _events2.default.MEDIA_ATTACHING, _events2.default.BUFFER_APPENDING, _events2.default.BUFFER_RESET));

    _this.mediaSource = null;
    _this.media = null;
    _this.pendingTracks = {};
    _this.sourceBuffer = {};
    _this.segments = [];

    _this.appended = 0;
    _this._msDuration = null;

    _this.onsbue = _this.onSBUpdateEnd.bind(_this);

    _this.browserType = 0;
    if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1) {
      _this.browserType = 1;
    }
    _this.mediaType = 'H264Raw';

    _this.channelName = undefined;
    return _this;
  }

  _createClass(BufferController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onMediaAttaching',
    value: function onMediaAttaching(data) {
      var media = this.media = data.media;
      this.mediaType = data.mediaType;

      this.channelName = data.channelName;
      if (media) {
        var ms = this.mediaSource = new MediaSource();

        this.onmso = this.onMediaSourceOpen.bind(this);
        this.onmse = this.onMediaSourceEnded.bind(this);
        this.onmsc = this.onMediaSourceClose.bind(this);
        ms.addEventListener('sourceopen', this.onmso);
        ms.addEventListener('sourceended', this.onmse);
        ms.addEventListener('sourceclose', this.onmsc);

        media.src = URL.createObjectURL(ms);
      }
    }
  }, {
    key: 'onMediaDetaching',
    value: function onMediaDetaching() {}
  }, {
    key: 'onBufferAppending',
    value: function onBufferAppending(data) {
      console.log('["arraybuffer", data]');
      self.postMessage(["onBufferAppending", data]);
      /*
      if (!this.segments) {
        this.segments = [data];
      } else {
        this.segments.push(data);
      }
      this.doAppending();
      */
    }
  }, {
    key: 'onMediaSourceClose',
    value: function onMediaSourceClose() {
      console.log('media source closed');
    }
  }, {
    key: 'onMediaSourceEnded',
    value: function onMediaSourceEnded() {
      console.log('media source ended');
    }
  }, {
    key: 'onSBUpdateEnd',
    value: function onSBUpdateEnd(event) {
      console.log('self.postMessage(["onSBUpdateEnd", event]);');
      self.postMessage(["onSBUpdateEnd", event]);
/*
      // Firefox
      if (this.browserType === 1) {
        this.mediaSource.endOfStream();
        this.media.play();
      }

      this.appending = false;
      this.doAppending();
      this.updateMediaElementDuration();
*/
    }
  }, {
    key: 'updateMediaElementDuration',
    value: function updateMediaElementDuration() {}
  }, {
    key: 'onMediaSourceOpen',
    value: function onMediaSourceOpen() {
      var mediaSource = this.mediaSource;
      if (mediaSource) {
        mediaSource.removeEventListener('sourceopen', this.onmso);
      }

      if (this.mediaType === 'FMp4') {
        this.checkPendingTracks();
      }
    }
  }, {
    key: 'checkPendingTracks',
    value: function checkPendingTracks() {
      this.createSourceBuffers({ tracks: 'video', mimeType: '' });
      this.pendingTracks = {};
    }
  }, {
    key: 'onBufferReset',
    value: function onBufferReset(data) {
      if (this.mediaType === 'H264Raw') {
        this.createSourceBuffers({ tracks: 'video', mimeType: data.mimeType });
      }
    }
  }, {
    key: 'createSourceBuffers',
    value: function createSourceBuffers(tracks) {
      console.log('["createSourceBuffers", tracks]');
      self.postMessage(["createSourceBuffers", tracks]);
/*
      var sourceBuffer = this.sourceBuffer,
          mediaSource = this.mediaSource;
      var mimeType = void 0;
      if (tracks.mimeType === '') {
        mimeType = 'video/mp4;codecs=avc1.420028';
      } else {
        mimeType = 'video/mp4;codecs=' + tracks.mimeType;
      }

      try {
        var sb = sourceBuffer['video'] = mediaSource.addSourceBuffer(mimeType);
        sb.addEventListener('updateend', this.onsbue);
        track.buffer = sb;
      } catch (err) {}
      this.wfs.trigger(_events2.default.BUFFER_CREATED, { tracks: tracks });
      this.media.play();
*/
    }
  }, {
    key: 'doAppending',
    value: function doAppending() {

      var wfs = this.wfs,
          sourceBuffer = this.sourceBuffer,
          segments = this.segments;
      if (Object.keys(sourceBuffer).length) {

        if (this.media.error) {
          this.segments = [];
          console.log('trying to append although a media error occured, flush segment and abort');
          return;
        }
        if (this.appending) {
          return;
        }

        if (segments && segments.length) {
          var segment = segments.shift();
          try {
            if (sourceBuffer[segment.type]) {
              this.parent = segment.parent;
              sourceBuffer[segment.type].appendBuffer(segment.data);
              this.appendError = 0;
              this.appended++;
              this.appending = true;
            } else {}
          } catch (err) {
            segments.unshift(segment);
            var event = { type: ErrorTypes.MEDIA_ERROR };
            if (err.code !== 22) {
              if (this.appendError) {
                this.appendError++;
              } else {
                this.appendError = 1;
              }
              event.details = ErrorDetails.BUFFER_APPEND_ERROR;
              event.frag = this.fragCurrent;
              if (this.appendError > wfs.config.appendErrorMaxRetry) {
                segments = [];
                event.fatal = true;
                return;
              } else {
                event.fatal = false;
              }
            } else {
              this.segments = [];
              event.details = ErrorDetails.BUFFER_FULL_ERROR;
              return;
            }
          }
        }
      }
    }
  }]);

  return BufferController;
}(_eventHandler2.default);

exports.default = BufferController;

},{"../event-handler":7,"../events":8}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var FlowController = function (_EventHandler) {
  _inherits(FlowController, _EventHandler);

  function FlowController(wfs) {
    _classCallCheck(this, FlowController);

    var _this = _possibleConstructorReturn(this, (FlowController.__proto__ || Object.getPrototypeOf(FlowController)).call(this, wfs, _events2.default.MEDIA_ATTACHED, _events2.default.BUFFER_CREATED, _events2.default.FILE_PARSING_DATA, _events2.default.FILE_HEAD_LOADED, _events2.default.FILE_DATA_LOADED, _events2.default.WEBSOCKET_ATTACHED, _events2.default.FRAG_PARSING_DATA, _events2.default.FRAG_PARSING_INIT_SEGMENT));

    _this.fileStart = 0;
    _this.fileEnd = 0;
    _this.pendingAppending = 0;
    _this.mediaType = undefined;
    channelName: _this.channelName;
    return _this;
  }

  _createClass(FlowController, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onBufferCreated',
    value: function onBufferCreated(data) {
      this.mediaType = data.mediaType;
    }
  }, {
    key: 'onFileHeadLoaded',
    value: function onFileHeadLoaded(data) {}
  }, {
    key: 'onFileDataLoaded',
    value: function onFileDataLoaded(data) {}
  }, {
    key: 'onFileParsingData',
    value: function onFileParsingData(data) {}
  }, {
    key: 'onWebsocketAttached',
    value: function onWebsocketAttached(data) {
      this.wfs.trigger(_events2.default.BUFFER_APPENDING, { type: 'video', data: data.payload, parent: 'main' });
    }
  }, {
    key: 'onFragParsingInitSegment',
    value: function onFragParsingInitSegment(data) {
      var tracks = data.tracks,
          trackName,
          track;

      track = tracks.video;
      if (track) {
        track.id = data.id;
      }

      for (trackName in tracks) {
        track = tracks[trackName];
        var initSegment = track.initSegment;
        if (initSegment) {
          this.pendingAppending++;
          this.wfs.trigger(_events2.default.BUFFER_APPENDING, { type: trackName, data: initSegment, parent: 'main' });
        }
      }
    }
  }, {
    key: 'onFragParsingData',
    value: function onFragParsingData(data) {
      var _this2 = this;

      if (data.type === 'video') {}

      [data.data1, data.data2].forEach(function (buffer) {
        if (buffer) {
          _this2.pendingAppending++;
          _this2.wfs.trigger(_events2.default.BUFFER_APPENDING, { type: data.type, data: buffer, parent: 'main' });
        }
      });
    }
  }]);

  return FlowController;
}(_eventHandler2.default);

exports.default = FlowController;

},{"../event-handler":7,"../events":8}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var ExpGolomb = function () {
  function ExpGolomb(data) {
    _classCallCheck(this, ExpGolomb);

    this.data = data;

    this.bytesAvailable = this.data.byteLength;

    this.word = 0;
    this.bitsAvailable = 0;
  }

  _createClass(ExpGolomb, [{
    key: 'loadWord',
    value: function loadWord() {
      var position = this.data.byteLength - this.bytesAvailable,
          workingBytes = new Uint8Array(4),
          availableBytes = Math.min(4, this.bytesAvailable);
      if (availableBytes === 0) {
        throw new Error('no bytes available');
      }
      workingBytes.set(this.data.subarray(position, position + availableBytes));
      this.word = new DataView(workingBytes.buffer).getUint32(0);

      this.bitsAvailable = availableBytes * 8;
      this.bytesAvailable -= availableBytes;
    }
  }, {
    key: 'skipBits',
    value: function skipBits(count) {
      var skipBytes;
      if (this.bitsAvailable > count) {
        this.word <<= count;
        this.bitsAvailable -= count;
      } else {
        count -= this.bitsAvailable;
        skipBytes = count >> 3;
        count -= skipBytes >> 3;
        this.bytesAvailable -= skipBytes;
        this.loadWord();
        this.word <<= count;
        this.bitsAvailable -= count;
      }
    }
  }, {
    key: 'readBits',
    value: function readBits(size) {
      var bits = Math.min(this.bitsAvailable, size),
          valu = this.word >>> 32 - bits;
      if (size > 32) {
        console.log('Cannot read more than 32 bits at a time');
      }
      this.bitsAvailable -= bits;
      if (this.bitsAvailable > 0) {
        this.word <<= bits;
      } else if (this.bytesAvailable > 0) {
        this.loadWord();
      }
      bits = size - bits;
      if (bits > 0) {
        return valu << bits | this.readBits(bits);
      } else {
        return valu;
      }
    }
  }, {
    key: 'skipLZ',
    value: function skipLZ() {
      var leadingZeroCount;
      for (leadingZeroCount = 0; leadingZeroCount < this.bitsAvailable; ++leadingZeroCount) {
        if (0 !== (this.word & 0x80000000 >>> leadingZeroCount)) {
          this.word <<= leadingZeroCount;
          this.bitsAvailable -= leadingZeroCount;
          return leadingZeroCount;
        }
      }

      this.loadWord();
      return leadingZeroCount + this.skipLZ();
    }
  }, {
    key: 'skipUEG',
    value: function skipUEG() {
      this.skipBits(1 + this.skipLZ());
    }
  }, {
    key: 'skipEG',
    value: function skipEG() {
      this.skipBits(1 + this.skipLZ());
    }
  }, {
    key: 'readUEG',
    value: function readUEG() {
      var clz = this.skipLZ();
      return this.readBits(clz + 1) - 1;
    }
  }, {
    key: 'readEG',
    value: function readEG() {
      var valu = this.readUEG();
      if (0x01 & valu) {
        return 1 + valu >>> 1;
      } else {
        return -1 * (valu >>> 1);
      }
    }
  }, {
    key: 'readBoolean',
    value: function readBoolean() {
      return 1 === this.readBits(1);
    }
  }, {
    key: 'readUByte',
    value: function readUByte() {
      return this.readBits(8);
    }
  }, {
    key: 'readUShort',
    value: function readUShort() {
      return this.readBits(16);
    }
  }, {
    key: 'readUInt',
    value: function readUInt() {
      return this.readBits(32);
    }
  }, {
    key: 'skipScalingList',
    value: function skipScalingList(count) {
      var lastScale = 8,
          nextScale = 8,
          j,
          deltaScale;
      for (j = 0; j < count; j++) {
        if (nextScale !== 0) {
          deltaScale = this.readEG();
          nextScale = (lastScale + deltaScale + 256) % 256;
        }
        lastScale = nextScale === 0 ? lastScale : nextScale;
      }
    }
  }, {
    key: 'readSPS',
    value: function readSPS() {
      var frameCropLeftOffset = 0,
          frameCropRightOffset = 0,
          frameCropTopOffset = 0,
          frameCropBottomOffset = 0,
          sarScale = 1,
          profileIdc,
          profileCompat,
          levelIdc,
          numRefFramesInPicOrderCntCycle,
          picWidthInMbsMinus1,
          picHeightInMapUnitsMinus1,
          frameMbsOnlyFlag,
          scalingListCount,
          i;

      this.readUByte();
      profileIdc = this.readUByte();
      profileCompat = this.readBits(5);
      this.skipBits(3);
      levelIdc = this.readUByte();
      this.skipUEG();
      if (profileIdc === 100 || profileIdc === 110 || profileIdc === 122 || profileIdc === 244 || profileIdc === 44 || profileIdc === 83 || profileIdc === 86 || profileIdc === 118 || profileIdc === 128) {
        var chromaFormatIdc = this.readUEG();
        if (chromaFormatIdc === 3) {
          this.skipBits(1);
        }
        this.skipUEG();
        this.skipUEG();
        this.skipBits(1);
        if (this.readBoolean()) {
          scalingListCount = chromaFormatIdc !== 3 ? 8 : 12;
          for (i = 0; i < scalingListCount; i++) {
            if (this.readBoolean()) {
              if (i < 6) {
                this.skipScalingList(16);
              } else {
                this.skipScalingList(64);
              }
            }
          }
        }
      }
      this.skipUEG();
      var picOrderCntType = this.readUEG();
      if (picOrderCntType === 0) {
        this.readUEG();
      } else if (picOrderCntType === 1) {
        this.skipBits(1);
        this.skipEG();
        this.skipEG();
        numRefFramesInPicOrderCntCycle = this.readUEG();
        for (i = 0; i < numRefFramesInPicOrderCntCycle; i++) {
          this.skipEG();
        }
      }
      this.skipUEG();
      this.skipBits(1);
      picWidthInMbsMinus1 = this.readUEG();
      picHeightInMapUnitsMinus1 = this.readUEG();
      frameMbsOnlyFlag = this.readBits(1);
      if (frameMbsOnlyFlag === 0) {
        this.skipBits(1);
      }
      this.skipBits(1);
      if (this.readBoolean()) {
        frameCropLeftOffset = this.readUEG();
        frameCropRightOffset = this.readUEG();
        frameCropTopOffset = this.readUEG();
        frameCropBottomOffset = this.readUEG();
      }
      if (this.readBoolean()) {
        if (this.readBoolean()) {
          var sarRatio = void 0;
          var aspectRatioIdc = this.readUByte();
          switch (aspectRatioIdc) {
            case 1:
              sarRatio = [1, 1];break;
            case 2:
              sarRatio = [12, 11];break;
            case 3:
              sarRatio = [10, 11];break;
            case 4:
              sarRatio = [16, 11];break;
            case 5:
              sarRatio = [40, 33];break;
            case 6:
              sarRatio = [24, 11];break;
            case 7:
              sarRatio = [20, 11];break;
            case 8:
              sarRatio = [32, 11];break;
            case 9:
              sarRatio = [80, 33];break;
            case 10:
              sarRatio = [18, 11];break;
            case 11:
              sarRatio = [15, 11];break;
            case 12:
              sarRatio = [64, 33];break;
            case 13:
              sarRatio = [160, 99];break;
            case 14:
              sarRatio = [4, 3];break;
            case 15:
              sarRatio = [3, 2];break;
            case 16:
              sarRatio = [2, 1];break;
            case 255:
              {
                sarRatio = [this.readUByte() << 8 | this.readUByte(), this.readUByte() << 8 | this.readUByte()];
                break;
              }
          }
          if (sarRatio) {
            sarScale = sarRatio[0] / sarRatio[1];
          }
        }
      }
      return {
        width: Math.ceil(((picWidthInMbsMinus1 + 1) * 16 - frameCropLeftOffset * 2 - frameCropRightOffset * 2) * sarScale),
        height: (2 - frameMbsOnlyFlag) * (picHeightInMapUnitsMinus1 + 1) * 16 - (frameMbsOnlyFlag ? 2 : 4) * (frameCropTopOffset + frameCropBottomOffset)
      };
    }
  }, {
    key: 'readSliceType',
    value: function readSliceType() {
      this.readUByte();

      this.readUEG();

      return this.readUEG();
    }
  }]);

  return ExpGolomb;
}();

exports.default = ExpGolomb;

},{}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _expGolomb = require('./exp-golomb');

var _expGolomb2 = _interopRequireDefault(_expGolomb);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _mp4Remuxer = require('../remux/mp4-remuxer');

var _mp4Remuxer2 = _interopRequireDefault(_mp4Remuxer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var h264Demuxer = function (_EventHandler) {
  _inherits(h264Demuxer, _EventHandler);

  function h264Demuxer(wfs) {
    var config = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

    _classCallCheck(this, h264Demuxer);

    var _this = _possibleConstructorReturn(this, (h264Demuxer.__proto__ || Object.getPrototypeOf(h264Demuxer)).call(this, wfs, _events2.default.H264_DATA_PARSING));

    _this.config = _this.wfs.config || config;
    _this.wfs = wfs;
    _this.id = 'main';

    _this.remuxer = new _mp4Remuxer2.default(_this.wfs, _this.id, _this.config);
    _this.contiguous = true;
    _this.timeOffset = 1;
    _this.sn = 0;
    _this.TIMESCALE = 90000;
    _this.timestamp = 0;
    _this.scaleFactor = _this.TIMESCALE / 1000;
    _this.H264_TIMEBASE = _this.config.H264_TIMEBASE || 3600;
    _this._avcTrack = { container: 'video/mp2t', type: 'video', id: 1, sequenceNumber: 0,
      samples: [], len: 0, nbNalu: 0, dropped: 0, count: 0 };
    _this.browserType = 0;
    if (navigator.userAgent.toLowerCase().indexOf('firefox') !== -1) {
      _this.browserType = 1;
    }
    return _this;
  }

  _createClass(h264Demuxer, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'getTimestampM',
    value: function getTimestampM() {
      this.timestamp += this.H264_TIMEBASE;
      return this.timestamp;
    }
  }, {
    key: 'onH264DataParsing',
    value: function onH264DataParsing(event) {
      this._parseAVCTrack(event.data);
      if (this.browserType === 1 || this._avcTrack.samples.length >= 20) {
        this.remuxer.pushVideo(0, this.sn, this._avcTrack, this.timeOffset, this.contiguous);
        this.sn += 1;
      }
    }
  }, {
    key: '_parseAVCTrack',
    value: function _parseAVCTrack(array) {
      var _this2 = this;

      var track = this._avcTrack,
          samples = track.samples,
          units = this._parseAVCNALu(array),
          units2 = [],
          debug = false,
          key = false,
          length = 0,
          expGolombDecoder,
          avcSample,
          push,
          i;
      var debugString = '';
      var pushAccesUnit = function () {
        if (units2.length) {
          if (!this.config.forceKeyFrameOnDiscontinuity || key === true || track.sps && (samples.length || this.contiguous)) {
            var tss = this.getTimestampM();
            avcSample = { units: { units: units2, length: length }, pts: tss, dts: tss, key: key };
            samples.push(avcSample);
            track.len += length;
            track.nbNalu += units2.length;
          } else {
            track.dropped++;
          }
          units2 = [];
          length = 0;
        }
      }.bind(this);

      units.forEach(function (unit) {
        switch (unit.type) {
          case 1:
            push = true;
            if (debug) {
              debugString += 'NDR ';
            }
            break;

          case 5:
            push = true;
            if (debug) {
              debugString += 'IDR ';
            }
            key = true;
            break;

          case 6:
            unit.data = _this2.discardEPB(unit.data);
            expGolombDecoder = new _expGolomb2.default(unit.data);

            expGolombDecoder.readUByte();
            break;

          case 7:
            push = false;
            if (debug) {
              debugString += 'SPS ';
            }
            if (!track.sps) {
              expGolombDecoder = new _expGolomb2.default(unit.data);
              var config = expGolombDecoder.readSPS();
              track.width = config.width;
              track.height = config.height;
              track.sps = [unit.data];
              track.duration = 0;
              var codecarray = unit.data.subarray(1, 4);
              var codecstring = 'avc1.';
              for (i = 0; i < 3; i++) {
                var h = codecarray[i].toString(16);
                if (h.length < 2) {
                  h = '0' + h;
                }
                codecstring += h;
              }
              track.codec = codecstring;
              _this2.wfs.trigger(_events2.default.BUFFER_RESET, { mimeType: track.codec });
              push = true;
            }
            break;

          case 8:
            push = false;
            if (debug) {
              debugString += 'PPS ';
            }
            if (!track.pps) {
              track.pps = [unit.data];
              push = true;
            }
            break;
          case 9:
            push = false;
            if (debug) {
              debugString += 'AUD ';
            }
            pushAccesUnit();
            break;
          default:
            push = false;
            debugString += 'unknown NAL ' + unit.type + ' ';
            break;
        }

        if (push) {
          units2.push(unit);
          length += unit.data.byteLength;
        }
      });

      if (debug || debugString.length) {
        console.log(debugString);
      }

      pushAccesUnit();
    }
  }, {
    key: '_parseAVCNALu',
    value: function _parseAVCNALu(array) {
      var i = 0,
          len = array.byteLength,
          value,
          overflow,
          state = 0;
      var units = [],
          unit,
          unitType,
          lastUnitStart,
          lastUnitType;
      while (i < len) {
        value = array[i++];

        switch (state) {
          case 0:
            if (value === 0) {
              state = 1;
            }
            break;
          case 1:
            if (value === 0) {
              state = 2;
            } else {
              state = 0;
            }
            break;
          case 2:
          case 3:
            if (value === 0) {
              state = 3;
            } else if (value === 1 && i < len) {
              unitType = array[i] & 0x1f;
              if (lastUnitStart) {
                unit = { data: array.subarray(lastUnitStart, i - state - 1), type: lastUnitType };
                units.push(unit);
              } else {}
              lastUnitStart = i;
              lastUnitType = unitType;
              state = 0;
            } else {
              state = 0;
            }
            break;
          default:
            break;
        }
      }

      if (lastUnitStart) {
        unit = { data: array.subarray(lastUnitStart, len), type: lastUnitType, state: state };
        units.push(unit);
      }

      return units;
    }
  }, {
    key: 'discardEPB',
    value: function discardEPB(data) {
      var length = data.byteLength,
          EPBPositions = [],
          i = 1,
          newLength,
          newData;

      while (i < length - 2) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0x03) {
          EPBPositions.push(i + 2);
          i += 2;
        } else {
          i++;
        }
      }

      if (EPBPositions.length === 0) {
        return data;
      }

      newLength = length - EPBPositions.length;
      newData = new Uint8Array(newLength);
      var sourceIndex = 0;

      for (i = 0; i < newLength; sourceIndex++, i++) {
        if (sourceIndex === EPBPositions[0]) {
          sourceIndex++;

          EPBPositions.shift();
        }
        newData[i] = data[sourceIndex];
      }
      return newData;
    }
  }]);

  return h264Demuxer;
}(_eventHandler2.default);

exports.default = h264Demuxer;

},{"../event-handler":7,"../events":8,"../remux/mp4-remuxer":12,"./exp-golomb":4}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
var ErrorTypes = exports.ErrorTypes = {
  NETWORK_ERROR: 'networkError',

  MEDIA_ERROR: 'mediaError',

  OTHER_ERROR: 'otherError'
};

var ErrorDetails = exports.ErrorDetails = {
  MANIFEST_LOAD_ERROR: 'manifestLoadError',

  MANIFEST_LOAD_TIMEOUT: 'manifestLoadTimeOut',

  MANIFEST_PARSING_ERROR: 'manifestParsingError',

  MANIFEST_INCOMPATIBLE_CODECS_ERROR: 'manifestIncompatibleCodecsError',

  LEVEL_LOAD_ERROR: 'levelLoadError',

  LEVEL_LOAD_TIMEOUT: 'levelLoadTimeOut',

  LEVEL_SWITCH_ERROR: 'levelSwitchError',

  AUDIO_TRACK_LOAD_ERROR: 'audioTrackLoadError',

  AUDIO_TRACK_LOAD_TIMEOUT: 'audioTrackLoadTimeOut',

  FRAG_LOAD_ERROR: 'fragLoadError',

  FRAG_LOOP_LOADING_ERROR: 'fragLoopLoadingError',

  FRAG_LOAD_TIMEOUT: 'fragLoadTimeOut',

  FRAG_DECRYPT_ERROR: 'fragDecryptError',

  FRAG_PARSING_ERROR: 'fragParsingError',

  KEY_LOAD_ERROR: 'keyLoadError',

  KEY_LOAD_TIMEOUT: 'keyLoadTimeOut',

  BUFFER_ADD_CODEC_ERROR: 'bufferAddCodecError',

  BUFFER_APPEND_ERROR: 'bufferAppendError',

  BUFFER_APPENDING_ERROR: 'bufferAppendingError',

  BUFFER_STALLED_ERROR: 'bufferStalledError',

  BUFFER_FULL_ERROR: 'bufferFullError',

  BUFFER_SEEK_OVER_HOLE: 'bufferSeekOverHole',

  INTERNAL_EXCEPTION: 'internalException'
};

},{}],7:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('./events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var EventHandler = function () {
  function EventHandler(wfs) {
    _classCallCheck(this, EventHandler);

    this.wfs = wfs;
    this.onEvent = this.onEvent.bind(this);

    for (var _len = arguments.length, events = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
      events[_key - 1] = arguments[_key];
    }

    this.handledEvents = events;
    this.useGenericHandler = true;

    this.registerListeners();
  }

  _createClass(EventHandler, [{
    key: 'destroy',
    value: function destroy() {
      this.unregisterListeners();
    }
  }, {
    key: 'isEventHandler',
    value: function isEventHandler() {
      return _typeof(this.handledEvents) === 'object' && this.handledEvents.length && typeof this.onEvent === 'function';
    }
  }, {
    key: 'registerListeners',
    value: function registerListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach(function (event) {
          if (event === 'wfsEventGeneric') {}
          this.wfs.on(event, this.onEvent);
        }.bind(this));
      }
    }
  }, {
    key: 'unregisterListeners',
    value: function unregisterListeners() {
      if (this.isEventHandler()) {
        this.handledEvents.forEach(function (event) {
          this.wfs.off(event, this.onEvent);
        }.bind(this));
      }
    }
  }, {
    key: 'onEvent',
    value: function onEvent(event, data) {
      this.onEventGeneric(event, data);
    }
  }, {
    key: 'onEventGeneric',
    value: function onEventGeneric(event, data) {
      var eventToFunction = function eventToFunction(event, data) {
        var funcName = 'on' + event.replace('wfs', '');
        if (typeof this[funcName] !== 'function') {}
        return this[funcName].bind(this, data);
      };
      try {
        eventToFunction.call(this, event, data).call();
      } catch (err) {
        console.log('internal error happened while processing ' + event + ':' + err.message);
      }
    }
  }]);

  return EventHandler;
}();

exports.default = EventHandler;

},{"./events":8}],8:[function(require,module,exports){
'use strict';

module.exports = {

  MEDIA_ATTACHING: 'wfsMediaAttaching',

  FRAG_LOADING: 'wfsFragLoading',

  BUFFER_CREATED: 'wfsBufferCreated',

  BUFFER_APPENDING: 'wfsBufferAppending',

  BUFFER_RESET: 'wfsBufferReset',

  FRAG_PARSING_DATA: 'wfsFragParsingData',

  FRAG_PARSING_INIT_SEGMENT: 'wfsFragParsingInitSegment',

  H264_DATA_PARSING: 'wfsH264DataParsing',

  WEBSOCKET_ATTACHED: 'wfsWebsocketAttached'
};

},{}],9:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var AAC = function () {
  function AAC() {
    _classCallCheck(this, AAC);
  }

  _createClass(AAC, null, [{
    key: "getSilentFrame",
    value: function getSilentFrame(channelCount) {
      if (channelCount === 1) {
        return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
      } else if (channelCount === 2) {
        return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
      } else if (channelCount === 3) {
        return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
      } else if (channelCount === 4) {
        return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
      } else if (channelCount === 5) {
        return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
      } else if (channelCount === 6) {
        return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
      }
      return null;
    }
  }]);

  return AAC;
}();

exports.default = AAC;

},{}],10:[function(require,module,exports){
'use strict';

module.exports = require('./wfs.js').default;

},{"./wfs.js":14}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MP4 = function () {
  function MP4() {
    _classCallCheck(this, MP4);
  }

  _createClass(MP4, null, [{
    key: 'init',
    value: function init() {
      MP4.types = {
        avc1: [],
        avcC: [],
        btrt: [],
        dinf: [],
        dref: [],
        esds: [],
        ftyp: [],
        hdlr: [],
        mdat: [],
        mdhd: [],
        mdia: [],
        mfhd: [],
        minf: [],
        moof: [],
        moov: [],
        mp4a: [],
        mvex: [],
        mvhd: [],
        sdtp: [],
        stbl: [],
        stco: [],
        stsc: [],
        stsd: [],
        stsz: [],
        stts: [],
        tfdt: [],
        tfhd: [],
        traf: [],
        trak: [],
        trun: [],
        trex: [],
        tkhd: [],
        vmhd: [],
        smhd: []
      };

      var i;
      for (i in MP4.types) {
        if (MP4.types.hasOwnProperty(i)) {
          MP4.types[i] = [i.charCodeAt(0), i.charCodeAt(1), i.charCodeAt(2), i.charCodeAt(3)];
        }
      }

      var videoHdlr = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x76, 0x69, 0x64, 0x65, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x56, 0x69, 0x64, 0x65, 0x6f, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00]);

      var audioHdlr = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x73, 0x6f, 0x75, 0x6e, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x53, 0x6f, 0x75, 0x6e, 0x64, 0x48, 0x61, 0x6e, 0x64, 0x6c, 0x65, 0x72, 0x00]);

      MP4.HDLR_TYPES = {
        'video': videoHdlr,
        'audio': audioHdlr
      };

      var dref = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x0c, 0x75, 0x72, 0x6c, 0x20, 0x00, 0x00, 0x00, 0x01]);

      var stco = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

      MP4.STTS = MP4.STSC = MP4.STCO = stco;

      MP4.STSZ = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      MP4.VMHD = new Uint8Array([0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
      MP4.SMHD = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);

      MP4.STSD = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01]);

      var majorBrand = new Uint8Array([105, 115, 111, 109]);
      var avc1Brand = new Uint8Array([97, 118, 99, 49]);
      var minorVersion = new Uint8Array([0, 0, 0, 1]);

      MP4.FTYP = MP4.box(MP4.types.ftyp, majorBrand, minorVersion, majorBrand, avc1Brand);
      MP4.DINF = MP4.box(MP4.types.dinf, MP4.box(MP4.types.dref, dref));
    }
  }, {
    key: 'box',
    value: function box(type) {
      var payload = Array.prototype.slice.call(arguments, 1),
          size = 8,
          i = payload.length,
          len = i,
          result;

      while (i--) {
        size += payload[i].byteLength;
      }
      result = new Uint8Array(size);
      result[0] = size >> 24 & 0xff;
      result[1] = size >> 16 & 0xff;
      result[2] = size >> 8 & 0xff;
      result[3] = size & 0xff;
      result.set(type, 4);

      for (i = 0, size = 8; i < len; i++) {
        result.set(payload[i], size);
        size += payload[i].byteLength;
      }
      return result;
    }
  }, {
    key: 'hdlr',
    value: function hdlr(type) {
      return MP4.box(MP4.types.hdlr, MP4.HDLR_TYPES[type]);
    }
  }, {
    key: 'mdat',
    value: function mdat(data) {
      return MP4.box(MP4.types.mdat, data);
    }
  }, {
    key: 'mdhd',
    value: function mdhd(timescale, duration) {
      duration *= timescale;
      return MP4.box(MP4.types.mdhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x03, timescale >> 24 & 0xFF, timescale >> 16 & 0xFF, timescale >> 8 & 0xFF, timescale & 0xFF, duration >> 24, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, 0x55, 0xc4, 0x00, 0x00]));
    }
  }, {
    key: 'mdia',
    value: function mdia(track) {
      return MP4.box(MP4.types.mdia, MP4.mdhd(track.timescale, track.duration), MP4.hdlr(track.type), MP4.minf(track));
    }
  }, {
    key: 'mfhd',
    value: function mfhd(sequenceNumber) {
      return MP4.box(MP4.types.mfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, sequenceNumber >> 24, sequenceNumber >> 16 & 0xFF, sequenceNumber >> 8 & 0xFF, sequenceNumber & 0xFF]));
    }
  }, {
    key: 'minf',
    value: function minf(track) {
      if (track.type === 'audio') {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.smhd, MP4.SMHD), MP4.DINF, MP4.stbl(track));
      } else {
        return MP4.box(MP4.types.minf, MP4.box(MP4.types.vmhd, MP4.VMHD), MP4.DINF, MP4.stbl(track));
      }
    }
  }, {
    key: 'moof',
    value: function moof(sn, baseMediaDecodeTime, track) {
      return MP4.box(MP4.types.moof, MP4.mfhd(sn), MP4.traf(track, baseMediaDecodeTime));
    }
  }, {
    key: 'moov',
    value: function moov(tracks) {
      var i = tracks.length,
          boxes = [];

      while (i--) {
        boxes[i] = MP4.trak(tracks[i]);
      }

      return MP4.box.apply(null, [MP4.types.moov, MP4.mvhd(tracks[0].timescale, tracks[0].duration)].concat(boxes).concat(MP4.mvex(tracks)));
    }
  }, {
    key: 'mvex',
    value: function mvex(tracks) {
      var i = tracks.length,
          boxes = [];

      while (i--) {
        boxes[i] = MP4.trex(tracks[i]);
      }
      return MP4.box.apply(null, [MP4.types.mvex].concat(boxes));
    }
  }, {
    key: 'mvhd',
    value: function mvhd(timescale, duration) {
      duration *= timescale;
      var bytes = new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x02, timescale >> 24 & 0xFF, timescale >> 16 & 0xFF, timescale >> 8 & 0xFF, timescale & 0xFF, duration >> 24 & 0xFF, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, 0x00, 0x01, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0xff]);
      return MP4.box(MP4.types.mvhd, bytes);
    }
  }, {
    key: 'sdtp',
    value: function sdtp(track) {
      var samples = track.samples || [],
          bytes = new Uint8Array(4 + samples.length),
          flags,
          i;

      for (i = 0; i < samples.length; i++) {
        flags = samples[i].flags;
        bytes[i + 4] = flags.dependsOn << 4 | flags.isDependedOn << 2 | flags.hasRedundancy;
      }

      return MP4.box(MP4.types.sdtp, bytes);
    }
  }, {
    key: 'stbl',
    value: function stbl(track) {
      return MP4.box(MP4.types.stbl, MP4.stsd(track), MP4.box(MP4.types.stts, MP4.STTS), MP4.box(MP4.types.stsc, MP4.STSC), MP4.box(MP4.types.stsz, MP4.STSZ), MP4.box(MP4.types.stco, MP4.STCO));
    }
  }, {
    key: 'avc1',
    value: function avc1(track) {
      var sps = [],
          pps = [],
          i,
          data,
          len;


      for (i = 0; i < track.sps.length; i++) {
        data = track.sps[i];
        len = data.byteLength;
        sps.push(len >>> 8 & 0xFF);
        sps.push(len & 0xFF);
        sps = sps.concat(Array.prototype.slice.call(data));
      }

      for (i = 0; i < track.pps.length; i++) {
        data = track.pps[i];
        len = data.byteLength;
        pps.push(len >>> 8 & 0xFF);
        pps.push(len & 0xFF);
        pps = pps.concat(Array.prototype.slice.call(data));
      }

      var avcc = MP4.box(MP4.types.avcC, new Uint8Array([0x01, sps[3], sps[4], sps[5], 0xfc | 3, 0xE0 | track.sps.length].concat(sps).concat([track.pps.length]).concat(pps))),
          width = track.width,
          height = track.height;

      return MP4.box(MP4.types.avc1, new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, width >> 8 & 0xFF, width & 0xff, height >> 8 & 0xFF, height & 0xff, 0x00, 0x48, 0x00, 0x00, 0x00, 0x48, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x12, 0x6a, 0x65, 0x66, 0x66, 0x2d, 0x79, 0x61, 0x6e, 0x2f, 0x2f, 0x2f, 0x67, 0x77, 0x66, 0x73, 0x2E, 0x6A, 0x73, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x18, 0x11, 0x11]), avcc, MP4.box(MP4.types.btrt, new Uint8Array([0x00, 0x1c, 0x9c, 0x80, 0x00, 0x2d, 0xc6, 0xc0, 0x00, 0x2d, 0xc6, 0xc0])));
    }
  }, {
    key: 'esds',
    value: function esds(track) {
      var configlen = track.config.length;
      return new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x03, 0x17 + configlen, 0x00, 0x01, 0x00, 0x04, 0x0f + configlen, 0x40, 0x15, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x05].concat([configlen]).concat(track.config).concat([0x06, 0x01, 0x02]));
    }
  }, {
    key: 'mp4a',
    value: function mp4a(track) {
      var audiosamplerate = track.audiosamplerate;
      return MP4.box(MP4.types.mp4a, new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, track.channelCount, 0x00, 0x10, 0x00, 0x00, 0x00, 0x00, audiosamplerate >> 8 & 0xFF, audiosamplerate & 0xff, 0x00, 0x00]), MP4.box(MP4.types.esds, MP4.esds(track)));
    }
  }, {
    key: 'stsd',
    value: function stsd(track) {
      if (track.type === 'audio') {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.mp4a(track));
      } else {
        return MP4.box(MP4.types.stsd, MP4.STSD, MP4.avc1(track));
      }
    }
  }, {
    key: 'tkhd',
    value: function tkhd(track) {
      var id = track.id,
          duration = track.duration * track.timescale,
          width = track.width,
          height = track.height;

      return MP4.box(MP4.types.tkhd, new Uint8Array([0x00, 0x00, 0x00, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, id >> 24 & 0xFF, id >> 16 & 0xFF, id >> 8 & 0xFF, id & 0xFF, 0x00, 0x00, 0x00, 0x00, duration >> 24, duration >> 16 & 0xFF, duration >> 8 & 0xFF, duration & 0xFF, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00, 0x00, width >> 8 & 0xFF, width & 0xFF, 0x00, 0x00, height >> 8 & 0xFF, height & 0xFF, 0x00, 0x00]));
    }
  }, {
    key: 'traf',
    value: function traf(track, baseMediaDecodeTime) {
      var sampleDependencyTable = MP4.sdtp(track),
          id = track.id;

      return MP4.box(MP4.types.traf, MP4.box(MP4.types.tfhd, new Uint8Array([0x00, 0x00, 0x00, 0x00, id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF])), MP4.box(MP4.types.tfdt, new Uint8Array([0x00, 0x00, 0x00, 0x00, baseMediaDecodeTime >> 24, baseMediaDecodeTime >> 16 & 0XFF, baseMediaDecodeTime >> 8 & 0XFF, baseMediaDecodeTime & 0xFF])), MP4.trun(track, sampleDependencyTable.length + 16 + 16 + 8 + 16 + 8 + 8), sampleDependencyTable);
    }
  }, {
    key: 'trak',
    value: function trak(track) {
      track.duration = track.duration || 0xffffffff;
      return MP4.box(MP4.types.trak, MP4.tkhd(track), MP4.mdia(track));
    }
  }, {
    key: 'trex',
    value: function trex(track) {
      var id = track.id;
      return MP4.box(MP4.types.trex, new Uint8Array([0x00, 0x00, 0x00, 0x00, id >> 24, id >> 16 & 0XFF, id >> 8 & 0XFF, id & 0xFF, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01]));
    }
  }, {
    key: 'trun',
    value: function trun(track, offset) {
      var samples = track.samples || [],
          len = samples.length,
          arraylen = 12 + 16 * len,
          array = new Uint8Array(arraylen),
          i,
          sample,
          duration,
          size,
          flags,
          cts;

      offset += 8 + arraylen;
      array.set([0x00, 0x00, 0x0f, 0x01, len >>> 24 & 0xFF, len >>> 16 & 0xFF, len >>> 8 & 0xFF, len & 0xFF, offset >>> 24 & 0xFF, offset >>> 16 & 0xFF, offset >>> 8 & 0xFF, offset & 0xFF], 0);
      for (i = 0; i < len; i++) {
        sample = samples[i];
        duration = sample.duration;
        size = sample.size;
        flags = sample.flags;
        cts = sample.cts;
        array.set([duration >>> 24 & 0xFF, duration >>> 16 & 0xFF, duration >>> 8 & 0xFF, duration & 0xFF, size >>> 24 & 0xFF, size >>> 16 & 0xFF, size >>> 8 & 0xFF, size & 0xFF, flags.isLeading << 2 | flags.dependsOn, flags.isDependedOn << 6 | flags.hasRedundancy << 4 | flags.paddingValue << 1 | flags.isNonSync, flags.degradPrio & 0xF0 << 8, flags.degradPrio & 0x0F, cts >>> 24 & 0xFF, cts >>> 16 & 0xFF, cts >>> 8 & 0xFF, cts & 0xFF], 12 + 16 * i);
      }
      return MP4.box(MP4.types.trun, array);
    }
  }, {
    key: 'initSegment',
    value: function initSegment(tracks) {
      if (!MP4.types) {
        MP4.init();
      }
      var movie = MP4.moov(tracks),
          result;
      result = new Uint8Array(MP4.FTYP.byteLength + movie.byteLength);
      result.set(MP4.FTYP);
      result.set(movie, MP4.FTYP.byteLength);

      return result;
    }
  }]);

  return MP4;
}();

exports.default = MP4;

},{}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _aac = require('../helper/aac');

var _aac2 = _interopRequireDefault(_aac);

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _mp4Generator = require('../remux/mp4-generator');

var _mp4Generator2 = _interopRequireDefault(_mp4Generator);

var _errors = require('../errors');

require('../utils/polyfill');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MP4Remuxer = function () {
  function MP4Remuxer(observer, id, config) {
    _classCallCheck(this, MP4Remuxer);

    this.observer = observer;
    this.id = id;
    this.config = config;
    this.ISGenerated = false;
    this.PES2MP4SCALEFACTOR = 4;
    this.PES_TIMESCALE = 90000;
    this.MP4_TIMESCALE = this.PES_TIMESCALE / this.PES2MP4SCALEFACTOR;
    this.nextAvcDts = 90300;
    this.H264_TIMEBASE = config.H264_TIMEBASE || 3600;
  }

  _createClass(MP4Remuxer, [{
    key: 'destroy',
    value: function destroy() {}
  }, {
    key: 'insertDiscontinuity',
    value: function insertDiscontinuity() {
      this._initPTS = this._initDTS = undefined;
    }
  }, {
    key: 'switchLevel',
    value: function switchLevel() {
      this.ISGenerated = false;
    }
  }, {
    key: 'pushVideo',
    value: function pushVideo(level, sn, videoTrack, timeOffset, contiguous) {
      this.level = level;
      this.sn = sn;
      var videoData = void 0;

      if (!this.ISGenerated) {
        this.generateVideoIS(videoTrack, timeOffset);
      }
      if (this.ISGenerated) {
        if (videoTrack.samples.length) {
          this.remuxVideo_2(videoTrack, timeOffset, contiguous);
        }
      }
    }
  }, {
    key: 'remuxVideo_2',
    value: function remuxVideo_2(track, timeOffset, contiguous, audioTrackLength) {
      var offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
          mp4SampleDuration,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          nextDTS,
          inputSamples = track.samples,
          outputSamples = [];

      mdat = new Uint8Array(track.len + 4 * track.nbNalu + 8);
      var view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_mp4Generator2.default.types.mdat, 4);
      var sampleDuration = 0;
      var ptsnorm = void 0,
          dtsnorm = void 0,
          mp4Sample = void 0,
          lastDTS = void 0;

      for (var i = 0; i < inputSamples.length; i++) {
        var avcSample = inputSamples[i],
            mp4SampleLength = 0,
            compositionTimeOffset = void 0;

        while (avcSample.units.units.length) {
          var unit = avcSample.units.units.shift();
          view.setUint32(offset, unit.data.byteLength);
          offset += 4;
          mdat.set(unit.data, offset);
          offset += unit.data.byteLength;
          mp4SampleLength += 4 + unit.data.byteLength;
        }

        var pts = avcSample.pts - this._initPTS;
        var dts = avcSample.dts - this._initDTS;
        dts = Math.min(pts, dts);

        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          sampleDuration = dtsnorm - lastDTS;
          if (sampleDuration <= 0) {
            console.log('invalid sample duration at PTS/DTS: ' + avcSample.pts + '/' + avcSample.dts + '|dts norm: ' + dtsnorm + '|lastDTS: ' + lastDTS + ':' + sampleDuration);
            sampleDuration = 1;
          }
        } else {
          var nextAvcDts = this.nextAvcDts,
              delta;
          ptsnorm = this._PTSNormalize(pts, nextAvcDts);
          dtsnorm = this._PTSNormalize(dts, nextAvcDts);
          if (nextAvcDts) {
            delta = Math.round(dtsnorm - nextAvcDts);
            if (Math.abs(delta) < 600) {
              if (delta) {
                if (delta > 1) {
                  console.log('AVC:' + delta + ' ms hole between fragments detected,filling it');
                } else if (delta < -1) {
                  console.log('AVC:' + -delta + ' ms overlapping between fragments detected');
                }
                dtsnorm = nextAvcDts;
                ptsnorm = Math.max(ptsnorm - delta, dtsnorm);
                console.log('Video/PTS/DTS adjusted: ' + ptsnorm + '/' + dtsnorm + ',delta:' + delta);
              }
            }
          }
          this.firstPTS = Math.max(0, ptsnorm);
          this.firstDTS = Math.max(0, dtsnorm);
          sampleDuration = 0.03;
        }

        outputSamples.push({
          size: mp4SampleLength,
          duration: this.H264_TIMEBASE,
          cts: 0,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0,
            dependsOn: avcSample.key ? 2 : 1,
            isNonSync: avcSample.key ? 0 : 1
          }
        });
        lastDTS = dtsnorm;
      }

      var lastSampleDuration = 0;
      if (outputSamples.length >= 2) {
        lastSampleDuration = outputSamples[outputSamples.length - 2].duration;
        outputSamples[0].duration = lastSampleDuration;
      }
      this.nextAvcDts = dtsnorm + lastSampleDuration;
      var dropped = track.dropped;
      track.len = 0;
      track.nbNalu = 0;
      track.dropped = 0;
      if (outputSamples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
        var flags = outputSamples[0].flags;
        flags.dependsOn = 2;
        flags.isNonSync = 0;
      }
      track.samples = outputSamples;
      moof = _mp4Generator2.default.moof(track.sequenceNumber++, dtsnorm, track);
      track.samples = [];

      var data = {
        id: this.id,
        level: this.level,
        sn: this.sn,
        data1: moof,
        data2: mdat,
        startPTS: ptsnorm,
        endPTS: ptsnorm,
        startDTS: dtsnorm,
        endDTS: dtsnorm,
        type: 'video',
        nb: outputSamples.length,
        dropped: dropped
      };

      this.observer.trigger(_events2.default.FRAG_PARSING_DATA, data);
      return data;
    }
  }, {
    key: 'generateVideoIS',
    value: function generateVideoIS(videoTrack, timeOffset) {
      var observer = this.observer,
          videoSamples = videoTrack.samples,
          pesTimeScale = this.PES_TIMESCALE,
          tracks = {},
          data = { id: this.id, level: this.level, sn: this.sn, tracks: tracks, unique: false },
          computePTSDTS = this._initPTS === undefined,
          initPTS,
          initDTS;

      if (computePTSDTS) {
        initPTS = initDTS = Infinity;
      }

      if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
        videoTrack.timescale = 90000;
        tracks.video = {
          container: 'video/mp4',
          codec: videoTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([videoTrack]),
          metadata: {
            width: videoTrack.width,
            height: videoTrack.height
          }
        };
        if (computePTSDTS) {
          initPTS = Math.min(initPTS, videoSamples[0].pts - this.H264_TIMEBASE);
          initDTS = Math.min(initDTS, videoSamples[0].dts - this.H264_TIMEBASE);
        }
      }

      if (Object.keys(tracks).length) {
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
        this.ISGenerated = true;
        if (computePTSDTS) {
          this._initPTS = initPTS;
          this._initDTS = initDTS;
        }
      } else {
        console.log("generateVideoIS ERROR==> ", _errors.ErrorTypes.MEDIA_ERROR);
      }
    }
  }, {
    key: 'remux',
    value: function remux(level, sn, audioTrack, videoTrack, id3Track, textTrack, timeOffset, contiguous) {
      this.level = level;
      this.sn = sn;

      if (!this.ISGenerated) {
        this.generateIS(audioTrack, videoTrack, timeOffset);
      }

      if (this.ISGenerated) {
        if (audioTrack.samples.length) {
          var audioData = this.remuxAudio(audioTrack, timeOffset, contiguous);

          if (videoTrack.samples.length) {
            var audioTrackLength = void 0;
            if (audioData) {
              audioTrackLength = audioData.endPTS - audioData.startPTS;
            }
            this.remuxVideo(videoTrack, timeOffset, contiguous, audioTrackLength);
          }
        } else {
          var videoData = void 0;

          if (videoTrack.samples.length) {
            videoData = this.remuxVideo(videoTrack, timeOffset, contiguous);
          }
          if (videoData && audioTrack.codec) {
            this.remuxEmptyAudio(audioTrack, timeOffset, contiguous, videoData);
          }
        }
      }

      if (id3Track.samples.length) {
        this.remuxID3(id3Track, timeOffset);
      }

      if (textTrack.samples.length) {
        this.remuxText(textTrack, timeOffset);
      }

      this.observer.trigger(_events2.default.FRAG_PARSED, { id: this.id, level: this.level, sn: this.sn });
    }
  }, {
    key: 'generateIS',
    value: function generateIS(audioTrack, videoTrack, timeOffset) {
      var observer = this.observer,
          audioSamples = audioTrack.samples,
          videoSamples = videoTrack.samples,
          pesTimeScale = this.PES_TIMESCALE,
          tracks = {},
          data = { id: this.id, level: this.level, sn: this.sn, tracks: tracks, unique: false },
          computePTSDTS = this._initPTS === undefined,
          initPTS,
          initDTS;

      if (computePTSDTS) {
        initPTS = initDTS = Infinity;
      }
      if (audioTrack.config && audioSamples.length) {
        audioTrack.timescale = audioTrack.audiosamplerate;

        if (audioTrack.timescale * audioTrack.duration > Math.pow(2, 32)) {
          var greatestCommonDivisor = function greatestCommonDivisor(a, b) {
            if (!b) {
              return a;
            }
            return greatestCommonDivisor(b, a % b);
          };
          audioTrack.timescale = audioTrack.audiosamplerate / greatestCommonDivisor(audioTrack.audiosamplerate, 1024);
        }
        console.log('audio mp4 timescale :' + audioTrack.timescale);
        tracks.audio = {
          container: 'audio/mp4',
          codec: audioTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([audioTrack]),
          metadata: {
            channelCount: audioTrack.channelCount
          }
        };
        if (computePTSDTS) {
          initPTS = initDTS = audioSamples[0].pts - pesTimeScale * timeOffset;
        }
      }

      if (videoTrack.sps && videoTrack.pps && videoSamples.length) {
        videoTrack.timescale = this.MP4_TIMESCALE;
        tracks.video = {
          container: 'video/mp4',
          codec: videoTrack.codec,
          initSegment: _mp4Generator2.default.initSegment([videoTrack]),
          metadata: {
            width: videoTrack.width,
            height: videoTrack.height
          }
        };
        if (computePTSDTS) {
          initPTS = Math.min(initPTS, videoSamples[0].pts - pesTimeScale * timeOffset);
          initDTS = Math.min(initDTS, videoSamples[0].dts - pesTimeScale * timeOffset);
        }
      }

      if (Object.keys(tracks).length) {
        observer.trigger(_events2.default.FRAG_PARSING_INIT_SEGMENT, data);
        this.ISGenerated = true;
        if (computePTSDTS) {
          this._initPTS = initPTS;
          this._initDTS = initDTS;
        }
      } else {
        observer.trigger(_events2.default.ERROR, { type: _errors.ErrorTypes.MEDIA_ERROR, id: this.id, details: _errors.ErrorDetails.FRAG_PARSING_ERROR, fatal: false, reason: 'no audio/video samples found' });
      }
    }
  }, {
    key: 'remuxVideo',
    value: function remuxVideo(track, timeOffset, contiguous, audioTrackLength) {
      var offset = 8,
          pesTimeScale = this.PES_TIMESCALE,
          pes2mp4ScaleFactor = this.PES2MP4SCALEFACTOR,
          mp4SampleDuration,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          nextDTS,
          lastPTS,
          lastDTS,
          inputSamples = track.samples,
          outputSamples = [];

      var nextAvcDts = void 0;
      if (contiguous) {
        nextAvcDts = this.nextAvcDts;
      } else {
        nextAvcDts = timeOffset * pesTimeScale;
      }

      var sample = inputSamples[0];
      firstDTS = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS, 0);
      firstPTS = Math.max(this._PTSNormalize(sample.pts, nextAvcDts) - this._initDTS, 0);

      var delta = Math.round((firstDTS - nextAvcDts) / 90);

      if (contiguous) {
        if (delta) {
          if (delta > 1) {
            console.log('AVC:' + delta + ' ms hole between fragments detected,filling it');
          } else if (delta < -1) {
            console.log('AVC:' + -delta + ' ms overlapping between fragments detected');
          }

          firstDTS = nextAvcDts;
          inputSamples[0].dts = firstDTS + this._initDTS;

          firstPTS = Math.max(firstPTS - delta, nextAvcDts);
          inputSamples[0].pts = firstPTS + this._initDTS;
          console.log('Video/PTS/DTS adjusted: ' + firstPTS + '/' + firstDTS + ',delta:' + delta);
        }
      }
      nextDTS = firstDTS;

      sample = inputSamples[inputSamples.length - 1];
      lastDTS = Math.max(this._PTSNormalize(sample.dts, nextAvcDts) - this._initDTS, 0);
      lastPTS = Math.max(this._PTSNormalize(sample.pts, nextAvcDts) - this._initDTS, 0);
      lastPTS = Math.max(lastPTS, lastDTS);

      var vendor = navigator.vendor,
          userAgent = navigator.userAgent,
          isSafari = vendor && vendor.indexOf('Apple') > -1 && userAgent && !userAgent.match('CriOS');

      if (isSafari) {
        mp4SampleDuration = Math.round((lastDTS - firstDTS) / (pes2mp4ScaleFactor * (inputSamples.length - 1)));
      }

      for (var i = 0; i < inputSamples.length; i++) {
        var _sample = inputSamples[i];
        if (isSafari) {
          _sample.dts = firstDTS + i * pes2mp4ScaleFactor * mp4SampleDuration;
        } else {
          _sample.dts = Math.max(this._PTSNormalize(_sample.dts, nextAvcDts) - this._initDTS, firstDTS);

          _sample.dts = Math.round(_sample.dts / pes2mp4ScaleFactor) * pes2mp4ScaleFactor;
        }

        _sample.pts = Math.max(this._PTSNormalize(_sample.pts, nextAvcDts) - this._initDTS, _sample.dts);

        _sample.pts = Math.round(_sample.pts / pes2mp4ScaleFactor) * pes2mp4ScaleFactor;
      }

      mdat = new Uint8Array(track.len + 4 * track.nbNalu + 8);
      var view = new DataView(mdat.buffer);
      view.setUint32(0, mdat.byteLength);
      mdat.set(_mp4Generator2.default.types.mdat, 4);

      for (var _i = 0; _i < inputSamples.length; _i++) {
        var avcSample = inputSamples[_i],
            mp4SampleLength = 0,
            compositionTimeOffset = void 0;

        while (avcSample.units.units.length) {
          var unit = avcSample.units.units.shift();
          view.setUint32(offset, unit.data.byteLength);
          offset += 4;
          mdat.set(unit.data, offset);
          offset += unit.data.byteLength;
          mp4SampleLength += 4 + unit.data.byteLength;
        }

        if (!isSafari) {
          if (_i < inputSamples.length - 1) {
            mp4SampleDuration = inputSamples[_i + 1].dts - avcSample.dts;
          } else {
            var config = this.config,
                lastFrameDuration = avcSample.dts - inputSamples[_i > 0 ? _i - 1 : _i].dts;
            if (config.stretchShortVideoTrack) {
              var maxBufferHole = config.maxBufferHole,
                  maxSeekHole = config.maxSeekHole,
                  gapTolerance = Math.floor(Math.min(maxBufferHole, maxSeekHole) * pesTimeScale),
                  deltaToFrameEnd = (audioTrackLength ? firstPTS + audioTrackLength * pesTimeScale : this.nextAacPts) - avcSample.pts;
              if (deltaToFrameEnd > gapTolerance) {
                mp4SampleDuration = deltaToFrameEnd - lastFrameDuration;
                if (mp4SampleDuration < 0) {
                  mp4SampleDuration = lastFrameDuration;
                }
                console.log('It is approximately ' + deltaToFrameEnd / 90 + ' ms to the next segment; using duration ' + mp4SampleDuration / 90 + ' ms for the last video frame.');
              } else {
                mp4SampleDuration = lastFrameDuration;
              }
            } else {
              mp4SampleDuration = lastFrameDuration;
            }
          }
          mp4SampleDuration /= pes2mp4ScaleFactor;
          compositionTimeOffset = Math.round((avcSample.pts - avcSample.dts) / pes2mp4ScaleFactor);
        } else {
          compositionTimeOffset = Math.max(0, mp4SampleDuration * Math.round((avcSample.pts - avcSample.dts) / (pes2mp4ScaleFactor * mp4SampleDuration)));
        }
        outputSamples.push({
          size: mp4SampleLength,

          duration: mp4SampleDuration,
          cts: compositionTimeOffset,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0,
            dependsOn: avcSample.key ? 2 : 1,
            isNonSync: avcSample.key ? 0 : 1
          }
        });
      }

      this.nextAvcDts = lastDTS + mp4SampleDuration * pes2mp4ScaleFactor;
      var dropped = track.dropped;
      track.len = 0;
      track.nbNalu = 0;
      track.dropped = 0;
      if (outputSamples.length && navigator.userAgent.toLowerCase().indexOf('chrome') > -1) {
        var flags = outputSamples[0].flags;

        flags.dependsOn = 2;
        flags.isNonSync = 0;
      }
      track.samples = outputSamples;
      moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
      track.samples = [];

      var data = {
        id: this.id,
        level: this.level,
        sn: this.sn,
        data1: moof,
        data2: mdat,
        startPTS: firstPTS / pesTimeScale,
        endPTS: (lastPTS + pes2mp4ScaleFactor * mp4SampleDuration) / pesTimeScale,
        startDTS: firstPTS / pesTimeScale,
        endDTS: (lastPTS + pes2mp4ScaleFactor * mp4SampleDuration) / pesTimeScale,

        type: 'video',
        nb: outputSamples.length,
        dropped: dropped
      };
      this.observer.trigger(_events2.default.FRAG_PARSING_DATA, data);
      return data;
    }
  }, {
    key: 'remuxAudio',
    value: function remuxAudio(track, timeOffset, contiguous) {
      var pesTimeScale = this.PES_TIMESCALE,
          mp4timeScale = track.timescale,
          pes2mp4ScaleFactor = pesTimeScale / mp4timeScale,
          expectedSampleDuration = track.timescale * 1024 / track.audiosamplerate;
      var view,
          offset = 8,
          aacSample,
          mp4Sample,
          unit,
          mdat,
          moof,
          firstPTS,
          firstDTS,
          lastDTS,
          pts,
          dts,
          ptsnorm,
          dtsnorm,
          samples = [],
          samples0 = [];

      track.samples.sort(function (a, b) {
        return a.pts - b.pts;
      });
      samples0 = track.samples;

      var nextAacPts = contiguous ? this.nextAacPts : timeOffset * pesTimeScale;

      var firstPtsNorm = this._PTSNormalize(samples0[0].pts - this._initPTS, nextAacPts),
          pesFrameDuration = expectedSampleDuration * pes2mp4ScaleFactor;
      var nextPtsNorm = firstPtsNorm + pesFrameDuration;
      for (var i = 1; i < samples0.length;) {
        var sample = samples0[i],
            ptsNorm = this._PTSNormalize(sample.pts - this._initPTS, nextAacPts),
            delta = ptsNorm - nextPtsNorm;

        if (delta < -0.5 * pesFrameDuration) {
          console.log('Dropping frame due to ' + Math.abs(delta / 90) + ' ms overlap.');
          samples0.splice(i, 1);
          track.len -= sample.unit.length;
        } else if (delta > 0.5 * pesFrameDuration) {
            var missing = Math.round(delta / pesFrameDuration);
            console.log('Injecting ' + missing + ' frame' + (missing > 1 ? 's' : '') + ' of missing audio due to ' + Math.round(delta / 90) + ' ms gap.');
            for (var j = 0; j < missing; j++) {
              var newStamp = samples0[i - 1].pts + pesFrameDuration,
                  fillFrame = _aac2.default.getSilentFrame(track.channelCount);
              if (!fillFrame) {
                console.log('Unable to get silent frame for given audio codec; duplicating last frame instead.');
                fillFrame = sample.unit.slice(0);
              }
              samples0.splice(i, 0, { unit: fillFrame, pts: newStamp, dts: newStamp });
              track.len += fillFrame.length;
              i += 1;
            }

            nextPtsNorm += (missing + 1) * pesFrameDuration;
            sample.pts = samples0[i - 1].pts + pesFrameDuration;
            i += 1;
          } else {
              if (Math.abs(delta) > 0.1 * pesFrameDuration) {
                console.log('Invalid frame delta ' + (ptsNorm - nextPtsNorm + pesFrameDuration) + ' at PTS ' + Math.round(ptsNorm / 90) + ' (should be ' + pesFrameDuration + ').');
              }
              nextPtsNorm += pesFrameDuration;
              sample.pts = samples0[i - 1].pts + pesFrameDuration;
              i += 1;
            }
      }

      while (samples0.length) {
        aacSample = samples0.shift();
        unit = aacSample.unit;
        pts = aacSample.pts - this._initDTS;
        dts = aacSample.dts - this._initDTS;

        if (lastDTS !== undefined) {
          ptsnorm = this._PTSNormalize(pts, lastDTS);
          dtsnorm = this._PTSNormalize(dts, lastDTS);
          mp4Sample.duration = (dtsnorm - lastDTS) / pes2mp4ScaleFactor;
        } else {
          ptsnorm = this._PTSNormalize(pts, nextAacPts);
          dtsnorm = this._PTSNormalize(dts, nextAacPts);
          var _delta = Math.round(1000 * (ptsnorm - nextAacPts) / pesTimeScale);

          if (contiguous) {
            if (_delta) {
              if (_delta > 0) {
                console.log(_delta + ' ms hole between AAC samples detected,filling it');
              } else if (_delta < -12) {
                console.log(-_delta + ' ms overlapping between AAC samples detected, drop frame');
                track.len -= unit.byteLength;
                continue;
              }

              ptsnorm = dtsnorm = nextAacPts;
            }
          }

          firstPTS = Math.max(0, ptsnorm);
          firstDTS = Math.max(0, dtsnorm);
          if (track.len > 0) {
            mdat = new Uint8Array(track.len + 8);
            view = new DataView(mdat.buffer);
            view.setUint32(0, mdat.byteLength);
            mdat.set(_mp4Generator2.default.types.mdat, 4);
          } else {
            return;
          }
        }
        mdat.set(unit, offset);
        offset += unit.byteLength;

        mp4Sample = {
          size: unit.byteLength,
          cts: 0,
          duration: 0,
          flags: {
            isLeading: 0,
            isDependedOn: 0,
            hasRedundancy: 0,
            degradPrio: 0,
            dependsOn: 1
          }
        };
        samples.push(mp4Sample);
        lastDTS = dtsnorm;
      }
      var lastSampleDuration = 0;
      var nbSamples = samples.length;

      if (nbSamples >= 2) {
        lastSampleDuration = samples[nbSamples - 2].duration;
        mp4Sample.duration = lastSampleDuration;
      }
      if (nbSamples) {
        this.nextAacPts = ptsnorm + pes2mp4ScaleFactor * lastSampleDuration;

        track.len = 0;
        track.samples = samples;
        moof = _mp4Generator2.default.moof(track.sequenceNumber++, firstDTS / pes2mp4ScaleFactor, track);
        track.samples = [];
        var audioData = {
          id: this.id,
          level: this.level,
          sn: this.sn,
          data1: moof,
          data2: mdat,
          startPTS: firstPTS / pesTimeScale,
          endPTS: this.nextAacPts / pesTimeScale,
          startDTS: firstDTS / pesTimeScale,
          endDTS: (dtsnorm + pes2mp4ScaleFactor * lastSampleDuration) / pesTimeScale,
          type: 'audio',
          nb: nbSamples
        };
        this.observer.trigger(_events2.default.FRAG_PARSING_DATA, audioData);
        return audioData;
      }
      return null;
    }
  }, {
    key: 'remuxEmptyAudio',
    value: function remuxEmptyAudio(track, timeOffset, contiguous, videoData) {
      var pesTimeScale = this.PES_TIMESCALE,
          mp4timeScale = track.timescale ? track.timescale : track.audiosamplerate,
          pes2mp4ScaleFactor = pesTimeScale / mp4timeScale,
          startDTS = videoData.startDTS * pesTimeScale + this._initDTS,
          endDTS = videoData.endDTS * pesTimeScale + this._initDTS,
          sampleDuration = 1024,
          frameDuration = pes2mp4ScaleFactor * sampleDuration,
          nbSamples = Math.ceil((endDTS - startDTS) / frameDuration),
          silentFrame = _aac2.default.getSilentFrame(track.channelCount);

      if (!silentFrame) {
        console.trace('Unable to remuxEmptyAudio since we were unable to get a silent frame for given audio codec!');
        return;
      }

      var samples = [];
      for (var i = 0; i < nbSamples; i++) {
        var stamp = startDTS + i * frameDuration;
        samples.push({ unit: silentFrame.slice(0), pts: stamp, dts: stamp });
        track.len += silentFrame.length;
      }
      track.samples = samples;

      this.remuxAudio(track, timeOffset, contiguous);
    }
  }, {
    key: 'remuxID3',
    value: function remuxID3(track, timeOffset) {
      var length = track.samples.length,
          sample;

      if (length) {
        for (var index = 0; index < length; index++) {
          sample = track.samples[index];

          sample.pts = (sample.pts - this._initPTS) / this.PES_TIMESCALE;
          sample.dts = (sample.dts - this._initDTS) / this.PES_TIMESCALE;
        }
        this.observer.trigger(_events2.default.FRAG_PARSING_METADATA, {
          id: this.id,
          level: this.level,
          sn: this.sn,
          samples: track.samples
        });
      }

      track.samples = [];
      timeOffset = timeOffset;
    }
  }, {
    key: 'remuxText',
    value: function remuxText(track, timeOffset) {
      track.samples.sort(function (a, b) {
        return a.pts - b.pts;
      });

      var length = track.samples.length,
          sample;

      if (length) {
        for (var index = 0; index < length; index++) {
          sample = track.samples[index];

          sample.pts = (sample.pts - this._initPTS) / this.PES_TIMESCALE;
        }
        this.observer.trigger(_events2.default.FRAG_PARSING_USERDATA, {
          id: this.id,
          level: this.level,
          sn: this.sn,
          samples: track.samples
        });
      }

      track.samples = [];
      timeOffset = timeOffset;
    }
  }, {
    key: '_PTSNormalize',
    value: function _PTSNormalize(value, reference) {
      var offset;
      if (reference === undefined) {
        return value;
      }
      if (reference < value) {
        offset = -8589934592;
      } else {
        offset = 8589934592;
      }

      while (Math.abs(value - reference) > 4294967296) {
        value += offset;
      }
      return value;
    }
  }, {
    key: 'passthrough',
    get: function get() {
      return false;
    }
  }]);

  return MP4Remuxer;
}();

exports.default = MP4Remuxer;

},{"../errors":6,"../events":8,"../helper/aac":9,"../remux/mp4-generator":11,"../utils/polyfill":13}],13:[function(require,module,exports){
'use strict';

if (typeof ArrayBuffer !== 'undefined' && !ArrayBuffer.prototype.slice) {
  ArrayBuffer.prototype.slice = function (start, end) {
    var that = new Uint8Array(this);
    if (end === undefined) {
      end = that.length;
    }
    var result = new ArrayBuffer(end - start);
    var resultArray = new Uint8Array(result);
    for (var i = 0; i < resultArray.length; i++) {
      resultArray[i] = that[i + start];
    }
    return result;
  };
}

},{}],14:[function(require,module,exports){

'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('./events');

var _events2 = _interopRequireDefault(_events);

var _flowController = require('./controller/flow-controller');

var _flowController2 = _interopRequireDefault(_flowController);

var _bufferController = require('./controller/buffer-controller');

var _bufferController2 = _interopRequireDefault(_bufferController);

var _events3 = require('events');

var _events4 = _interopRequireDefault(_events3);

var _h264Demuxer = require('./demux/h264-demuxer');

var _h264Demuxer2 = _interopRequireDefault(_h264Demuxer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Wfs = function () {
  _createClass(Wfs, null, [{
    key: 'isSupported',
    value: function isSupported() {
      return window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function' && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42c01f,mp4a.40.2"');
    }
  }, {
    key: 'version',
    get: function get() {
      return '' + 'v.0.0.0.1';
    }
  }, {
    key: 'Events',
    get: function get() {
      return _events2.default;
    }
  }, {
    key: 'DefaultConfig',
    get: function get() {
      if (!Wfs.defaultConfig) {
        Wfs.defaultConfig = {
          debug: false,
          H264_TIMEBASE: 3600,


          forceKeyFrameOnDiscontinuity: true,
          appendErrorMaxRetry: 3
        };
      }
      return Wfs.defaultConfig;
    },
    set: function set(defaultConfig) {
      Wfs.defaultConfig = defaultConfig;
    }
  }]);

  function Wfs() {
    var config = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    _classCallCheck(this, Wfs);

    var defaultConfig = Wfs.DefaultConfig;
    for (var prop in defaultConfig) {
      if (prop in config) {
        continue;
      }
      config[prop] = defaultConfig[prop];
    }
    this.config = config;

    var observer = this.observer = new _events4.default();
    observer.trigger = function trigger(event) {
      for (var _len = arguments.length, data = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        data[_key - 1] = arguments[_key];
      }

      observer.emit.apply(observer, [event, event].concat(data));
    };

    observer.off = function off(event) {
      for (var _len2 = arguments.length, data = Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        data[_key2 - 1] = arguments[_key2];
      }

      observer.removeListener.apply(observer, [event].concat(data));
    };
    this.on = observer.on.bind(observer);
    this.off = observer.off.bind(observer);
    this.trigger = observer.trigger.bind(observer);

    this.flowController = new _flowController2.default(this);
    this.bufferController = new _bufferController2.default(this);
    this.h264Demuxer = new _h264Demuxer2.default(this);

    this.mediaType = 'H264Raw';
  }

  _createClass(Wfs, [{
    key: 'destroy',
    value: function destroy() {
      this.flowController.destroy();
      this.bufferController.destroy();
    }
  }, {
    key: 'attachMedia',
    value: function attachMedia(media) {
      var channelName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'chX';
      var mediaType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'H264Raw';

      this.mediaType = mediaType;
      this.media = media;
      this.trigger(_events2.default.MEDIA_ATTACHING, { media: media, channelName: channelName, mediaType: mediaType });
    }
  }, {
    key: 'receiveSocketMessage',
    value: function receiveSocketMessage(e) {
      this.trigger(_events2.default.H264_DATA_PARSING, { data: e });
/*      
      this.buf = new Uint8Array(e.target.result);
      var copy = new Uint8Array(this.buf);

      if (this.mediaType === 'H264Raw') {
        this.trigger(_events2.default.H264_DATA_PARSING, { data: copy });
      } else {
        console.log('type error');
      }
*/
    }
  }]);

  return Wfs;
}();

exports.default = Wfs;

},{"./controller/buffer-controller":2,"./controller/flow-controller":3,"./demux/h264-demuxer":5,"./events":8,"events":1}]},{},[10])(10)
});
//# sourceMappingURL=wfs.js.map
