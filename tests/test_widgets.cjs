process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
function setup(preview=true,panel='stats',data={production:{emergency:true}},customSettings={},search,fetchOverride){
 const styles=new Map(),elements=new Map(),timers=[],events={},requests=[];
 const node=tag=>({tagName:tag.toUpperCase(),children:[],dataset:{},style:{setProperty(){}},classList:{add(){}},setAttribute(){},append(...items){this.children.push(...items)},replaceChildren(...items){this.children=items},querySelector(tag){return this.children.find(x=>x.tagName===tag.toUpperCase())},remove(){}});
 const root=node('main'),connection=node('small'),body=node('body');body.dataset.widget=panel;
 const document={body,documentElement:{style:{setProperty:(k,v)=>styles.set(k,v)}},getElementById:id=>id==='widget'?root:connection,createElement:node,createTextNode:text=>({textContent:text})};
 const settings={font_size:37,title_size:19,font_family:'Georgia',background:'#123456',text_color:'#abcdef',accent_color:'#fedcba',border_color:'#333333',radius:27,opacity:60,show_connection:true,show_name:true,show_background:true,alignment:'center',layout:'stack',animation:'none',max_items:8,theme:'dark',...customSettings};
 vm.runInNewContext(fs.readFileSync('web/static/widgets.js','utf8'),{document,window:{addEventListener:(name,fn)=>events[name]=fn},location:{search:search??(preview?'?preview=1':''),origin:'http://localhost'},URL,URLSearchParams,AbortSignal,Date,setTimeout:fn=>{timers.push(fn);return timers.length},clearTimeout(){},fetch:async url=>{requests.push(url);return fetchOverride?fetchOverride(url,{settings,data,requests}):{ok:true,json:async()=>url.includes('widget-settings')?{settings}:data}}});
 return{styles,root,connection,body,timers,events,requests};
}
test('widget preview uses CSS variables consumed by actual stylesheet and never reads live data',async()=>{
 const ui=setup();await ui.timers.shift()();
 const css=fs.readFileSync('web/static/widgets.css','utf8');
 for(const [name]of ui.styles)assert.ok(css.includes(`var(${name}`),`${name} is not consumed by CSS`);
 assert.equal(ui.styles.get('--widget-size'),'37px');assert.equal(ui.styles.get('--widget-font'),'Georgia,sans-serif');
 assert.equal(ui.body.dataset.layout,'stack');assert.equal(ui.root.children.length,4);assert.ok(ui.requests.every(x=>!x.startsWith('/broadcast/')));assert.equal(ui.timers.length,0);
});
test('unsaved preview preferences survive periodic refresh without publishing settings',async()=>{
 const ui=setup();await ui.timers.shift()();ui.events.message({origin:'http://localhost',data:{type:'widget-preview-settings',settings:{font_size:48}}});
 await ui.timers.at(-1)();assert.equal(ui.styles.get('--widget-size'),'48px');assert.equal(ui.requests.length,1);
});
test('point-drop editor refreshes on an explicit same-origin action message',async()=>{
 const ui=setup(false,'point-drop',{}, {},'?editor=1');
 await ui.timers.shift()();assert.equal(ui.requests.filter(url=>url==='/broadcast/overlay-games').length,1);
 const scheduled=ui.timers.length;
 ui.events.message({origin:'http://untrusted.example',data:{type:'widget-point-drop-refresh'}});
 assert.equal(ui.timers.length,scheduled);
 ui.events.message({origin:'http://localhost',data:{type:'widget-point-drop-refresh'}});
 assert.ok(ui.timers.length>scheduled);
 await ui.timers.at(-1)();assert.equal(ui.requests.filter(url=>url==='/broadcast/overlay-games').length,2);
});
test('point-drop editor coalesces refresh messages received during an active refresh',async()=>{
 let releaseGames,markEntered;const gamesGate=new Promise(resolve=>releaseGames=resolve),entered=new Promise(resolve=>markEntered=resolve);let gameRequests=0;
 const fetchOverride=async(url,{settings})=>{
  if(url.includes('widget-settings'))return{ok:true,json:async()=>({settings})};
  if(url==='/broadcast/overlay-games'){gameRequests++;if(gameRequests===1){markEntered();await gamesGate;}return{ok:true,json:async()=>({muted:true})};}
  return{ok:true,json:async()=>({})};
 };
 const ui=setup(false,'point-drop',{}, {},'?editor=1',fetchOverride);
 const active=ui.timers.shift()();await entered;
 const scheduled=ui.timers.length;
 for(let index=0;index<3;index++)ui.events.message({origin:'http://localhost',data:{type:'widget-point-drop-refresh'}});
 const messages=ui.timers.splice(scheduled);for(const callback of messages)await callback();
 releaseGames();await active;
 assert.equal(gameRequests,1);
 assert.ok(ui.timers.length>0,'one follow-up refresh is queued after the active request');
 await ui.timers.pop()();assert.equal(gameRequests,2);
});
test('public widgets still hide during emergency',async()=>{
 const ui=setup(false);await ui.timers.shift()();assert.equal(ui.body.style.visibility,'hidden');assert.equal(ui.root.children.length,0);
});

for(const panel of ['timer','fortune-wheel','point-drop'])test(panel+' hides during emergency',async()=>{const ui=setup(false,panel,{muted:true});await ui.timers.shift()();assert.equal(ui.root.children.length,0);assert.ok(ui.requests.includes('/broadcast/overlay-games'));});
test('timer overlay matches the scene timer and announces its state',async()=>{const ui=setup(true,'timer');await ui.timers.shift()();const box=ui.root.children[0],state=box.children.at(-1);assert.equal(box.dataset.running,'yes');assert.equal(state.className,'timer-overlay-state');assert.equal(state.textContent,'EN MARCHA');assert.match(box.children.find(x=>x.tagName==='P').textContent,/^\d+:\d{2}:\d{2}$/)});
test('timer overlay exposes title, format, state, motion and final-seconds warning',async()=>{const ui=setup(true,'timer',{}, {timer_title:'INICIAMOS EN',timer_format:'ms',timer_show_label:true,timer_show_state:false,timer_warning_seconds:800,timer_digit_animation:'slide',timer_animation_speed:680,timer_glow:false});await ui.timers.shift()();const box=ui.root.children[0];assert.equal(box.children[0].textContent,'INICIAMOS EN');assert.equal(box.children.find(x=>x.tagName==='P').textContent,'12:34');assert.equal(box.children.some(x=>x.className==='timer-overlay-state'),false);assert.equal(box.dataset.warning,'yes');assert.equal(box.dataset.digitAnimation,'slide');assert.equal(box.dataset.glow,'off')});
test('timer overlay keeps the reference treatment and offers distinct designs',()=>{const css=fs.readFileSync('web/static/widgets.css','utf8');assert.match(css,/\.timer-value\{[^}]*var\(--widget-font\)[^}]*color:var\(--widget-accent\)/);assert.match(css,/\.timer-overlay>strong\{[^}]*'IBM Plex Mono'[^}]*letter-spacing:2px/);assert.match(css,/\.timer-overlay-state\{[^}]*'IBM Plex Mono'/);for(const theme of ['light','neon','minimal'])assert.match(css,new RegExp(`data-theme=${theme}`));for(const motion of ['pulse','slide','flip'])assert.match(css,new RegExp(`data-digit-animation=${motion}`));assert.match(css,/data-warning=yes/);assert.match(css,/data-glow=off/);});
test('subscriber goal renders observed total and saved target',async()=>{const ui=setup(false,'goal-subscribers',{session:'s',production:{scene:'talk'},stats:{subscribers:7},connection:{connected:true},overlay_goals:{'goal-subscribers':{goal:20}}});await ui.timers.shift()();assert.equal(ui.root.children[0].querySelector('p').children.map(n=>n.textContent).join(''),'7 / 20');assert.equal(ui.root.children[0].querySelector('progress').max,20)});
test('custom goal uses saved value without URL parameters',async()=>{const ui=setup(false,'goal-custom-1',{session:'s',production:{scene:'talk'},stats:{},connection:{connected:true},overlay_goals:{'goal-custom-1':{goal:50,value:12}}});await ui.timers.shift()();assert.equal(ui.root.children[0].querySelector('p').children.map(n=>n.textContent).join(''),'12 / 50');assert.equal(ui.root.children[0].querySelector('progress').value,12)});
