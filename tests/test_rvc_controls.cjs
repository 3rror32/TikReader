process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
function setup(engine='rvc'){
 const elements=new Map(),listeners={};
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'',checked:false,options:[],textContent:'',addEventListener(){},dispatchEvent(){},replaceChildren(){this.options=[]},append(x){this.options.push(x)}});return elements.get(id)};
 element('tts-rate').value='1';element('tts-volume').value='.7';
 const ss={cancel(){},pause(){},resume(){},getVoices:()=>[],addEventListener(){},dispatchEvent(){},speak(){}};
 let resolveRender,plays=0,pauses=0;
 const window={speechSynthesis:ss};
 vm.runInNewContext(fs.readFileSync('web/static/studio.js','utf8'),{CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},window,speechSynthesis:ss,SpeechSynthesisUtterance:function(text){this.text=text},CustomEvent:class {constructor(type,options){this.type=type;this.detail=options?.detail}},document:{getElementById:element,createElement:()=>({}),addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent(){},querySelectorAll:()=>[],hidden:false},localStorage:{getItem(k){return k==='tikreader.voiceCharacter'?JSON.stringify({engine,model:'test',voice:'ef_dora'}):k==='tikreader.rvcResourceConsent'?'true':null},setItem(){}},fetch:url=>['/voice-models/render','/local-tts/render'].includes(url)?new Promise(r=>resolveRender=r):Promise.resolve({ok:false}),setTimeout(){},clearTimeout(){},setInterval(){},URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},AbortSignal,Audio:function(){this.play=()=>{plays++;return Promise.resolve()};this.pause=()=>pauses++}});
 return{studio:window.Studio,element,event:name=>listeners[name]?.(),counts:()=>({plays,pauses}),finish:async()=>{resolveRender({ok:true,blob:async()=>({})});await new Promise(setImmediate)}};
}
test('RVC waits for microphone release after conversion and pauses for effects',async()=>{
 const ui=setup();ui.studio.speakManual('prueba');ui.studio.hold('mic',true);await ui.finish();assert.equal(ui.counts().plays,0);
 ui.studio.hold('mic',false);assert.equal(ui.counts().plays,1);ui.studio.hold('effects',true);assert.equal(ui.counts().pauses,1);
});
test('RVC respects manual pause while conversion is pending',async()=>{
 const ui=setup();ui.studio.speakManual('prueba');ui.element('tts-pause').onclick();await ui.finish();assert.equal(ui.counts().plays,0);
 ui.element('tts-pause').onclick();assert.equal(ui.counts().plays,1);
});
test('RVC pending conversion never plays after emergency',async()=>{
 const ui=setup();ui.studio.speakManual('prueba');ui.studio.mute(true);await ui.finish();assert.equal(ui.counts().plays,0);
});

test('changing voice cancels pending RVC audio and queued readings',async()=>{
 const ui=setup();ui.studio.speakManual('voz anterior');ui.studio.speakManual('frase en cola');
 ui.event('tikreader:voice-changing');ui.event('tikreader:voice-changed');await ui.finish();
 assert.equal(ui.counts().plays,0);
});

test('changing voice stops RVC audio that is already playing',async()=>{
 const ui=setup();ui.studio.speakManual('voz anterior');await ui.finish();assert.equal(ui.counts().plays,1);
 ui.event('tikreader:voice-changing');assert.equal(ui.counts().pauses,1);ui.event('tikreader:voice-changed');
});

for(const engine of ['kokoro']) {
 test('Kokoro holds playback during a microphone interruption',async()=>{
  const ui=setup(engine);ui.studio.speakManual('Hola');ui.studio.hold('mic',true);await ui.finish();assert.equal(ui.counts().plays,0);
  ui.studio.hold('mic',false);assert.equal(ui.counts().plays,1);
 });
 test('Kokoro discards audio after emergency or a voice change',async()=>{
  for(const action of ['mute','switch']){const ui=setup(engine);ui.studio.speakManual('Hola');
   if(action==='mute')ui.studio.mute(true);else{ui.event('tikreader:voice-changing');ui.event('tikreader:voice-changed');}
   await ui.finish();assert.equal(ui.counts().plays,0);
  }
 });
 test('Kokoro honors pause while synthesis is in progress',async()=>{
  const ui=setup(engine);ui.studio.speakManual('Hola');ui.element('tts-pause').onclick();await ui.finish();assert.equal(ui.counts().plays,0);
  ui.element('tts-pause').onclick();assert.equal(ui.counts().plays,1);
 });
}
