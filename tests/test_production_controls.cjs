process.chdir(require('node:path').resolve(__dirname, '..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup(){
  const elements=new Map(), requests=[];
  const element=id=>{if(!elements.has(id)){const attributes=new Map();elements.set(id,{textContent:'',title:'',setAttribute(name,value){attributes.set(name,value)},getAttribute(name){return attributes.get(name)},addEventListener(){},classList:{toggle(){}}})}return elements.get(id);};
  let fail=false, pending=false, release;
  const context={window:{},document:{getElementById:element,body:{classList:{toggle(){},add(){}}}},localStorage:{getItem(){return null;}},Studio:{mute(){},hold(){}},AbortSignal,
    fetch:async(path,options)=>{const data=JSON.parse(options.body);requests.push(data);if(pending)await new Promise(resolve=>release=resolve);if(fail)throw Error('offline');return {ok:true,json:async()=>({emergency:data.emergency,scene:'talk',revision:requests.length})};}};
  const source=fs.readFileSync(`${__dirname}/../web/static/production.js`,'utf8');
  vm.runInNewContext(source.slice(0,source.indexOf(" $('scene-save').onclick"))+'return {state,pause};})();',context);
  context.window.ProductionUI.state({emergency:false,scene:'talk',revision:0});
  return {ui:context.window.ProductionUI,button:element('emergency-button'),status:element('emergency-status'),requests,setFail:value=>fail=value,holdRequest:()=>pending=true,releaseRequest:()=>release()};
}

test('one control pauses then resumes voice and effects',async()=>{
  const s=setup();
  assert.equal(s.button.textContent,'Pausar voz y efectos');
  assert.equal(s.button.getAttribute('aria-label'),'Pausar voz y efectos');
  assert.equal(s.button.getAttribute('aria-pressed'),'false');
  await s.button.onclick();
  assert.equal(s.button.textContent,'En pausa · Reanudar');
  assert.equal(s.button.getAttribute('aria-label'),'En pausa · Reanudar');
  assert.equal(s.status.textContent,'');
  assert.equal(s.button.getAttribute('aria-pressed'),'true');
  assert.match(s.button.title,/Reanuda voz/);
  await s.button.onclick();
  assert.equal(s.button.getAttribute('aria-label'),'Pausar voz y efectos');
  assert.equal(s.button.getAttribute('aria-pressed'),'false');
  assert.equal(s.status.textContent,'');
  assert.deepEqual(s.requests,[{emergency:true},{emergency:false}]);
});
test('emergency shortcut only pauses even when already paused',async()=>{
  const s=setup();await s.ui.pause();await s.ui.pause();
  assert.ok(s.requests.every(x=>x.emergency));
  assert.equal(s.button.getAttribute('aria-label'),'En pausa · Reanudar');
});
test('failed pause stays locally paused and failed resume remains retryable',async()=>{
  const s=setup();s.setFail(true);await s.button.onclick();
  assert.equal(s.button.getAttribute('aria-label'),'En pausa · Reanudar');
  assert.equal(s.status.textContent,'Audio pausado. No se pudo confirmar la ocultación de overlays; revisa el servidor.');
  await s.button.onclick();
  assert.equal(s.button.getAttribute('aria-label'),'En pausa · Reanudar');
  assert.equal(s.status.textContent,'No se pudo reanudar. Revisa la conexión con el servidor e inténtalo de nuevo.');
  assert.equal(s.button.disabled,false);
  s.setFail(false);await s.button.onclick();
  assert.equal(s.button.getAttribute('aria-label'),'Pausar voz y efectos');
  assert.equal(s.status.textContent,'');
});

test('local pause updates the button immediately without a helper while confirmation is pending',async()=>{
  const s=setup();s.holdRequest();
  const confirmation=s.button.onclick();
  assert.equal(s.button.textContent,'En pausa · Reanudar');
  assert.equal(s.button.getAttribute('aria-label'),s.button.textContent);
  assert.equal(s.button.getAttribute('aria-pressed'),'true');
  assert.equal(s.button.getAttribute('aria-busy'),'true');
  assert.equal(s.button.disabled,true);
  assert.equal(s.status.textContent,'');
  await s.button.onclick();assert.equal(s.requests.length,1);
  s.releaseRequest();await confirmation;
  assert.equal(s.button.getAttribute('aria-busy'),'false');
  assert.equal(s.button.disabled,false);
  assert.equal(s.status.textContent,'');
});

test('scene notices remain visible during local and confirmed pause',async()=>{
  const s=setup();s.ui.state({emergency:false,scene:'break',revision:0});
  assert.equal(s.status.textContent,'Escena sin lectura automática.');
  s.holdRequest();const confirmation=s.ui.pause();
  assert.equal(s.status.textContent,'Escena sin lectura automática.');
  s.releaseRequest();await confirmation;
  s.ui.state({emergency:true,scene:'break',revision:2});
  assert.equal(s.status.textContent,'Escena sin lectura automática.');
});

test('mobile emergency status is displayed only when it contains a notice',()=>{
  const css=fs.readFileSync(`${__dirname}/../web/static/visual_refresh.css`,'utf8');
  assert.match(css,/body\.emergency\s+\.app\s*>\s*header\s+\.broadcast-safety\s+#emergency-status:not\(:empty\)\s*\{\s*display:\s*block;/);
});
