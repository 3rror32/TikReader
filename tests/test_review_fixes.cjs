process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');

test('wheel emergency cancels animation and resolves its pending operation',async()=>{
 const window={addEventListener(){}},disc={style:{},classList:{add(){},remove(){}}};
 vm.runInNewContext(fs.readFileSync('web/static/wheel_motion.js','utf8'),{window,document:{addEventListener(){}},
  matchMedia:()=>({matches:false}),performance:{now:()=>0},requestAnimationFrame:()=>1,cancelAnimationFrame(){}});
 const pending=window.WheelMotion.spin({disc,startAngle:0,endAngle:1000,duration:5,sound:false});
 window.WheelMotion.mute(true);assert.equal(await pending,false);
 assert.equal(await window.WheelMotion.spin({disc,sound:false}),false);
});

function preview(){
 const source=fs.readFileSync('web/static/custom_voice.js','utf8'),listeners={},pending=[],revoked=[];
 const counts={plays:0,pauses:0};
 const document={addEventListener:(name,fn)=>listeners[name]=fn};
 const context=vm.createContext({document,window:{},status:{textContent:''},AbortSignal,AbortController,
  $:id=>({value:id==='custom-voice-sample'?'hola':'.5'}),source:()=> 'local',
  fetch:()=>new Promise(resolve=>pending.push(resolve)),
  URL:{createObjectURL:()=>`blob:${revoked.length}`,revokeObjectURL:url=>revoked.push(url)},
  Audio:function(){this.pause=()=>counts.pauses++;this.play=async()=>{counts.plays++}}
 });
 const stop=source.split('\n').find(line=>line.includes('function stopPreview('));
 const muted=source.split('\n').find(line=>line.includes("document.addEventListener('tikreader:audio-muted'"));
 const render=source.split('\n').find(line=>line.includes('async function localAudio('));
 const handler=source.split('\n').find(line=>line.includes("$('custom-voice-test').onclick="));
 vm.runInContext(`let previewController=null,previewUrl=null,previewGeneration=0,previewAudio=null,previewUtterance=null;${stop}\n${muted}\n${render}\nvar run=${handler.slice(handler.indexOf('async()=>'))}`,context);
 return {counts,revoked,run:()=>context.run(),finish:()=>pending.shift()({ok:true,blob:async()=>({})}),mute:()=>{context.window.tikreaderAudioMuted=true;listeners['tikreader:audio-muted']({detail:true})}};
}

test('custom RVC preview completing after emergency never plays and releases its blob',async()=>{
 const p=preview(),job=p.run();p.mute();p.finish();await job;
 assert.equal(p.counts.plays,0);assert.equal(p.revoked.length,1);
});
test('emergency pauses an already playing custom preview',async()=>{
 const p=preview(),job=p.run();p.finish();await job;assert.equal(p.counts.plays,1);
 p.mute();assert.equal(p.counts.pauses,1);assert.equal(p.revoked.length,1);
});
test('a newer voice preview cancels stale generation',async()=>{
 const p=preview(),old=p.run(),current=p.run();p.finish();await old;assert.equal(p.counts.plays,0);
 p.finish();await current;assert.equal(p.counts.plays,1);
});

test('timer shortcuts preserve focused buttons and ignore held keys',async()=>{
 const source=fs.readFileSync('web/static/live_games.js','utf8'),calls=[];let handler;
 const context={document:{addEventListener:(_,fn)=>handler=fn},timerState:{classList:{contains:()=>false}},
  timerCall:async action=>calls.push(action),renderTimer(){},showTimerError(){}};
 vm.runInNewContext(source.split('\n').find(line=>line.includes("document.addEventListener('keydown'")),context);
 const event={code:'Space',key:' ',target:{closest:()=>true},preventDefault(){calls.push('prevent')}};
 await handler(event);assert.equal(calls.length,0);
 await handler({...event,target:{closest:()=>false},repeat:true});assert.equal(calls.length,0);
 await handler({...event,target:{closest:()=>false}});assert.deepEqual(calls,['prevent','start']);
});

test('operator receives automatic wheel results and drop score without reloading',async()=>{
 const source=fs.readFileSync('web/static/live_games.js','utf8');
 const deposits=[],score={},result={},disc={style:{}},history={children:[],prepend(x){this.children.unshift(x)}};
 const context=vm.createContext({overlayCall:async()=>({wheel:{serial:2,winner:'Premio',spinning:false,angle:1080},drop:{score:8,events:[{id:8,at:Date.now()/1000}]}}),
  score,wheel:{hidden:false},drop:{hidden:false},wheelResult:result,wheelDisc:disc,wheelHistory:history,showDeposit:(d,e)=>deposits.push(e.id),el:(_,text)=>text,
  configNote:{},arena:{querySelectorAll:()=>[]},Date,document:{activeElement:null},bankStateRevision:0,dropActionBusy:false,hydrateBankState:()=>({}),publishBankHydration(){},bankSaving:false,sizePending:false,sizeSending:false,dropSize:{},bankSelect:{},piggy:{},window:{PiggyBank:{setShapes(){},setSize(){},prepare(){}}}});
 vm.runInContext('let spinning=false,wheelSerial=0,total=0,settledCoins=0;'+source.slice(source.indexOf('  let gamesBusy='),source.indexOf('  setInterval(syncGames')),context);
 await context.syncGames();assert.equal(score.textContent,8);assert.equal(result.textContent,'Resultado: Premio');assert.deepEqual(deposits,[8]);
});

for(const [file,name,count,pigName] of [['web/static/live_games.js','settleCoin','settledCoins','piggy'],['web/static/widgets.js','settleDrop','settledDrops','pig']]){
 test(`${name} passes deposits to the shared physics engine`,()=>{
  const source=fs.readFileSync(file,'utf8'),line=source.split('\n').find(x=>x.includes(`function ${name}(`)),calls=[];
  const pig={},token={},event={id:8},context=vm.createContext({[pigName]:pig,window:{PiggyBank:{settle:(...args)=>calls.push(args)}}});
  vm.runInContext(`let ${count}=0;${line}`,context);
  context[name](token,event,pig);
  assert.deepEqual(calls,[[token,event,pig]]);
  assert.equal(vm.runInContext(count,context),1);
 });
}
