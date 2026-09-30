const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
  const listeners=new Map();
  const window={addEventListener(type,fn){listeners.set(type,fn);},removeEventListener(type,fn){if(listeners.get(type)===fn)listeners.delete(type);}};
  const source=fs.readFileSync(require('node:path').join(__dirname,'../web/static/game_hotkeys.js'),'utf8');
  const api=vm.runInNewContext('let recording=null;const status={};'+source.slice(source.indexOf('  function stopRecording()'),source.indexOf('  function actionCard'))+';({capture,stopRecording,status});',{window,document:{addEventListener(){}}});
  const classes=()=>{const values=new Set();return {add:v=>values.add(v),remove:v=>values.delete(v),contains:v=>values.has(v)};};
  const input={value:'',placeholder:'Grabar',classList:classes(),focus(){this.focused=true;}};
  const trigger={textContent:'Grabar tecla',classList:classes()},hint={};let changes=0;
  return {input,trigger,hint,listeners,api,start(add=false){return api.capture(input,add,trigger,()=>changes++,hint);},get changes(){return changes;},key(key,code='',extra={}){const event={key,code,preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...extra};listeners.get('keydown')?.(event);return event;}};
}

test('capture focuses the field and records a single letter, then removes its listener',()=>{
  const s=setup();s.start();assert.equal(s.input.focused,true);assert.match(s.hint.textContent,/Escuchando/);
  const event=s.key('a','KeyA');assert.equal(s.input.value,'A');assert.ok(event.prevented&&event.stopped);
  assert.equal(s.changes,1);assert.equal(s.listeners.has('keydown'),false);assert.equal(s.trigger.textContent,'Grabar tecla');
  assert.match(s.hint.textContent,/registradas: A/);
});
test('modifier waits for main key and adding a step preserves the previous sequence',()=>{
  const s=setup();s.input.value='SPACE';s.start(true);s.key('Control','ControlLeft',{ctrlKey:true});
  assert.equal(s.input.value,'SPACE');assert.match(s.hint.textContent,/modificador/);
  s.key('b','KeyB',{ctrlKey:true,shiftKey:true});assert.equal(s.input.value,'SPACE, CTRL+SHIFT+B');
});
test('unsupported keys explain the problem and allow retry; repeats do not record',()=>{
  const s=setup();s.start();s.key('Delete','Delete');assert.match(s.hint.textContent,/no compatible/);
  s.key('a','KeyA',{repeat:true});assert.equal(s.changes,0);
  s.key('Enter','NumpadEnter');assert.equal(s.input.value,'ENTER');
});
test('keys without a physical code work, including arrows, space and Escape',()=>{
  for(const [key,value] of [['z','Z'],['5','5'],['ArrowUp','UP'],[' ','SPACE'],['Escape','ESC'],['F12','F12']]){
    const s=setup();s.start();s.key(key);assert.equal(s.input.value,value);
  }
});
test('cancel and window blur retain the saved keys and stop capture',()=>{
  for(const blur of [false,true]){const s=setup();s.input.value='A';s.start();if(blur)s.listeners.get('blur')();else s.api.stopRecording();
    s.key('b','KeyB');assert.equal(s.input.value,'A');assert.equal(s.changes,0);assert.equal(s.input.classList.contains('recording'),false);
  }
});
test('starting another recorder removes the old handler; initial keyboard event can be captured directly',()=>{
  const s=setup();s.start();const handler=s.start();assert.equal(s.listeners.get('keydown'),handler);
  handler({key:'Tab',code:'Tab',preventDefault(){},stopImmediatePropagation(){}});assert.equal(s.input.value,'TAB');assert.equal(s.changes,1);
});
