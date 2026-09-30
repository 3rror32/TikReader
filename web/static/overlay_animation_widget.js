(()=>{
 const key=document.body.dataset.effect,root=document.getElementById('effect-stage'),preview=new URLSearchParams(location.search).get('preview')==='1',queue=new EffectQueue({limit:key==='cannon'?30:4,maxAge:key==='cannon'?Infinity:12000});let livePush=false,refreshTimer=0;
 let epoch=null,cursor=0;
 const sample={user:'TikReader',gift:'Rosa',count:10,title:'¡Lo logramos!'};
 if(preview){
  let sampleSettings={...window.OverlayAnimationDefaults(key),sound:'none'};
  const demo=sample;
  const submit=()=>{const captured={...sampleSettings};const run=()=>OverlayAnimationRenderer.render(root,key,captured,demo,true);run.units=demo.count;queue.submit(run);};
  if(key==='cannon'){
   document.body.classList.add('cannon-preview');const tools=document.createElement('aside');tools.className='cannon-queue-controls';
   const count=document.createElement('span'),retry=document.createElement('button'),pause=document.createElement('button'),clear=document.createElement('button');
   retry.type=pause.type=clear.type='button';retry.textContent='Probar animación';retry.onclick=submit;
   pause.textContent='Pausar fila';clear.textContent='Vaciar pendientes';tools.append(count,retry,pause,clear);document.body.append(tools);
   pause.onclick=()=>{if(queue.paused){queue.resume();pause.textContent='Pausar fila';}else{queue.pause();pause.textContent='Continuar fila';}const scene=root.querySelector('.effect-cannon');if(scene)scene.dataset.queuePaused=String(queue.paused);};
   clear.onclick=()=>{queue.clearPending();const scene=root.querySelector('.effect-cannon');if(scene)scene.dataset.discardPending='true';};
   setInterval(()=>{const s=queue.stats();count.textContent=`${s.paused?'Fila pausada':s.active?'En curso':'Lista'} · ${queue.items.reduce((n,item)=>n+(item.run.units||1),0)+Number(root.querySelector('.arcade-launcher')?.dataset.pending||0)} rosas en fila${s.skipped?' · '+s.skipped+' omitidos por límite':''}`;},200);
  }else setInterval(()=>{if(!queue.stats().active)submit();},250);
  window.addEventListener('message',e=>{
   if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='animation-preview')return;
   sampleSettings={...sampleSettings,...e.data.settings};
   if(key==='cannon'){if(e.data.command==='enqueue')submit();}
   else{const previous=queue.current;queue.clearPending();submit();previous?.finish?.();}
  });
  if(window.OverlayStudio)submit();else window.addEventListener('tikreader:studio-ready',submit,{once:true});return;
 }
 async function refresh(){try{
  const r=await fetch('/broadcast/animations/'+key,{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d=await r.json();
  if(epoch!==d.epoch){queue.clear();epoch=d.epoch;cursor=d.serial;}
  if(d.muted){queue.clear();if(key==='cannon')root.replaceChildren();}else for(const e of d.events)if(e.id>cursor){
   if(key==='hearts'){
    if(queue.current?.extend?.())continue;
    // Keep only the latest like burst while the previous scene fades out.
    queue.clearPending();
   }
   queue.submit(()=>OverlayAnimationRenderer.render(root,key,e.settings,e.record));
  }
  cursor=d.serial;
 }catch(_){if(key!=='cannon')queue.clear();}finally{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,livePush?5000:800);}}
 window.addEventListener('tikreader:runtime-ready',event=>{livePush=true;event.detail?.onData?.(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,0);});});
 if(window.OverlayStudio)refresh();else window.addEventListener('tikreader:studio-ready',refresh,{once:true});
})();
