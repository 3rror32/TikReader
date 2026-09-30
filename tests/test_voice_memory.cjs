const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const flush=()=>new Promise(setImmediate);
function setup(){
 const elements=new Map(),listeners={},windowListeners={},requests=[],events=[];
 const element=id=>{if(!elements.has(id))elements.set(id,{value:'one',checked:false,disabled:false,textContent:'',handlers:{},addEventListener(name,fn){this.handlers[name]=fn;}});return elements.get(id)};
 const document={getElementById:element,addEventListener:(name,fn)=>listeners[name]=fn,dispatchEvent:event=>{events.push(event.type);listeners[event.type]?.(event)}};
 const window={addEventListener:(name,fn)=>windowListeners[name]=fn};
 vm.runInNewContext(fs.readFileSync(path.join(root,'web/static/voice_gpu.js'),'utf8'),{window,document,AbortSignal,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options?.detail}},fetch:(url,options)=>new Promise(resolve=>requests.push({url,options,resolve}))});
 const respond=(request,data,ok=true)=>request.resolve({ok,json:async()=>data});
 return {element,window,events,requests,respond,windowListeners};
}
test('switch unloads RVC and updates GPU controls only after confirmation',async()=>{
 const ui=setup();ui.respond(ui.requests.shift(),{keep_warm:true,warm_loaded:true});await flush();
 const release=ui.window.RvcResources.release();await flush();
 assert.equal(ui.requests[0].url,'/voice-models/unload');assert.equal(ui.element('voice-preload').disabled,true);
 assert.deepEqual(ui.events,['tikreader:voice-changing']);
 ui.respond(ui.requests.shift(),{keep_warm:false,warm_loaded:false});await release;
 assert.equal(ui.element('voice-keep-warm').checked,false);assert.equal(ui.element('voice-preload').disabled,false);
 assert.equal(ui.events.at(-1),'tikreader:voice-changed');
});
test('late preload cannot put the old model back after a switch',async()=>{
 const ui=setup();ui.respond(ui.requests.shift(),{keep_warm:false,warm_loaded:false});await flush();
 const preload=ui.element('voice-preload').handlers.click();await flush();
 const first=ui.requests.shift();assert.equal(first.url,'/voice-models/preload');
 const release=ui.window.RvcResources.release();await flush();assert.equal(ui.requests.length,0);
 ui.respond(first,{keep_warm:true,warm_loaded:true});await preload;await flush();
 assert.equal(ui.requests[0].url,'/voice-models/unload');
 ui.respond(ui.requests.shift(),{keep_warm:false,warm_loaded:false});await release;
 assert.equal(ui.element('voice-keep-warm').checked,false);
});
test('failed release is reported and can be retried',async()=>{
 const ui=setup();ui.respond(ui.requests.shift(),{keep_warm:true,warm_loaded:true});await flush();
 const release=ui.window.RvcResources.release();const failure=assert.rejects(release);await flush();
 ui.respond(ui.requests.shift(),{error:'Error de cierre'},false);await failure;
 assert.match(ui.element('voice-keep-warm-status').textContent,/No se confirmó/);
 const retry=ui.window.RvcResources.release();await flush();ui.respond(ui.requests.shift(),{keep_warm:false,warm_loaded:false});await retry;
 assert.equal(ui.element('voice-keep-warm').checked,false);
});
test('stale initial status cannot override a completed unload',async()=>{
 const ui=setup(),initial=ui.requests.shift(),release=ui.window.RvcResources.release();await flush();
 ui.respond(ui.requests.shift(),{keep_warm:false,warm_loaded:false});await release;
 ui.respond(initial,{keep_warm:true,warm_loaded:true});await flush();assert.equal(ui.element('voice-keep-warm').checked,false);
});
test('voice editor releases memory when selecting TTS, another RVC model, or saving',()=>{
 const source=fs.readFileSync(path.join(root,'web/static/custom_voice.js'),'utf8');
 const controls=new Map(),get=id=>{if(!controls.has(id))controls.set(id,{checked:false,value:'two'});return controls.get(id)};
 let releases=0,stops=0;const sources=[{},{}],stored=new Map();
 const context=vm.createContext({$:get,document:{querySelectorAll:()=>sources,querySelector:()=>({})},window:{RvcResources:{release(){releases++;return Promise.resolve()}}},stopPreview(){stops++},update(){},localStorage:{getItem:key=>stored.get(key),setItem:(key,value)=>stored.set(key,value)},Shell:{show(){}},select:{},current:()=>({engine:'browser'}),custom:[]});
 vm.runInContext(source.slice(source.indexOf(' function releaseRvc'),source.indexOf(' function showActive')),context);
 vm.runInContext(source.split('\n').find(line=>line.startsWith(" document.querySelectorAll('[name=custom-voice-source]')")),context);
 sources[0].onchange();get('voice-local-model').onchange();get('voice-back-browser').onclick();context.persist({engine:'browser'});
 assert.equal(releases,4);assert.equal(stops,4);assert.equal(JSON.parse(stored.get('tikreader.voiceCharacter')).engine,'browser');
});

test('quick Homero selector activates the bundled RVC voice and informed GPU consent',()=>{
 const source=fs.readFileSync(path.join(root,'web/static/custom_voice.js'),'utf8');
 const quickAi={value:'homero_simpson_la'},model={value:''},consent={checked:false},rate={value:'',dispatchEvent(){}};
 const stored=new Map();let selected=null,shown=0,updated=0;
 const controls={'voice-local-model':model,'voice-resource-accept':consent,'tts-rate':rate};
 const context=vm.createContext({quickAi,homeroModel:'homero_simpson_la',runtime:{models:[{id:'homero_simpson_la',name:'Homero Simpson LA'}]},
  document:{querySelector:()=>({checked:false})},$:id=>controls[id],localStorage:{setItem:(key,value)=>stored.set(key,value)},
  persist:value=>selected=value,showActive:()=>shown++,update:()=>updated++,status:{textContent:''},Event:class{}});
 const handler=source.split('\n').find(line=>line.startsWith(' quickAi.onchange='));
 vm.runInContext(handler,context);quickAi.onchange();
 assert.equal(model.value,'homero_simpson_la');assert.equal(consent.checked,true);
 assert.equal(stored.get('tikreader.rvcResourceConsent'),'true');
 assert.deepEqual({...selected},{id:'rvc-homero_simpson_la',name:'Homero · lectura por IA',engine:'rvc',model:'homero_simpson_la',pitch:0,rate:1});
 assert.equal(shown,1);assert.equal(updated,1);assert.match(context.status.textContent,/Homero/);
});
