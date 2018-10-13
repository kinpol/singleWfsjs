/**
 * WFS interface, Jeff Yang 2016.10
 */
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

//import XhrLoader from './utils/xhr-loader';
//import FileLoader from './loader/file-loader';
//import WebsocketLoader from './loader/websocket-loader';


var Wfs = function () {
  _createClass(Wfs, null, [{
    key: 'isSupported',
    value: function isSupported() {
      return window.MediaSource && typeof window.MediaSource.isTypeSupported === 'function' && window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42c01f,mp4a.40.2"');
    }
  }, {
    key: 'version',
    get: function get() {
      // replaced with browserify-versionify transform
      return '__VERSION__' + 'v.0.0.0.1';
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
          //autoStartLoad: true,
          //startPosition: -1,
          debug: false,
          H264_TIMEBASE: 3600,
          //fLoader: undefined,
          //loader: undefined,//XhrLoader,
          //loader: FetchLoader,
          //fmp4FileUrl: 'xxxx.mp4',
          //fragLoadingTimeOut: 20000,
          //fragLoadingMaxRetry: 6,
          //fragLoadingRetryDelay: 1000,
          //fragLoadingMaxRetryTimeout: 64000,
          //fragLoadingLoopThreshold: 3,

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
    // observer setup
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
    //  this.fileLoader = new FileLoader(this);
    //  this.websocketLoader = new WebsocketLoader(this);
    this.mediaType = 'H264Raw';
  }

  _createClass(Wfs, [{
    key: 'destroy',
    value: function destroy() {
      this.flowController.destroy();
      this.bufferController.destroy();
      //   this.fileLoader.destroy();
      //   this.websocketLoader.destroy();
    }
  }, {
    key: 'attachMedia',
    value: function attachMedia(media) {
      var channelName = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 'chX';
      var mediaType = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : 'H264Raw';
      // 'H264Raw' 'FMp4'    
      this.mediaType = mediaType;
      this.media = media;
      this.trigger(_events2.default.MEDIA_ATTACHING, { media: media, channelName: channelName, mediaType: mediaType });
    }
  }, {
    key: 'receiveSocketMessage',
    value: function receiveSocketMessage(e) {

      this.buf = new Uint8Array(e.target.result);
      var copy = new Uint8Array(this.buf);

      if (this.mediaType === 'H264Raw') {
        this.trigger(_events2.default.H264_DATA_PARSING, { data: copy });
      } else {
        console.log('type error');
      }
    }

    /* 
     attachWebsocket(websocket,channelName) { 
       this.trigger(Event.WEBSOCKET_ATTACHING, {websocket: websocket, mediaType:this.mediaType, channelName:channelName });
     }
    */

  }]);

  return Wfs;
}();

exports.default = Wfs;