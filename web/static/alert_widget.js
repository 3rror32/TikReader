(() => {
  const root=document.getElementById('alerts'),queue=new EffectQueue();let epoch=null,cursor=0,livePush=false,refreshTimer=0;
  if(new URLSearchParams(location.search).has('preview')){
    const stage=document.createElement('div'),card=document.createElement('div'),caption=document.createElement('p');
    stage.className='alert-stage';stage.dataset.position='center';card.className='alert-visual';card.style.setProperty('--alert-color','#ffffff');card.style.setProperty('--alert-size','48px');caption.className='alert-caption';caption.textContent='¡Gracias por tu regalo!';card.append(caption);stage.append(card);root.append(stage);return;
  }
  async function refresh(){try{const r=await fetch('/broadcast/alerts',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d=await r.json();
    if(epoch!==d.epoch){queue.clear();epoch=d.epoch;cursor=d.serial;}
    if(d.muted){queue.clear();root.replaceChildren();}
    else for(const event of d.events)if(event.id>cursor)queue.submit(()=>AlertRenderer.render(root,event.template,event.text));
    cursor=d.serial;
  }catch(_){queue.clear();root.replaceChildren();}finally{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,livePush?5000:1000);}}
  window.addEventListener('tikreader:runtime-ready',event=>{livePush=true;event.detail?.onData?.(()=>{clearTimeout(refreshTimer);refreshTimer=setTimeout(refresh,0);});});
  refresh();
})();
