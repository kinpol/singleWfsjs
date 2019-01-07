<template>
	<section>
		<!--工具条-->
		<el-row :gutter="10">
			<el-col :xs="16" :sm="16" :md="16" :lg="16" :xl="16">
				<div id="monitor_video_display" class="grid-content bg-purple">
					<!--<el-row style="position:relative">
						<el-select  v-model="channelInfo.value" placeholder="请选择"  @change="requestStream">
							<el-option v-for="item in channelInfo.options" :key="item.value" :label="item.label" :value="item.value">
							</el-option>
						</el-select>
					</el-row>-->
					<video id="video1" ref="liveVideo" style="width:100%;height:380px;" @dblclick="toggleFullScreen"></video>
					<i id="fullScreenButton" @click="autoFullScreen" class="fa fa-arrows-alt fa-2x"></i>
				</div>
			</el-col>
		
		</el-row>
		
	</section>
</template>

<script>
	import Wfs from '../../common/js/wfs'
	import util from '../../common/js/util'
	import alarmInfo from './videoStream.vue'
	import myWorker from 'worker-loader!../../common/js/worker.js';
	import Vue from 'vue'
	import busData from '../bus.js'
	//import NProgress from 'nprogress'
	import {
		requestWebsocketLive
	} from '../../api/api';
	import {mapGetters, mapActions} from 'vuex'
	Vue.component('alarmInfo', alarmInfo);
	
	export default {
		data() {
			return {
				devNameArr: JSON.parse(sessionStorage.getItem('devNameArr')),
				filters: {
					name: ''
				},
				users: [],
				total: 0,
				page: 1,
				listLoading: false,
				sels: [], //列表选中列
				popUpTitle: "告警详情",
				displayType: 0,
				dialogFormVisible: false,
				editFormVisible: false, //修改界面是否显示
				editLoading: false,
				editFormRules: {
					name: [{
						required: true,
						message: '请输入姓名',
						trigger: 'blur'
					}]
				},
				addFormVisible: false, //新增界面是否显示
				addLoading: false,
				addFormRules: {
					name: [{
						required: true,
						message: '请输入姓名',
						trigger: 'blur'
					}]
				},
				channelInfo: {
					options: [{
						value: '0',
						label: '通道1'
					}],
					value: ''
				},
				items: [],
				refrence: [],
				handler: null,
				calc: null,
				debug: 1
			}
		},
		methods: {
			switchMuteState:function(){
				var alarmState = 1-this.$store.state.alarmEnable;
				this.$store.commit('setAlarmEnable', alarmState);
				localStorage.setItem('setAlarmEnable', alarmState);
			},
			getCamName(chn) {
				if (this.devNameArr === null || chn === '') {
					return false
				}
				return this.devNameArr[chn];
			},
            toggleFullScreen:function(){
                var video1 = this.$refs.liveVideo;
			    if(!video1.webkitDisplayingFullscreen){
                    util.formatDate.launchFullscreen(video1);
                }else{
                    
                    util.formatDate.exitFullscreen();
				}
            },
			autoFullScreen() {
				util.formatDate.launchFullscreen(this.$refs.liveVideo);
			},
			timeDisplay: function (time) {
				return util.formatDate.format(time, this.getTimeZone);
			},
			checkWfs() {
				var video1 = this.$refs.liveVideo, _gWebsocket = this.getWebsocket, tokens = sessionStorage.getItem('user');
				if (Wfs.isSupported() == false) {
					return false;
				}
				if (_gWebsocket.vws.state != false) {
					var vwsState = _gWebsocket.vws;
					if (vwsState.state == 2 || vwsState.state == 0) {// pause || stop
						vwsState.handler = new Wfs();
						vwsState.handler.attachMedia(video1, 'ch1', 1, 0, tokens);
						setTimeout(() => {
							this.requestStream(1);
						}, 1000);
					}
				} else {
					var updateWSInfo = {
						'vws': {
							'state': true,
							'handler': new Wfs(),
							'token': tokens
						}
					}
					this.$store.commit('setWebsocket', updateWSInfo);
					_gWebsocket.vws.handler.attachMedia(video1, 'ch1', 1, 0, tokens);
					setTimeout(() => {
						this.requestStream(1);
					}, 1000);
				}
			},
			requestStream(type) {
				let tmpToken = sessionStorage.getItem("user") || '';
				let para = {
					ctrl_type: type,
					chn: 0,
					token: tmpToken
				};
				requestWebsocketLive(para).then(() => {
					if (type == 2) {
						this.$store.commit('setWebsocket', {'vws': {'state': 2}});
					}
				}).catch((error) => {
					console.log(error);
				});
			},
			retryStream() {
				//this.getRealTimeInfos();
			},
			pauseVideo() {
				this.requestStream(2);
			},
			getRealTimeInfos() {
				let itemObject = this.items,
					refrence = this.refrence,
					url = "ws://" + window.location.host + "/StartFrame";
				
				this.$store.commit('setWebsocket', {
					'tws': {
						'state': 0,
						'handler': new WebSocket(url),
						'token': sessionStorage.getItem('user')
					}
				});
				let ws = this.getWebsocket.tws.handler;
				ws.onopen = () => {
					ws.send(JSON.stringify({"data_type": 0, "chn_id": 0, "token": sessionStorage.getItem("user") || ''}));
					this.$store.commit('setWebsocket', {'tws': {'state': 1}});
				};
				
				ws.onmessage = (evt) => {
					if (typeof(evt.data) == "Object") {
						console.log(JSON.stringify(evt.data));
					} else {
						var received_msg = JSON.parse(evt.data);
						if (received_msg.data_type == 0) {
							if (itemObject.length >= 30) {
								itemObject.pop();
							}
							itemObject.unshift({
								dateTime: received_msg.snap_info.pts,
								camera: received_msg.snap_info.chn_id,
								Track_id: received_msg.snap_info.track_id,
								data: received_msg.snap_info.data
							})
						} else if (received_msg.data_type == 1) {
							if (received_msg.ret_code != undefined) {
								console.log(received_msg.ret_code);
							} else {
								if (refrence.length >= 8) {
									refrence.pop();
								}
								refrence.unshift(received_msg);
								//add the alarm info to capture list;
								if (itemObject.length >= 30) {
									itemObject.pop();
								}
								itemObject.unshift({
									dateTime: received_msg.alarm_info.snap_pic_info.pts,
									camera: received_msg.alarm_info.snap_pic_info.chn_id,
									Track_id: received_msg.alarm_info.snap_pic_info.track_id,
									data: received_msg.alarm_info.snap_pic_info.data
								})
							}
						} else {
							console.log("error data_type is " + received_msg.data_type);
						}
					}
				};
				ws.onclose = () => {	// 关闭 websocket
					console.log("close tws connection");
				};
			},
			createMediaNode: function(attachedNode, chn, url) {
				//let _that = this;
				//var mediaNode = new Object();
			    this.mediaSource = null;
			    this.media = attachedNode;
			    this.pendingTracks = {};
			    this.sourceBuffer = {};
			    this.segments = [];

			    this.appended = 0;
			    this._msDuration = null;

			    this.browserType = 0;
			    this.mediaType = 'H264Raw';

				this.onMediaSourceClose = function () {
				    console.log('media source closed');
				}

				this.onMediaSourceEnded = function () {
				    console.log('media source ended');
				}

				this.onBufferAppending = data => {
				    if (!this.segments) {
				      this.segments = [data];
				    } else {
				      this.segments.push(data); 
				    }
				    this.doAppending();
				}

				this.onMediaSourceOpen = function () { 
					let mediaSource = this.mediaSource;
					if (mediaSource) {
					// once received, don't listen anymore to sourceopen event
						mediaSource.removeEventListener('sourceopen', this.onmso);
					}
					if (this.mediaType === 'FMp4') {
						this.checkPendingTracks();
					}
					/*
				 		mediaNode.media = this.media;
	                    mediaNode.mediaType = this.mediaType;
	                    mediaNode.dataType = this.dataType
	                */
				  }

				this.onBufferReset = function (data) { 
				      if (this.mediaType === 'H264Raw') {
				        this.createSourceBuffers({ tracks: 'video', mimeType: data.mimeType });
				      }
				  }

				this.checkPendingTracks = function(){
				      this.createSourceBuffers({ tracks: 'video', mimeType: '' });
				      this.pendingTracks = {};
				}

				this.createSourceBuffers = function (tracks) {
				    var sourceBuffer = this.sourceBuffer,
				    	mediaSource = this.mediaSource;
				    let mimeType;
				    if (tracks.mimeType == undefined || tracks.mimeType === ''){
				      mimeType = 'video/mp4;codecs=avc1.420028'; // avc1.42c01f avc1.42801e avc1.640028 avc1.420028
				    }else{
				      mimeType = 'video/mp4;codecs=' + tracks.mimeType;
				    }
				 
				    try {
				      let sb = sourceBuffer['video'] = mediaSource.addSourceBuffer(mimeType);
				      sb.addEventListener('updateend', this.onsbue);
				      track.buffer = sb;
				    } catch(err) {

				    }
				    this.mediaType = tracks;
				    //mediaNode.trigger(Event.BUFFER_CREATED, { tracks : tracks } );
				    this.media.play();    
				  }

				this.doAppending = function () {
				    var sourceBuffer = this.sourceBuffer, segments = this.segments;
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
				          if(sourceBuffer[segment.type]) { 
				            this.parent = segment.parent;
				            sourceBuffer[segment.type].appendBuffer(segment.data);
				            this.appendError = 0;
				            this.appended++;
				            this.appending = true;
				          } else {
				  
				          }
				        } catch(err) {
				          // in case any error occured while appending, put back segment in segments table 
				          segments.unshift(segment);
				          var event = {type: ErrorTypes.MEDIA_ERROR};
				          if(err.code !== 22) {
				            if (this.appendError) {
				              this.appendError++;
				            } else {
				              this.appendError = 1;
				            }
				            event.details = ErrorDetails.BUFFER_APPEND_ERROR;
				            event.frag = this.fragCurrent;   
				            if (this.appendError > 30) { 
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

			    this.onMediaAttaching = function (nodeData) {
				    let media = nodeData;
				    this.mediaType = 'H264Raw';
				    //this.websocketName = data.websocketName;
				    //this.channelName = data.channelName;
				    if (media) {
				      // setup the media source
				      var ms = this.mediaSource = new MediaSource();
				      //Media Source listeners
				      ms.onmso = this.onMediaSourceOpen;
				      ms.onmse = this.onMediaSourceEnded;
				      ms.onmsc = this.onMediaSourceClose;
				      ms.addEventListener('sourceopen', this.onMediaSourceOpen);
				      ms.addEventListener('sourceended', this.onMediaSourceEnded);
				      ms.addEventListener('sourceclose', this.onMediaSourceClose);
				      // link video and media Source
				      media.src = URL.createObjectURL(ms);
				    }
				  }

				this.onSBUpdateEnd = function (event) { 
				    this.appending = false;
				    this.doAppending();
				  }

			    // Source Buffer listeners
			    this.onsbue = this.onSBUpdateEnd.bind(this);
				return this;
			},
			readStream() {
				if(this.debug){
					let nodes = new this.createMediaNode(this.$refs.liveVideo);
					nodes.onMediaAttaching(this.$refs.liveVideo);
					
					this.calc = new myWorker();
					this.calc.onmessage = function(event) {
						console.log('event.data[0]: '+ event.data[0]);
						if(event.data[0] == "onBufferAppending"){//data
							nodes.onBufferAppending(event.data[1]);
						}else if(event.data[0] == "createSourceBuffers"){ // function calling
							nodes.createSourceBuffers(event.data[1].tracks);
						}else if(event.data[0] == "onSBUpdateEnd"){ // function calling
							nodes.onSBUpdateEnd(event.data[1].event);
						}
					}
				}else{
					this.handler = new Wfs();
					this.handler.attachMedia(this.$refs.liveVideo)
				}
/*
				let nodes = new this.createMediaNode();
				this.calc = new myWorker();
				this.calc.onmessage = function(event) {
					 nodes.onBufferAppending(event.data[1]);
				}
*/
				this.ws = new WebSocket('ws://' + window.location.host + '/StartFrame');
				this.ws.binaryType = 'arraybuffer';
				this.ws.onopen = () => {
					this.ws.send(JSON.stringify({
						data_type: 1,
						chn_id: 0,
						token: sessionStorage.getItem("user") || ''
					}));
						setTimeout(() => {
							this.requestStream(1);
						}, 1000);
				};

				this.ws.onmessage = (evt) => {
					let body = new Uint8Array(evt.data)
					if(this.debug){
     					this.calc.postMessage(body);
					}else{
						this.handler.receiveSocketMessage(body);
					}


				}
				this.ws.onclose = (evt) => {
					console.log('video websocket close');
				}
				this.ws.onerror = (evt) => {
					console.log('video websocket error');
					this.ws.close();
				}
			},
			vwsChange:function(val, oldVal){
				console.log('new: %s, old: %s', val, oldVal)
				if(val){// network start to connect
					console.log(" network start to connect");
					this.checkWfs();
				}else{// network dis-connected
					console.log("network dis-connected");
					this.pauseVideo();//stop the video
					var _gWebsocket = this.getWebsocket;
					if (_gWebsocket.vws.handler != null) {
						_gWebsocket.vws.handler.websocketLoader.client.close();
						_gWebsocket.vws.handler.destroy();
						_gWebsocket.vws.handler = null;
					}
				}
				//this.checkWfs();
			}
		},
		watch: {
			'$store.state.sysInit.connect': 'vwsChange'
		},
		computed: {
			...mapGetters([
				'getBaseList',
				'getTimeZone',
				'getMoniAlarm',
				'getMoniCapture',
				'getRealTimeInfo',
				'getWebsocket'
				// ...
			])
		},
		mounted() {
			busData.$on('changeState', function (id) {});
			//this.checkWfs();
			this.readStream();
			//this.getRealTimeInfos();
		},
		beforeDestroy() {
			var alminfo = this.$refs.alarmInfo;// 离开页面，关闭当次的报警
			if(alminfo != undefined){
				alminfo.pause();
			}
			this.pauseVideo();//stop the video
			var _gWebsocket = this.getWebsocket;
			if (_gWebsocket.vws.handler != null) {
				_gWebsocket.vws.handler.websocketLoader.client.close();
				_gWebsocket.vws.handler.destroy();
				_gWebsocket.vws.handler = null;
			}
		}
	}
</script>

<style scoped>
	.el-col {
		margin: 10px 0 0 0;
		border-radius: 4px;
	}
	
	.bg-purple-dark {
		background: #99a9bf;
	}
	
	#monitor_video_display {
		overflow: hidden;
	}
	
	#monitor_video_display.bg-purple {
		height: 380px;
		background: #d3dce6;
		position: relative;
	}
	
	#scan_info.bg-purple-light {
		height: 380px;
		background: #e5e9f2;
	}
	
	#capture_info.bg-purple-light {
		height: 180px;
		background: #e5e9f2;
	}
	
	.grid-content {
		border-radius: 4px;
		min-height: 36px;
	}
	
	.el-select {
		margin: 0 auto;
		z-index: 1;
	}
	
	canvas {
		width: 100%;
		height: 100%;
	}
	
	#fullScreenButton {
		color: #666;
		position: absolute;
		bottom: 10px;
		right: 10px;
	}
	
	video::-webkit-media-controls {
		display: none !important;
	}

	.mute_state {
		background:url(../../../static/mute.png);
		width: 22px;
		height: 15px;
	}

	.umute_state {
		background:url(../../../static/umute.png) bottom no-repeat;
		width: 22px;
		height: 20px;
	}

	.voiceIcon {
    margin-left: 60px;
    font-style: normal;
    font-weight: 400;
    font-variant: normal;
    text-transform: none;
    line-height: 1;
    vertical-align: baseline;
    display: inline-block;
    -webkit-font-smoothing: antialiased;
	}
</style>