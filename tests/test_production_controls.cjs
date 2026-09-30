process.chdir(require('node:path').resolve(__dirname, '..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
  const elements=new Map(), requests=[];
  const element=id=>{if(!elements.has(id)){const attributes=new Map();elements.set(id,{textContent:'',title:'',setAttribute(name,value){attributes.set(name,value)},getAttribute(name){return attributes.get(name)},addEventListener(){},classList:{toggle(){}}})}return elements.get(id);};
  let fail=false;
  const context={window:{},document:{getElementById:element,body:{classList:{toggle(){}}}},localStorage:{getItem(){return null;}},Studio:{mute(){},hold(){}},AbortSignal,
    fetch:async(path,options)=>{const data=JSON.parse(options.body);requests.push(data);if(fail)throw Error('offline');return {ok:true,json:async()=>({emergency:data.emergency,scene:'talk',revision:requests.length})};}};
  const source=fs.readFileSync(`${__dirname}/../web/static/production.js`,'utf8');
  vm.runInNewContext(source.slice(0,source.indexOf(" $('scene-save').onclick"))+'return {state,pause};})();',context);
  context.window.ProductionUI.state({emergency:false,scene:'talk',revision:0});
  return {ui:context.window.ProductionUI,button:element('emergency-button'),requests,setFail:value=>fail=value};
}

test('one control pauses then resumes voice and effects',async()=>{
  const s=setup();
  assert.equal(s.button.textContent,'');
  assert.equal(s.button.getAttribute('aria-label'),'Pausa de seguridad');
  assert.equal(s.button.getAttribute('aria-pressed'),'false');
  await s.button.onclick();
  assert.equal(s.button.textContent,'');
  assert.equal(s.button.getAttribute('aria-label'),'Reanudar voz y efectos');
  assert.equal(s.button.getAttribute('aria-pressed'),'true');
  assert.match(s.button.title,/Reanuda voz/);
  await s.button.onclick();
  assert.equal(s.button.getAttribute('aria-label'),'Pausa de seguridad');
  assert.equal(s.button.getAttribute('aria-pressed'),'false');
  assert.deepEqual(s.requests,[{emergency:true},{emergency:false}]);
});
test('emergency shortcut only pauses even when already paused',async()=>{
  const s=setup();await s.ui.pause();await s.ui.pause();
  assert.ok(s.requests.every(x=>x.emergency));
  assert.equal(s.button.getAttribute('aria-label'),'Reanudar voz y efectos');
});
test('failed pause stays locally paused and failed resume remains retryable',async()=>{
  const s=setup();s.setFail(true);await s.button.onclick();
  assert.equal(s.button.getAttribute('aria-label'),'Reanudar voz y efectos');
  await s.button.onclick();
  assert.equal(s.button.getAttribute('aria-label'),'Reanudar voz y efectos');
  assert.equal(s.button.disabled,false);
  s.setFail(false);await s.button.onclick();
  assert.equal(s.button.getAttribute('aria-label'),'Pausa de seguridad');
});
