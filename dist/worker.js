import Wfs from './wfs'

var handler = null;

self.onmessage = function(event) {
	//console.log("~~~~~~~ "+ JSON.stringify(event.data));

	if(handler == null){
		handler = new Wfs();
	}
	handler.receiveSocketMessage(event.data);
	//self.postMessage({"chn":event.data.good, "type": event.data.good});
}