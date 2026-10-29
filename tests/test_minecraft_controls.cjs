const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

function setup({holdInitial=false,failInitial=false,oldBackend=false,oldQuantities=false,initialPresets={},initialEdition='java'}={}){
  const nodes=[],timers=new Map(),listeners={},observers=[];let serial=0,pane,fail=failInitial,hold=holdInitial,release;
  const requests=[];let heldPost,releasePost;
  const java={host:'localhost',port:25575,commands:{probe:'list'}},bedrock={commands:{bed:'say hello'}};
  const publicCatalog=JSON.parse(fs.readFileSync(`${__dirname}/../web/static/minecraft.js`,'utf8').match(/const defaultActions=(\[.*?\]);/s)[1]);
  const presetCatalog=publicCatalog.map(row=>({...row,...(row.quantity?{quantity_min:1,quantity_max:20,quantity_default:row.quantity}:{})}));
  const presetCategories=[['actions','Acciones'],['animals','Animales'],['aquatic','Acuáticos'],['helpers','Ayudantes'],['undead','No-muertos'],['hostile','Hostiles'],['nether','Nether'],['end','End'],['bosses','Jefes']].map(([id,name])=>({id,name}));
  const defaults=()=>Object.fromEntries(presetCatalog.map(p=>[p.id,{gift_id:'',gift_name:'',enabled:false}]));
  java.presets={...defaults(),...initialPresets};bedrock.presets=defaults();let giftCatalog=[{id:'1',name:'Rose',diamonds:1}];
  let state={edition:initialEdition,authorization_mode:'checkbox',preset_categories:presetCategories,profiles:{java,bedrock},config:initialEdition==='java'?java:bedrock,preset_catalog:oldBackend?undefined:oldQuantities?presetCatalog.map(({id,name,description})=>({id,name,description})):presetCatalog,presets:initialEdition==='java'?java.presets:bedrock.presets,bedrock:{prepared:false,connected:false},authorized:true,queued:0,log:[]};
  class Element {
    constructor(tag){this.tagName=tag;this.textContent='';this.value='';this.children=[];this.dataset={};this.events={};this.hidden=false;this.isConnected=true;nodes.push(this);}
    append(...items){this.children.push(...items);for(const item of items)item.parentElement=this;}
    replaceChildren(...items){this.children=items;}
    setAttribute(name,value){this[name]=value;}
    focus(){document.activeElement=this;}
    addEventListener(name,fn){this.events[name]=fn;}
  }
  const document={hidden:false,head:new Element('head'),body:new Element('body'),createElement:tag=>new Element(tag),addEventListener:(name,fn)=>listeners[name]=fn};
  const window={addEventListener:(name,fn)=>listeners[name]=fn,OperatorViewRegistry:{register(key,node){pane=node;}}};
  const context={window,document,Date,AbortController,AbortSignal,structuredClone,
    MutationObserver:class{constructor(fn){this.fn=fn;}observe(target,options){observers.push({fn:this.fn,target,options});}disconnect(){}},
    setTimeout(fn,delay){const id=++serial;timers.set(id,{fn,delay});return id;},clearTimeout:id=>timers.delete(id),
    fetch:async(path,options={})=>{
      const data=options.body?JSON.parse(options.body):null;
      requests.push({path,method:options.method||'GET',data});
      if(path==='/minecraft'&&data?.select_only){state.edition=data.edition;state.config=state.profiles[data.edition];state.presets=state.config.presets;state.authorized=false;}
      if(path==='/minecraft/presets'&&data){state.config.presets=structuredClone(data.presets);state.presets=state.config.presets;}
      if(path==='/minecraft/presets/settings'&&data){state.config.limits=structuredClone(data.limits);state.config.name_format=data.name_format;}
      if(path==='/minecraft/authorize'&&data)state.authorized=data.enabled;
      if(path==='/minecraft/disconnect')state.authorized=false;
      const snapshot=path==='/gift-catalog'?{gifts:giftCatalog}:path==='/minecraft/bedrock/prepare'?{command:'/wsserver ws://127.0.0.1:54321/secret'}:structuredClone(state);
      if(options.method==='POST'&&heldPost===path){heldPost=null;await new Promise(resolve=>releasePost=resolve);}
      if(hold&&options.method==='GET'&&path==='/minecraft')await new Promise(resolve=>release=resolve);if(fail)throw Error('offline');return {ok:true,json:async()=>snapshot};}};
  vm.runInNewContext(fs.readFileSync(`${__dirname}/../web/static/minecraft.js`,'utf8'),context);
  const flush=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
  const field=label=>nodes.find(n=>n.tagName==='label'&&n.textContent===label).children[0];
  return {nodes,requests,timers,field,flush,get pane(){return pane;},setState:value=>state={...state,...value},
    fail:value=>fail=value,hold:()=>hold=true,release:()=>{hold=false;release();},
    holdPost:path=>heldPost=path,releasePost:()=>{heldPost=null;releasePost();},
    get serverEdition(){return state.edition;},get activeElement(){return document.activeElement;},
    tab:id=>nodes.find(n=>n.role==='tab'&&n.dataset.category===id),
    panel:id=>nodes.find(n=>n.role==='tabpanel'&&n.dataset.categoryPanel===id),
    catalog:value=>giftCatalog=value,
    preset:(id,control)=>nodes.find(n=>n.dataset[control==='gift'?'presetGift':'presetEnabled']===id),
    async tick(){const [id,timer]=timers.entries().next().value||[];assert.ok(timer,'refresh timer exists');timers.delete(id);timer.fn();await flush();},
    async hidden(value){pane.hidden=value;for(const o of observers)if(o.options.attributes)o.fn([]);await flush();},
    async visibility(value){document.hidden=value;listeners.visibilitychange?.();await flush();},
    async connection(value){pane.isConnected=value;for(const o of observers)if(o.options.childList)o.fn([]);await flush();},
    async detach(){await this.connection(false);},
    async pagehide(){listeners.pagehide?.();await flush();},
    async click(text){await nodes.find(n=>n.tagName==='button'&&(n.textContent===text||n['aria-label']===text)).onclick();await flush();},
    async permission(value){const input=field('Autorizar Minecraft');input.checked=value;await input.events.change();await flush();},
    async edition(value){const select=field('Edición');select.value=value;await select.events.change();await flush();},
    text:()=>nodes.filter(n=>n.tagName==='div').flatMap(n=>n.children).map(n=>n.textContent).join('\n')};
}

test('polling shows delayed command results and preserves unsaved fields',async()=>{
  const s=setup();await s.flush();
  s.field('Dirección privada').value='192.168.1.88';
  s.field('Comandos autorizados: un alias = comando por línea').value='draft = say hello';
  s.field('Contraseña RCON').value='secret draft';
  s.field('Alias para prueba').value='probe';await s.click('Ejecutar alias de prueba');
  await s.tick(); // First poll still has no execution result.
  s.setState({log:[{at:1,text:'Command rejected',alias:'probe',outcome:'rejected',response:'Unknown command <script>'}]});
  await s.tick();
  assert.match(s.text(),/Comando rechazado/);assert.match(s.text(),/Unknown command <script>/);
  assert.equal(s.field('Dirección privada').value,'192.168.1.88');
  assert.equal(s.field('Comandos autorizados: un alias = comando por línea').value,'draft = say hello');
  assert.equal(s.field('Contraseña RCON').value,'secret draft');
  assert.ok(s.requests.filter(r=>r.method==='GET').every(r=>['/minecraft','/gift-catalog'].includes(r.path)));
});

test('refresh does not overlap, retries failures and preserves action notices',async()=>{
  const s=setup();await s.flush();s.field('Alias para prueba').value='probe';await s.click('Ejecutar alias de prueba');
  const notice=s.nodes.find(n=>n.textContent==='Comando enviado a la cola.');
  s.fail(true);await s.tick();assert.equal(notice.textContent,'Comando enviado a la cola.');
  s.fail(false);s.hold();await s.tick();const count=s.requests.length;
  await s.hidden(true);await s.hidden(false);assert.equal(s.requests.length,count);
  s.release();await s.flush();assert.equal(s.timers.size,1);
  await s.tick();assert.equal(s.timers.size,1);
});

test('polling pauses when hidden or detached and resumes when visible',async()=>{
  const s=setup();await s.flush();await s.hidden(true);assert.equal(s.timers.size,0);
  const count=s.requests.length;await s.hidden(false);assert.equal(s.requests.length,count+1);
  await s.visibility(true);assert.equal(s.timers.size,0);
  await s.visibility(false);assert.equal(s.timers.size,1);
  await s.detach();assert.equal(s.timers.size,0);
  const t=setup();await t.flush();await t.pagehide();assert.equal(t.timers.size,0);
});

test('outcome labels preserve literal server responses and older log entries',async()=>{
  const s=setup();await s.flush();
  s.setState({log:[
    ...['success','rejected','connection_error','unconfirmed','cancelled'].map((outcome,i)=>({at:i,text:'detail',alias:'probe',outcome,response:'<b>literal</b>'})),
    {at:8,text:'Minecraft RCON autorizado'}]});await s.tick();
  for(const label of ['Éxito confirmado','Comando rechazado','Error de conexión','Sin confirmar','Cancelado','Minecraft RCON autorizado'])assert.ok(s.text().includes(label),label);
  assert.match(s.text(),/<b>literal<\/b>/);
});

test('child-list attachment resumes polling without a hidden-attribute mutation',async()=>{
  const s=setup();await s.flush();const count=s.requests.length;
  await s.connection(false);assert.equal(s.timers.size,0);
  await s.connection(true);assert.equal(s.requests.length,count+1);
  assert.equal(s.timers.size,1);
  // Unrelated child-list changes must not trigger another immediate refresh.
  await s.connection(true);assert.equal(s.requests.length,count+1);
});

test('slow initial hydration preserves edits and stale pre-action reads are discarded',async()=>{
  const s=setup({holdInitial:true});
  const host=s.field('Dirección privada');host.value='192.168.1.99';host.events.input();
  s.release();await s.flush();assert.equal(host.value,'192.168.1.99');
  s.hold();await s.tick();
  s.setState({authorized:false});await s.click('Desconectar');
  s.release();await s.flush();
  assert.ok(s.nodes.some(n=>n.textContent==='Sin conectar'));
  assert.equal(s.timers.size,1);
  assert.equal(host.value,'192.168.1.99');
});

test('edition selector persists selection, keeps separate drafts and hides RCON credentials',async()=>{
  const s=setup();await s.flush();
  s.field('Comandos autorizados: un alias = comando por línea').value='javaDraft = list';
  s.field('Dirección privada').value='127.0.0.2';s.field('Contraseña RCON').value='secret';
  await s.edition('bedrock');
  assert.equal(s.field('Comandos autorizados: un alias = comando por línea').value,'bed = say hello');
  assert.equal(s.field('Contraseña RCON').parentElement.hidden,true);
  assert.equal(s.field('Dirección privada').parentElement.hidden,true);
  assert.equal(s.field('Contraseña RCON').value,'');
  assert.ok(s.requests.some(r=>r.path==='/minecraft'&&r.data?.edition==='bedrock'&&r.data.select_only));
  s.field('Comandos autorizados: un alias = comando por línea').value='bedDraft = say hi';
  await s.edition('java');
  assert.equal(s.field('Comandos autorizados: un alias = comando por línea').value,'javaDraft = list');
  assert.equal(s.field('Dirección privada').value,'127.0.0.2');
  await s.edition('bedrock');
  assert.equal(s.field('Comandos autorizados: un alias = comando por línea').value,'bedDraft = say hi');
  await s.click('Preparar conexión de Bedrock');
  assert.ok(s.nodes.some(n=>n.textContent==='/wsserver ws://127.0.0.1:54321/secret'));
  await s.edition('java');
  assert.ok(!s.nodes.some(n=>n.textContent.includes(':54321/secret')));
});

test('pending edition selection guards every action handler, including Save',async()=>{
  const s=setup();await s.flush();s.field('Alias para prueba').value='probe';
  s.holdPost('/minecraft');const selecting=s.edition('bedrock');await s.flush();
  const count=s.requests.length;
  await s.permission(true);
  for(const text of ['Guardar conexión y comandos','Ejecutar alias de prueba',
                    'Preparar conexión de Bedrock','Desconectar','Comprobar conexión sin ejecutar un alias']){
    await s.click(text);
  }
  assert.equal(s.requests.length,count,'handlers cannot bypass the shared boundary');
  s.releasePost();await selecting;
  assert.equal(s.serverEdition,'bedrock');assert.equal(s.field('Edición').value,'bedrock');
});

test('pending mode-specific actions guard edition changes in both directions',async()=>{
  for(const [mode,label,path] of [
    ['java','Guardar conexión y comandos','/minecraft'],
    ['java','Ejecutar alias de prueba','/minecraft/run'],['java','Desconectar','/minecraft/disconnect'],
    ['java','Comprobar conexión sin ejecutar un alias','/minecraft/check'],
    ['bedrock','Preparar conexión de Bedrock','/minecraft/bedrock/prepare']]){
    const s=setup();await s.flush();if(mode==='bedrock')await s.edition('bedrock');
    s.field('Alias para prueba').value='probe';s.holdPost(path);const acting=s.click(label);await s.flush();
    const count=s.requests.length;await s.edition(mode==='java'?'bedrock':'java');
    assert.equal(s.requests.length,count,label);assert.equal(s.field('Edición').value,mode,label);
    s.releasePost();await acting;assert.equal(s.serverEdition,mode,label);
    assert.ok(!s.field('Edición').disabled,label);
  }
});

test('uncertain selection keeps controls guarded until polling confirms the actual edition',async()=>{
  const s=setup();await s.flush();s.holdPost('/minecraft');
  const selecting=s.edition('bedrock');await s.flush();
  s.fail(true);s.releasePost();await selecting;
  assert.equal(s.serverEdition,'bedrock');assert.ok(s.field('Edición').disabled);
  const count=s.requests.length;await s.click('Guardar conexión y comandos');
  assert.equal(s.requests.length,count);
  s.fail(false);await s.tick();
  assert.equal(s.field('Edición').value,'bedrock');assert.equal(s.field('Edición').disabled,false);
  assert.equal(s.field('Contraseña RCON').parentElement.hidden,true);
  assert.ok(s.nodes.filter(n=>n.tagName==='button').every(n=>!n.disabled));
});

test('quick-action rows use stable gifts, persist enabled state and preserve edition mappings',async()=>{
  const s=setup();await s.flush();
  assert.equal(s.nodes.filter(n=>n.dataset.quickAction).length,96);
  const gift=s.preset('tnt_rain','gift'),enabled=s.preset('tnt_rain','enabled');
  assert.ok(gift['aria-label'].includes('Lluvia de TNT'));assert.equal(enabled.checked,false);
  gift.value='1';await gift.events.change();await s.flush();
  enabled.checked=true;await enabled.events.change();await s.flush();
  const saved=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data;
  assert.equal(saved.presets.tnt_rain.gift_id,'1');assert.equal(saved.presets.tnt_rain.enabled,true);
  assert.ok(!JSON.stringify(saved).includes('summon'));
  s.catalog([]);await s.click('Actualizar regalos');
  assert.ok(gift.children.some(o=>o.value==='1'&&o.textContent.includes('guardado')));
  await s.edition('bedrock');assert.equal(enabled.checked,false);assert.equal(gift.value,'');
  await s.edition('java');assert.equal(enabled.checked,true);assert.equal(gift.value,'1');
  await s.tick();assert.equal(enabled.checked,true);
});

test('preset saves share the operation boundary and uncertain saves reconcile actual state',async()=>{
  const s=setup();await s.flush();const gift=s.preset('tnt_rain','gift');
  gift.value='1';s.holdPost('/minecraft/presets');const saving=gift.events.change();await s.flush();
  const count=s.requests.length;await s.edition('bedrock');assert.equal(s.serverEdition,'java');
  await s.click('Probar Lluvia de TNT');assert.equal(s.requests.length,count);
  s.fail(true);s.releasePost();await saving;await s.flush();
  assert.ok(s.field('Edición').disabled);s.fail(false);await s.tick();
  assert.equal(gift.value,'1');assert.equal(s.field('Edición').disabled,false);
  await s.click('Probar Lluvia de TNT');await s.click('Detener acciones rápidas');
  assert.ok(s.requests.some(r=>r.path==='/minecraft/presets/test'&&r.data.id==='tnt_rain'));
  assert.ok(s.requests.some(r=>r.path==='/minecraft/presets/stop'));
});

test('all catalog actions exist synchronously and survive unavailable or old APIs',async()=>{
  for(const options of [{holdInitial:true},{failInitial:true},{oldBackend:true}]){
    const s=setup(options);
    assert.equal(s.nodes.filter(n=>n.dataset.quickAction).length,96);
    assert.ok(s.nodes.some(n=>n.textContent==='Acciones predeterminadas'));
    await s.flush();assert.equal(s.nodes.filter(n=>n.dataset.quickAction).length,96);
    if(options.holdInitial){s.release();await s.flush();}
    else assert.equal(s.preset('tnt_rain','gift').disabled,true);
    assert.ok(!s.nodes.some(n=>n.textContent.includes('Escribe AUTORIZAR')));
    assert.ok(!s.nodes.some(n=>n.tagName==='button'&&n.textContent.startsWith('Autorizar y probar')));
    for(const summary of ['Opciones avanzadas','Ayuda']){
      const node=s.nodes.find(n=>n.tagName==='summary'&&n.textContent===summary);
      assert.ok(node);assert.ok(!node.parentElement.open);
    }
  }
});

test('authorization checkbox posts real boolean consent, revokes, and reconciles failures',async()=>{
  const s=setup();await s.flush();await s.permission(false);
  assert.equal(s.field('Autorizar Minecraft').checked,false);
  await s.permission(true);
  const request=s.requests.filter(r=>r.path==='/minecraft/authorize').at(-1);
  assert.deepEqual(request.data,{edition:'java',enabled:true});
  assert.equal(s.field('Autorizar Minecraft').checked,true);
  s.holdPost('/minecraft/authorize');const revoking=s.permission(false);await s.flush();
  const count=s.requests.length;await s.edition('bedrock');assert.equal(s.requests.length,count);
  s.fail(true);s.releasePost();await revoking;
  assert.equal(s.field('Autorizar Minecraft').checked,false);assert.ok(s.field('Edición').disabled);
  s.fail(false);await s.tick();assert.equal(s.field('Autorizar Minecraft').checked,false);
  assert.equal(s.field('Edición').disabled,false);
});
 test('Minecraft simulator and limits preserve drafts and serialize execution with edition changes',async()=>{
  const s=setup();await s.flush();
  assert.equal(s.field('Nombre del donante').value,'Prueba');
  const gift=s.field('Regalo para simular');gift.value='1';
  const name=s.field('Nombre del donante');name.value='Ana';
  const interval=s.field('Intervalo mínimo (segundos)');interval.value='7';await interval.events.input();
  await s.tick();assert.equal(interval.value,'7');assert.equal(name.value,'Ana');
  s.holdPost('/minecraft/presets/simulate');const sending=s.click('Simular regalo');await s.flush();
  const count=s.requests.length;await s.edition('bedrock');await s.click('Probar Zombi');
  assert.equal(s.requests.length,count);s.releasePost();await sending;
  assert.deepEqual(s.requests.find(r=>r.path==='/minecraft/presets/simulate').data,{edition:'java',gift_id:'1',user:'Ana'});
  await s.click('Guardar límites');
  const saved=s.requests.find(r=>r.path==='/minecraft/presets/settings').data;
  assert.equal(saved.limits.interval,7);assert.equal(saved.limits.per_minute,20);
  assert.ok(!s.requests.some(r=>r.path.startsWith('/simulation')));
 });

test('safety settings keep edition drafts and reconcile uncertain saves without granting execution',async()=>{
 const s=setup();await s.flush();const interval=s.field('Intervalo mínimo (segundos)');
 interval.value='8';interval.events.input();await s.edition('bedrock');assert.equal(Number(interval.value),3);
 interval.value='9';interval.events.input();await s.edition('java');assert.equal(Number(interval.value),8);
 s.holdPost('/minecraft/presets/settings');const saving=s.click('Guardar límites');await s.flush();
 const count=s.requests.length;await s.click('Simular regalo');await s.permission(false);await s.edition('bedrock');assert.equal(s.requests.length,count);
 s.fail(true);s.releasePost();await saving;assert.ok(s.field('Edición').disabled);
 s.fail(false);await s.tick();assert.equal(Number(interval.value),8);assert.equal(s.field('Edición').disabled,false);
 s.catalog([]);await s.click('Actualizar regalos');
 const gift=s.preset('zombie','gift');gift.value='saved';await gift.events.change();
 assert.ok(s.field('Regalo para simular').children.some(o=>o.value==='saved'&&o.textContent.includes('guardado')));
});

test('spawn quantities are visible, autosave per edition and preserve typing during polling',async()=>{
 const s=setup();await s.flush();
 assert.equal(s.nodes.filter(n=>n.dataset.quickAction).length,96);
 const quantity=s.nodes.find(n=>n.dataset.presetQuantity==='zombie');assert.ok(quantity);
 assert.equal(Number(quantity.value),1);assert.equal(quantity['aria-label'],'Cantidad de Zombi');
 quantity.value='2';quantity.events.input();await s.tick();assert.equal(quantity.value,'2');
 await quantity.events.change();await s.flush();
 assert.equal(s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data.presets.zombie.quantity,2);
 const gift=s.preset('zombie','gift');gift.value='1';await gift.events.change();
 assert.equal(s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data.presets.zombie.quantity,2);
 await s.edition('bedrock');assert.equal(Number(quantity.value),1);
 await s.edition('java');assert.equal(Number(quantity.value),2);
 assert.ok(!s.nodes.some(n=>n.dataset.presetQuantity==='rain'));
});

test('old quantity capability blocks mutation and uncertain quantity saves recover actual numbers',async()=>{
 const old=setup({oldQuantities:true});await old.flush();
 assert.equal(old.nodes.filter(n=>n.dataset.quickAction).length,96);
 assert.ok(old.preset('zombie','gift').disabled);
 const s=setup();await s.flush();const quantity=s.nodes.find(n=>n.dataset.presetQuantity==='pig');
 quantity.value='4';quantity.events.input();s.holdPost('/minecraft/presets');const saving=quantity.events.change();await s.flush();
 const count=s.requests.length;await s.edition('bedrock');await s.click('Probar Cerdo');assert.equal(s.requests.length,count);
 s.fail(true);s.releasePost();await saving;await s.flush();assert.ok(quantity.disabled);
 s.fail(false);await s.tick();assert.equal(Number(quantity.value),4);assert.equal(quantity.disabled,false);
});

test('catalog category tabs exist before GET and keep only one category visible',async()=>{
 const s=setup({holdInitial:true});
 assert.equal(s.nodes.filter(n=>n.dataset.quickAction).length,96);
 const tabs=s.nodes.filter(n=>n.role==='tab');assert.equal(tabs.length,9);
 assert.equal(s.nodes.filter(n=>n.role==='tabpanel'&&!n.hidden).length,1);
 assert.ok(tabs.find(n=>n.textContent.startsWith('Jefes')));
 s.release();await s.flush();
});

test('category keyboard navigation and per-edition choices survive polling without mutations',async()=>{
 const s=setup({initialPresets:{zombie:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:2}}});await s.flush();
 assert.equal(s.tab('undead')['aria-selected'],'true');assert.equal(s.panel('undead').hidden,false);
 assert.match(s.tab('undead').textContent,/1/);
 const posts=s.requests.filter(r=>r.method==='POST').length;
 s.tab('undead').events.keydown({key:'End',preventDefault(){}});
 assert.equal(s.activeElement,s.tab('bosses'));assert.equal(s.tab('bosses').tabIndex,0);
 s.tab('bosses').events.keydown({key:'ArrowRight',preventDefault(){}});
 assert.equal(s.activeElement,s.tab('actions'));
 s.tab('actions').events.keydown({key:'ArrowLeft',preventDefault(){}});
 assert.equal(s.activeElement,s.tab('bosses'));
 s.tab('bosses').events.keydown({key:'Home',preventDefault(){}});
 assert.equal(s.activeElement,s.tab('actions'));
 s.tab('end').onclick();await s.tick();assert.equal(s.panel('end').hidden,false);
 assert.equal(s.requests.filter(r=>r.method==='POST').length,posts);
 await s.edition('bedrock');assert.equal(s.panel('actions').hidden,false);
 s.tab('animals').onclick();await s.edition('java');assert.equal(s.panel('end').hidden,false);
 assert.equal(s.nodes.filter(n=>n.role==='tabpanel'&&!n.hidden).length,1);
});

test('hidden category drafts and mappings survive full saves, pending operations and recovery',async()=>{
 const s=setup({initialPresets:{cow:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:3},zombie:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:2}}});await s.flush();
 assert.equal(s.panel('animals').hidden,false);
 const cow=s.nodes.find(n=>n.dataset.presetQuantity==='cow');cow.value='7';cow.events.input();
 s.tab('undead').onclick();await s.tick();assert.equal(cow.value,'7');
 const zombie=s.preset('zombie','enabled');zombie.checked=false;await zombie.events.change();await s.flush();
 let body=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data;
 assert.equal(body.presets.cow.quantity,3);assert.equal(body.presets.cow.gift_id,'1');assert.equal(cow.value,'7');
 s.tab('animals').onclick();s.holdPost('/minecraft/presets');const saving=cow.events.change();await s.flush();
 const count=s.requests.length;s.tab('bosses').onclick();await s.click('Probar Warden');assert.equal(s.requests.length,count);
 assert.equal(s.panel('bosses').hidden,false);
 s.fail(true);s.releasePost();await saving;await s.flush();s.fail(false);await s.tick();
 assert.equal(Number(cow.value),7);assert.equal(s.panel('bosses').hidden,false);
 body=s.requests.filter(r=>r.path==='/minecraft/presets').at(-1).data;
 assert.equal(body.presets.cow.quantity,7);assert.equal(body.presets.zombie.enabled,false);assert.equal(body.presets.zombie.quantity,2);
});

test('a category chosen before initial hydration binds only to the confirmed edition',async()=>{
 for(const initialEdition of ['java','bedrock']){
  const s=setup({holdInitial:true,initialEdition,initialPresets:{cow:{gift_id:'1',gift_name:'Rose',enabled:true,quantity:2}}});
  s.tab('bosses').onclick();await s.flush();assert.equal(s.panel('bosses').hidden,false);
  s.release();await s.flush();assert.equal(s.field('Edición').value,initialEdition);
  assert.equal(s.panel('bosses').hidden,false);await s.tick();assert.equal(s.panel('bosses').hidden,false);
  const other=initialEdition==='java'?'bedrock':'java';await s.edition(other);
  assert.equal(s.panel(other==='java'?'animals':'actions').hidden,false);
  s.tab('end').onclick();await s.edition(initialEdition);assert.equal(s.panel('bosses').hidden,false);
  await s.edition(other);assert.equal(s.panel('end').hidden,false);
 }
});
