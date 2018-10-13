'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('../events');

var _events2 = _interopRequireDefault(_events);

var _eventHandler = require('../event-handler');

var _eventHandler2 = _interopRequireDefault(_eventHandler);

var _h264Demuxer = require('../demux/h264-demuxer');

var _h264Demuxer2 = _interopRequireDefault(_h264Demuxer);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                * Websocket Loader
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               */

var WebsocketLoader = function (_EventHandler) {
  _inherits(WebsocketLoader, _EventHandler);

  function WebsocketLoader(wfs) {
    _classCallCheck(this, WebsocketLoader);

    var _this = _possibleConstructorReturn(this, (WebsocketLoader.__proto__ || Object.getPrototypeOf(WebsocketLoader)).call(this, wfs, _events2.default.WEBSOCKET_ATTACHING, _events2.default.WEBSOCKET_DATA_UPLOADING, _events2.default.WEBSOCKET_MESSAGE_SENDING));

    _this.buf = null;
    _this.h264Demuxer = new _h264Demuxer2.default(wfs);
    _this.mediaType = undefined;
    _this.channelName = undefined;
    return _this;
  }

  _createClass(WebsocketLoader, [{
    key: 'destroy',
    value: function destroy() {
      _eventHandler2.default.prototype.destroy.call(this);
    }
  }, {
    key: 'onWebsocketAttaching',
    value: function onWebsocketAttaching(data) {
      this.mediaType = data.mediaType;
      this.channelName = data.channelName;
      if (data.websocket instanceof WebSocket) {
        this.client = data.websocket;
        this.client.onopen = this.initSocketClient.bind(this);
        this.client.onclose = function (e) {
          console.log('Websocket Disconnected!');
        };
      }
    }
  }, {
    key: 'initSocketClient',
    value: function initSocketClient(client) {
      this.client.binaryType = 'arraybuffer';
      this.client.onmessage = this.receiveSocketMessage.bind(this);
      this.wfs.trigger(_events2.default.WEBSOCKET_MESSAGE_SENDING, { commandType: "open", channelName: this.channelName, commandValue: "NA" });
      console.log('Websocket Open!');
    }
  }, {
    key: 'receiveSocketMessage',
    value: function receiveSocketMessage(event) {
      this.buf = new Uint8Array(event.data);
      var copy = new Uint8Array(this.buf);

      if (this.mediaType === 'FMp4') {
        this.wfs.trigger(_events2.default.WEBSOCKET_ATTACHED, { payload: copy });
      }
      if (this.mediaType === 'H264Raw') {
        this.wfs.trigger(_events2.default.H264_DATA_PARSING, { data: copy });
      }
    }
  }, {
    key: 'onWebsocketDataUploading',
    value: function onWebsocketDataUploading(event) {
      this.client.send(event.data);
    }
  }, {
    key: 'onWebsocketMessageSending',
    value: function onWebsocketMessageSending(event) {
      this.client.send(JSON.stringify({ t: event.commandType, c: event.channelName, v: event.commandValue }));
    }
  }]);

  return WebsocketLoader;
}(_eventHandler2.default);

exports.default = WebsocketLoader;