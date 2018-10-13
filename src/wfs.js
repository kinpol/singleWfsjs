/**
 * WFS interface, Jeff Yang 2016.10
 */
'use strict';

import Event from './events';
import FlowController from  './controller/flow-controller'; 
import BufferController from  './controller/buffer-controller';
import EventEmitter from 'events';
import H264Demuxer from './demux/h264-demuxer';
//import XhrLoader from './utils/xhr-loader';
//import FileLoader from './loader/file-loader';
//import WebsocketLoader from './loader/websocket-loader';


class Wfs {

  static get version() {
    // replaced with browserify-versionify transform
    return '__VERSION__'+'v.0.0.0.1';
  }

  static isSupported() {
    return (window.MediaSource &&
            typeof window.MediaSource.isTypeSupported === 'function' &&
            window.MediaSource.isTypeSupported('video/mp4; codecs="avc1.42c01f,mp4a.40.2"'));
  }
  
  static get Events() {
    return Event;
  }
 
  static get DefaultConfig() {
    if(!Wfs.defaultConfig) {
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
  }

  static set DefaultConfig(defaultConfig) {
    Wfs.defaultConfig = defaultConfig;
  }

  constructor(config = {}) {

    var defaultConfig = Wfs.DefaultConfig;
    for (var prop in defaultConfig) {
        if (prop in config) { continue; }
        config[prop] = defaultConfig[prop];
    }
    this.config = config;  
    // observer setup
    var observer = this.observer = new EventEmitter();
    observer.trigger = function trigger (event, ...data) {
      observer.emit(event, event, ...data);
    };

    observer.off = function off (event, ...data) {
      observer.removeListener(event, ...data);
    };
    this.on = observer.on.bind(observer);
    this.off = observer.off.bind(observer);
    this.trigger = observer.trigger.bind(observer);

    this.flowController = new FlowController(this);
    this.bufferController = new BufferController(this);
    this.h264Demuxer = new H264Demuxer(this);
  //  this.fileLoader = new FileLoader(this);
  //  this.websocketLoader = new WebsocketLoader(this);
    this.mediaType = 'H264Raw';     
  }

  destroy() {
    this.flowController.destroy();
    this.bufferController.destroy();
 //   this.fileLoader.destroy();
 //   this.websocketLoader.destroy();
  }

  attachMedia(media, channelName='chX',mediaType='H264Raw') { // 'H264Raw' 'FMp4'    
    this.mediaType = mediaType; 
    this.media = media;
    this.trigger(Event.MEDIA_ATTACHING, {media:media, channelName:channelName, mediaType:mediaType});
  }

  receiveSocketMessage( e ){
    
    this.buf = new Uint8Array(e.target.result);
    var copy = new Uint8Array(this.buf);

    if (this.mediaType === 'H264Raw'){
      this.trigger(Event.H264_DATA_PARSING, {data: copy });
    }else{
      console.log('type error');
    }
  }

 /* 
  attachWebsocket(websocket,channelName) { 
    this.trigger(Event.WEBSOCKET_ATTACHING, {websocket: websocket, mediaType:this.mediaType, channelName:channelName });
  }
*/
}

export default Wfs;
