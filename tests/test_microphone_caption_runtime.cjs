const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
function element(tag='span') {
  const classes = new Set();
  return {tagName: tag.toUpperCase(), childNodes: [], dataset: {}, textContent: '',
    classList: {add: name => classes.add(name), remove: (...names) => names.forEach(n => classes.delete(n)),
      toggle(name, value) { if(value) classes.add(name); else classes.delete(name); }, contains: name => classes.has(name)},
    style: {values: {}, setProperty(name, value) { this.values[name] = value; }},
    append(node) { this.childNodes.push(node); }, replaceChildren(...nodes) { this.childNodes = nodes; },
    get lastChild() { return this.childNodes.at(-1); },
    removeChild(node) { this.childNodes.splice(this.childNodes.indexOf(node), 1); }
  };
}
function widget(reduced=false) {
  const stage=element(), text=element(); let render; const timers=[];
  const context={document: {getElementById: id => id.endsWith('stage') ? stage : text,
    createElement: element, createTextNode: textContent => ({textContent}), documentElement: element()},
    matchMedia: () => ({matches: reduced}), io: () => ({on: (_event,fn) => {render=fn;}}),
    fetch: async () => ({ok:false}), setInterval() {}, setTimeout(fn,delay) {timers.push({fn,delay});return timers.length;}, clearTimeout(){}, Date};
  vm.runInNewContext(fs.readFileSync('web/static/microphone_caption_widget.js','utf8'),context);
  return {stage,text,render,timers};
}
{
  const {text,render} = widget(); const settings={animation:'bounce',duration:2};
  const state=(revision,value,interim=true)=>({revision,text:value,interim,settings,visible_until:interim?0:Date.now()/1000+2});
  render(state(1,'Hola')); const first=text.childNodes[0];
  render(state(2,'Hola mundo')); assert.equal(text.childNodes[0],first,'partial updates must retain the first word node');
  const second=text.childNodes[2];
  render(state(3,'Hola mundo',false)); assert.equal(text.childNodes[0],first); assert.equal(text.childNodes[2],second,'finalization must preserve animated nodes');
  render(state(3,'Hola mundo',false)); assert.equal(text.childNodes[2],second,'duplicate socket/poll notifications must preserve nodes');
  render(state(2,'stale')); assert.equal(text.childNodes[0],first,'older revisions must be ignored');
  render(state(4,'Hola\nOtra línea',false)); assert.equal(text.childNodes[1].tagName,'BR');
  const words=Array.from({length:60},(_,n)=>`word${n}`).join(' ');
  render(state(5,words,false));
  const last=text.childNodes.at(-1);
  assert(Number.parseFloat(last.style.values['--word-delay']) <= 1200,'stagger must finish before the visible deadline');
}
{
  const {text,render}=widget(true);
  render({revision:1,text:'Hola',interim:true,settings:{animation:'bounce'}});
  assert(text.childNodes[0].classList.contains('is-new'),'explicit caption selection must animate under reduced motion');
  render({revision:2,text:'Other',interim:false,settings:{animation:'none'}});
  assert(!text.childNodes[0].classList.contains('is-new'),'None must remain static');
}
{
  const {text,render}=widget();
  const state=(revision,interim,updated_at)=>({revision,text:'Hello again',interim,updated_at,settings:{animation:'pop'},visible_until:Date.now()/1000+5});
  render(state(1,true,1)); const first=text.childNodes[0];
  render(state(2,false,2)); assert.equal(text.childNodes[0],first,'final must retain interim nodes despite a new timestamp');
  render(state(2,false,2)); assert.equal(text.childNodes[0],first,'poll must not replay');
  render(state(3,true,3)); assert.notEqual(text.childNodes[0],first,'identical new utterance must replay');
}
{
  const source=fs.readFileSync('web/static/microphone_captions.js','utf8');
  const start=source.indexOf('  function renderPreviewWords('), end=source.indexOf('\n  function playNextPreviewWord()',start);
  const previewText=element(), preview={dataset:{animation:'fade'}};
  const render=new Function('previewText','preview','document', `let previewWords=[]; const settings={duration:2}; const commonPrefixLength=(a,b)=>{let n=0;while(n<a.length&&a[n]===b[n])n++;return n;}; ${source.slice(start,end)}; return renderPreviewWords;`)(previewText,preview,{createElement:element,createTextNode:textContent=>({textContent})});
  render(['Hola'],0); const first=previewText.childNodes[0];
  render(['Hola','mundo'],1); assert.equal(previewText.childNodes[0],first);
  render(['Hola','mundo'],2); assert.equal(previewText.childNodes[0],first);
  render(['Hola','\n','mundo'],1); assert.equal(previewText.childNodes[1].tagName,'BR');
}
{
  const source=fs.readFileSync('web/static/microphone_captions.js','utf8');
  const start=source.indexOf('  function previewTokens('), end=source.indexOf('  function readSettings()',start);
  const previewText=element(), preview=element(); preview.dataset.animation='pop';
  const show=new Function('previewText','preview','document', `let previewWords=[],previewWasInterim=false; const settings={duration:2},previewMode={}; const stopPreviewWords=()=>{}; const commonPrefixLength=(a,b)=>{let n=0;while(n<a.length&&a[n]===b[n])n++;return n;}; ${source.slice(start,end)}; return showPreview;`)(previewText,preview,{createElement:element,createTextNode:textContent=>({textContent})});
  show('Hello again',true,false,true); const first=previewText.childNodes[0];
  show('Hello again',false,false,true); assert.equal(previewText.childNodes[0],first,'preview finalization retains nodes');
  show('Hello again',false); assert.equal(previewText.childNodes[0],first,'preview duplicate does not replay');
  show('Hello again',true,false,true); assert.notEqual(previewText.childNodes[0],first,'preview new identical utterance replays');
}
console.log('caption runtime node continuity, newline, deadline, stale revision and reduced-motion checks passed');

// Exercise the production sender with delayed HTTP responses, rather than a lookalike queue.
async function senderChecks() {
  const source=fs.readFileSync('web/static/microphone_captions.js','utf8');
  const start=source.indexOf('  function sendLocalAudio('), end=source.indexOf('\n  async function beginLocalRecognition()',start);
  const requests=[], results=[], statuses=[]; let stopped=0;
  const setup=`let localAudioError=false,localPcm=[],localSamples=0,localSendChain=Promise.resolve(),localSending=false,localDrainRequested=false,captureEpoch=1,audioGeneration=1,localStopping=false,localStopPromise=null,desired=true,running=true;
  let localProcessor=null,localSource=null,localSilence=null,localStream={getTracks:()=>[{stop(){onStop();}}]},localContext=null;
  const localEndpoint=(opts={})=>opts.final?'final':'audio'; const handleLocalResult=p=>results.push(p); const setStatus=(...v)=>statuses.push(v); const setTimeout=()=>{}; const permission={}; const syncButtons=()=>{}; const setMeterLevel=()=>{}; const showReadyState=()=>{}; const update=async()=>{};
  ${source.slice(start,end)}
  return {feed(value,n=8000){localPcm.push(new Int16Array(n).fill(value));localSamples+=n;sendLocalAudio();},stop:()=>stopLocalRecognition(),cancel:()=>stopLocalRecognition(true),state:()=>({desired,running,localSamples,captureEpoch}),idle:()=>localSendChain};`;
  const make=()=>new Function('fetch','results','statuses','onStop',setup)((url,options)=>new Promise(resolve=>requests.push({url,options,resolve})),results,statuses,()=>stopped++);
  const h=make();
  const tick=()=>new Promise(resolve=>setImmediate(resolve));
  h.feed(1); await tick(); for(let i=2;i<=11;i++)h.feed(i);
  assert.equal(h.state().desired,true,'normal five second inference backlog must not disable microphone');
  assert.equal(stopped,0); assert.equal(requests.length,1,'only one HTTP request may be in flight');
  requests[0].resolve({ok:true,json:async()=>({text:'primero'})}); await tick();
  assert.equal(requests.length,2); const pcm=new Int16Array(requests[1].options.body);
  assert.equal(pcm.length,80000);for(let i=0;i<10;i++)assert.equal(pcm[i*8000],i+2);
  const stop=h.stop(); requests[1].resolve({ok:true,json:async()=>({text:'segundo'})});await tick();
  assert.equal(requests[2].url,'final','explicit stop must flush only after pending PCM');
  requests[2].resolve({ok:true,json:async()=>({text:'final'})});await stop;
  assert.equal(h.state().desired,false);assert.equal(stopped,1);assert.equal(results.length,3);
  // A canceled generation cannot render its late transcript or send its backlog.
  requests.length=0;results.length=0;const stale=make();stale.feed(7);await tick();stale.feed(8);
  const canceled=stale.cancel();requests[0].resolve({ok:true,json:async()=>({text:'stale'})});await tick();
  assert.equal(results.length,0);assert.equal(requests.length,2);assert.equal(requests[1].options.method,'DELETE');
  requests[1].resolve({ok:true,json:async()=>({generation:2})});await canceled;assert.equal(stale.state().localSamples,0);
  // A true server failure is visible and immediately stops capture, without publishing a final.
  requests.length=0;const broken=make();broken.feed(1);await tick();
  requests[0].resolve({ok:false,json:async()=>({error:'Fallo real del modelo'})});await broken.idle();
  assert.equal(broken.state().desired,false);assert.equal(broken.state().running,false);
  assert(statuses.some(row=>row[1]==='Fallo real del modelo'));
  // Sustained overload stops input explicitly, drains preserved speech in legal packets.
  requests.length=0;const overloaded=make();overloaded.feed(1);await tick();
  for(let i=0;i<34;i++)overloaded.feed(2);
  assert.equal(overloaded.state().desired,false);assert(overloaded.state().localSamples<=272000);
  let index=0,total=0;
  while(index<requests.length) {
    const request=requests[index++];if(request.options.body){assert(request.options.body.byteLength<=262144);total+=request.options.body.byteLength/2;}
    request.resolve({ok:true,json:async()=>({text:''})});await tick();
  }
  assert.equal(total,280000,'overload must drain every retained sample');
}
senderChecks().then(()=>console.log('production PCM sender delayed-inference and final flush checks passed')).catch(error=>{console.error(error);process.exitCode=1;});


async function captureDeviceChecks() {
 const source=fs.readFileSync('web/static/microphone_captions.js','utf8');
 const lifecycle=source.slice(source.indexOf('  function sendLocalAudio('),source.indexOf("  startButton.addEventListener('click'"));
 const change=source.slice(source.indexOf('  async function microphoneSelectionChanged()'),source.indexOf('  duration.addEventListener'));
 const requests=[],resets=[],statuses=[],selector={value:'',addEventListener(){}};
 const tick=()=>new Promise(r=>setImmediate(r));
 const stream=()=>{const t={stops:0,stop(){this.stops++},addEventListener(name,fn){this[name]=fn}};return {track:t,getTracks:()=>[t],getAudioTracks:()=>[t]}};
 const context=class {constructor(){this.state='running'}close(){return Promise.resolve()}createMediaStreamSource(){return {connect(){},disconnect(){}}}createScriptProcessor(){return {connect(){},disconnect(){}}}createGain(){return {gain:{},connect(){},disconnect(){}}}};
 const setup=`let desired=false,running=false,localStopping=false,localStopPromise=null,microphoneSwitch=0,captureEpoch=0,audioGeneration=0,localAudioError=false,localDrainRequested=false,localStream=null,localContext,localSource,localProcessor,localSilence,restartTimer,localPcm=[],localSamples=0,localSendChain=Promise.resolve(),localSending=false;
 let settings={pause_during_voice:true},voiceSpeaking=false,disconnectedMicrophoneIntent=false;const recognitionSupported=true,useLocalRecognition=true;let recognition=null;
 const document={getElementById:()=>selector},permission={};const localEndpoint=()=>'/audio';const audioProcessingConstraints=()=>({noiseSuppression:true,echoCancellation:false,autoGainControl:true});const setStatus=(...v)=>statuses.push(v);const syncButtons=()=>{};const selectedLanguageDetails=()=>({label:'Spanish'});const update=async()=>{};const microphoneErrorMessage=e=>e.message;const setMeterLevel=()=>{};const showReadyState=()=>{};const handleLocalResult=()=>{};
 ${lifecycle}
${change}
 return {start:()=>{desired=true;return beginLocalRecognition()},change:microphoneSelectionChanged,stop:()=>stopRecognition(false),pause:v=>{voiceSpeaking=v},state:()=>({desired,running,localStream,localStopping}),feed(){localPcm.push(new Int16Array(8000));localSamples+=8000;sendLocalAudio()}};`;
 const h=new Function('selector','fetch','navigator','LocalAudioContext','statuses',setup)(selector,(url,options)=>new Promise(resolve=>resets.push({options,resolve})),{mediaDevices:{getUserMedia(options){return new Promise((resolve,reject)=>requests.push({options,resolve,reject}))}}},context,statuses);
 const reset=async()=>{await tick();assert(resets.length,'expected engine/upload request');resets.shift().resolve({ok:true,json:async()=>({available:true,generation:1})});await tick()};
 h.change();await tick();assert.equal(resets.length,0,'idle selection stays off');
 const first=h.start();await reset();const a=stream();requests[0].resolve(a);await first;
 selector.value='usb';h.change();assert.equal(a.track.stops,1);await reset();await reset();
 assert.equal(requests.length,2,'active selection must restart automatically');assert.equal(requests[1].options.audio.deviceId.exact,'usb');assert.equal(requests[1].options.audio.noiseSuppression,true);assert.equal(requests[1].options.audio.echoCancellation,false);
 const b=stream();requests[1].resolve(b);await tick();assert(h.state().running);
 b.track.ended();selector.value='';h.change();await reset();await reset();assert(!('deviceId' in requests[2].options.audio),'ended selected track followed by removal must switch to Windows default');
 selector.value='B';h.change();selector.value='C';h.change();await reset();await reset();
 assert.equal(requests[3].options.audio.deviceId.exact,'C');const c=stream();requests[3].resolve(c);await tick();const stale=stream();requests[2].resolve(stale);await tick();assert.equal(stale.track.stops,1);assert.equal(c.track.stops,0);
 h.feed();selector.value='D';h.change();await tick();assert.equal(requests.length,4);await reset();assert.equal(requests.length,4);await reset();await reset();assert.equal(requests.length,5);
 selector.value='E';h.change();requests[4].reject(Error('old failure'));await reset();await reset();const e=stream();requests[5].resolve(e);await tick();assert(h.state().desired);
 h.change();h.stop();await reset();await tick();assert.equal(requests.length,6);assert.equal(h.state().desired,false);
 h.start();selector.value='F';h.change();await reset();await reset();await reset();assert.equal(requests.length,7);const f=stream();requests[6].resolve(f);await tick();
 f.track.ended();h.stop();h.change();await tick();assert.equal(resets.length,0,'Stop after disconnection must cancel fallback intent');assert.equal(requests.length,7);
 h.start();await reset();const g=stream();requests[7].resolve(g);await tick();
 h.pause(true);h.change();await reset();assert.equal(requests.length,8,'switch respects voice pause');assert(h.state().desired);
 console.log('Production caption automatic switching, serialized teardown, latest intent and pause checks passed');
}
captureDeviceChecks().catch(error=>{console.error(error);process.exitCode=1;});

