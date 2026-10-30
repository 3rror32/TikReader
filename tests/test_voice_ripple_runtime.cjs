const assert=require('node:assert/strict');
const {Microphone}=require('../web/static/voice_ripples.js');
(async()=>{
 let resolve,stops=0;const mic=new Microphone({getUserMedia:()=>new Promise(r=>resolve=r)});const pending=mic.start('');mic.stop();resolve({getTracks:()=>[{stop:()=>stops++}]});await pending;assert.equal(stops,1);assert.equal(mic.stream,null);
 let closed=0,disconnected=0;const track={stop:()=>stops++};global.AudioContext=class {resume(){return Promise.resolve()}close(){closed++;return Promise.resolve()}createMediaStreamSource(){return {connect(){},disconnect(){disconnected++}}}createAnalyser(){return {getFloatTimeDomainData(a){a.fill(.1)}}}};
 let constraints;
 const live=new Microphone({getUserMedia:async options=>{constraints=options;return {getTracks:()=>[track]}}});assert(await live.start(''));assert.deepEqual(constraints,{audio:true});assert(live.level()>.09);live.stop();assert.equal(closed,1);assert.equal(disconnected,1);assert.equal(live.level(),0);assert.equal(track.onended,null);
 assert(await live.start('usb-mic'));assert.deepEqual(constraints,{audio:{deviceId:{exact:'usb-mic'}}});live.stop();
 console.log('Pending microphone stop race and live resource cleanup passed');
})().catch(e=>{console.error(e);process.exitCode=1});
const fs=require('node:fs'),vm=require('node:vm');
const template=fs.readFileSync(require.resolve('../web/templates/index.html'),'utf8');
const workspace=template.slice(template.indexOf('data-pane="workspace"'),template.indexOf('data-pane="diagnostics"'));
assert.equal((template.match(/id="vr-device"/g)||[]).length,1);
assert.match(workspace, /id="audio-settings-title">Audio<\/h3>[\s\S]*?<select id="vr-device"><option value="">Predeterminado de Windows<\/option>/);
assert.doesNotMatch(template.slice(template.indexOf('<section data-section="voice-ripples"'),template.indexOf('<section data-section="voice-ripples"')+1800), /id="vr-device"/);
function operatorTab(mediaDevices,AudioContext=global.AudioContext){
 const nodes=new Map(),events={},timers=[];let posts=0,beacons=0,now=100;const payloads=[];
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',disabled:false,options:[],changes:0,dispatchEvent(event){this.changes++;this.onchange?.(event)},replaceChildren(...options){this.options=options},append(option){this.options.push(option)}});return nodes.get(id)};
 const context={console,Event,Blob,AbortController,Float32Array,Math,Number,JSON,AudioContext,Option:function(text,value){this.text=text;this.value=value},document:{getElementById:id=>node('#'+id),querySelector:()=>({querySelector:selector=>selector==='#vr-device'?null:node(selector)})},location:{origin:'http://localhost'},navigator:{mediaDevices,sendBeacon(){beacons++}},VoiceRippleRenderer:{mount:()=>()=>{}},performance:{now:()=>now},setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},addEventListener:(key,fn)=>events[key]=fn,fetch:async(url,options)=>{posts++;payloads.push(JSON.parse(options.body));return {ok:true}}};context.window=context;
 vm.runInNewContext(fs.readFileSync(require.resolve('../web/static/voice_ripples.js'),'utf8'),context);
 return {node,events,timers,payloads,get posts(){return posts},get beacons(){return beacons},advance:ms=>now+=ms};
}
const inactive=operatorTab();assert.equal(inactive.posts,0,'An inactive second tab must not overwrite the active sender');inactive.node('#vr-stop').onclick();assert.equal(inactive.posts,0);inactive.events.pagehide();assert.equal(inactive.beacons,0,'Closing inactive tabs must not clear another sender');
const demo=operatorTab();demo.node('#vr-demo').onclick();demo.timers.shift()();assert.equal(demo.posts,1);demo.events.pagehide();assert.equal(demo.beacons,1);
console.log('Inactive multi-tab publishing and pagehide ownership passed');
(async()=>{
 let refresh;
 let inputs=[{kind:'audioinput',deviceId:'default',label:'Browser default'},{kind:'audioinput',deviceId:'usb-mic',label:'USB mic'},{kind:'audiooutput',deviceId:'speaker'}];
 const tab=operatorTab({enumerateDevices:async()=>inputs,addEventListener:(_,fn)=>refresh=fn},class {resume(){return Promise.resolve()}close(){return Promise.resolve()}createMediaStreamSource(){return {connect(){},disconnect(){}}}createAnalyser(){return {getFloatTimeDomainData(a){a.fill(.1)}}}});
 await refresh();
 const device=tab.node('#vr-device');
 assert.equal(device.options[0].text,'Predeterminado de Windows');assert.equal(device.options[0].value,'');assert.equal(device.options.length,2);
 device.value='usb-mic';await refresh();assert.equal(device.value,'usb-mic');assert.equal(device.changes,0);
 inputs=[];await refresh();assert.equal(device.value,'');assert.equal(device.options.length,1);assert.equal(device.changes,1,'removed device must notify both capture consumers');
 console.log('Settings microphone enumeration, default ordering and removed-device fallback passed');
})().catch(e=>{console.error(e);process.exitCode=1});
(async()=>{
 const tab=operatorTab();tab.node('#vr-style').oninput({target:{value:'halo'}});assert.equal(tab.posts,1);assert.equal(tab.payloads[0].style,'halo');assert(!('amplitude' in tab.payloads[0]),'Settings-only changes must not clear or refresh another sender');await Promise.resolve();tab.events.pagehide();assert.equal(tab.beacons,0);
 const live=operatorTab();live.node('#vr-demo').onclick();live.timers.shift()();live.node('#vr-stop').onclick();await new Promise(setImmediate);assert.equal(live.payloads.at(-1).amplitude,0,'Stop must queue a zero after the pending live frame');assert.deepEqual(live.payloads.at(-1).bands,Array(16).fill(0));
 const {Microphone}=require('../web/static/voice_ripples.js');const mic=new Microphone({});mic.frequencies=new Uint8Array(256);mic.analyser={getByteFrequencyData(a){a.fill(0);a.fill(255,128)}};const bands=mic.bands();assert.equal(bands.length,16);assert.equal(bands[0],0);assert.equal(bands[15],1);assert.equal(mic.level instanceof Function,true);
 console.log('Settings-only transport, queued final zero and real spectrum aggregation passed');
})().catch(e=>{console.error(e);process.exitCode=1});

(async()=>{
 const tracks=[],captures=[];const audio=class {resume(){return Promise.resolve()}close(){return Promise.resolve()}createMediaStreamSource(){return {connect(){},disconnect(){}}}createAnalyser(){return {getFloatTimeDomainData(a){a.fill(.1)}}}};
 const tab=operatorTab({addEventListener(){},getUserMedia:async options=>{captures.push(options);const track={stop(){}};tracks.push(track);return {getTracks:()=>[track]}}},audio);
 await tab.node('#vr-start').onclick();assert.equal(tab.node('#vr-start').disabled,true);assert.equal(typeof tracks[0].onended,'function');tracks[0].onended();
 assert.equal(tab.node('#vr-start').disabled,false,'A disconnected microphone must re-enable Activate');
 tab.node('#vr-stop').onclick();tab.node('#vr-device').value='replacement-mic';tab.node('#vr-device').onchange();assert.equal(captures.length,1,'Stop after disconnection must cancel fallback intent');await tab.node('#vr-start').onclick();
 assert.equal(captures.length,2);assert.equal(captures[1].audio.deviceId.exact,'replacement-mic');assert.equal(tab.node('#vr-start').disabled,true);tab.node('#vr-stop').onclick();
 console.log('Disconnected microphone permits replacement selection and reactivation passed');
})().catch(e=>{console.error(e);process.exitCode=1});

(async()=>{
 const requests=[];let refresh,inputs=[{kind:'audioinput',deviceId:'usb'}];
 const audio=class {resume(){return Promise.resolve()}close(){return Promise.resolve()}createMediaStreamSource(){return {connect(){},disconnect(){}}}createAnalyser(){return {getFloatTimeDomainData(a){a.fill(.1)}}}};
 const tab=operatorTab({getUserMedia:options=>new Promise((resolve,reject)=>requests.push({options,resolve,reject})),enumerateDevices:async()=>inputs,addEventListener:(_,fn)=>refresh=fn,removeEventListener(){}},audio);
 const tick=()=>new Promise(setImmediate),device=tab.node('#vr-device'),start=tab.node('#vr-start');
 const stream=()=>{const track={stops:0,stop(){this.stops++}};return {track,getTracks:()=>[track]}};
 device.onchange();assert.equal(requests.length,0,'idle selection must stay off');
 const first=start.onclick();const a=stream();requests[0].resolve(a);await first;assert.equal(start.disabled,true);
 device.value='usb';device.onchange();assert.equal(a.track.stops,1);assert.equal(requests[1].options.audio.deviceId.exact,'usb');const b=stream();requests[1].resolve(b);await tick();
 b.track.onended();inputs=[];await refresh();assert.equal(device.value,'');assert.equal(requests[2]?.options.audio,true,'ended selected track followed by removal must automatically use Windows default');
 inputs=[{kind:'audioinput',deviceId:'B'},{kind:'audioinput',deviceId:'C'}];device.value='B';device.onchange();device.value='C';device.onchange();assert.equal(requests[4].options.audio.deviceId.exact,'C');const c=stream();requests[4].resolve(c);await tick();requests[3].reject(Error('stale'));const old=stream();requests[2].resolve(old);await tick();assert.equal(old.track.stops,1);assert.equal(c.track.stops,0);assert.match(tab.node('#vr-status').textContent,/Escuchando/);assert.equal(start.disabled,true);
 device.onchange();tab.node('#vr-stop').onclick();const stopped=stream();requests[5].resolve(stopped);await tick();assert.equal(stopped.track.stops,1);assert.equal(start.disabled,false);assert.match(tab.node('#vr-status').textContent,/Detenido/);
 const pending=start.onclick();device.value='D';device.onchange();requests[6].reject(Error('stale start'));await pending;assert.equal(start.disabled,true,'old finally must not enable start during newer capture');tab.events.pagehide();const closed=stream();requests[7].resolve(closed);await tick();assert.equal(closed.track.stops,1);
 console.log('Overlay automatic switching, removal fallback, stale completion and Stop intent checks passed');
})().catch(e=>{console.error(e);process.exitCode=1});
