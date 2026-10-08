(()=>{
 const frame=document.getElementById('custom-overlay-frame'),error=document.getElementById('custom-overlay-error');
 if(!frame)return;
 const manifest=JSON.parse(document.getElementById('custom-overlay-manifest').textContent),settings=JSON.parse(document.getElementById('custom-overlay-settings').textContent);
 const query=new URLSearchParams(location.search),preview=query.get('preview')==='1';
 const active=settings.enabled!==false||preview;frame.hidden=!active;
 let initialized=false;
 const samples={gift:{user:'@Carlos',gift:'Rosa',count:5,diamonds:5,avatar_url:''},follow:{user:'@María',avatar_url:''},comment:{user:'@Alex',comment:'¡Qué buen LIVE!'},stats:{likes:1250,viewers:84,gifts:16}};
 function post(message){frame.contentWindow?.postMessage({source:'tikreader',...message},'*')}
 function init(){if(initialized)return;initialized=true;post({kind:'init',manifest,settings,preview});if(preview)setTimeout(()=>post({kind:'event',event:'gift',types:['gift'],data:samples.gift,preview:true}),100)}
 frame.addEventListener('load',()=>setTimeout(init,250));
 window.addEventListener('message',event=>{
  const message=event.data;
  if(message?.source==='tikreader-overlay'&&message.kind==='ready')init();
  if(message?.source==='tikreader-preview'&&message.kind==='replay')post({kind:'event',event:message.event||'gift',types:[message.event||'gift'],data:samples[message.event]||samples.gift,preview:true});
 });
 window.addEventListener('error',event=>{error.hidden=false;error.textContent='El overlay produjo un error: '+event.message});
 function attach(transport){const receive=event=>{let type=event.detail.type,data=event.detail.payload;if(type==='overlay_event'&&data?.type){type=data.type;data=data.data||{}}else if(type==='new_comment')type='comment';else if(type==='gift_history'){type='gift';data=data?.gifts?.[0]||data}else if(type==='stats_update')type='stats';if(manifest.events?.length&&!manifest.events.includes(type))return;post({kind:'event',event:type,types:event.detail.types||[type],data,preview:false})};if(transport?.onEvent)transport.onEvent(receive);else transport?.onData?.(receive)}
 if(active&&!preview){if(window.TikReaderOverlay?.onEvent||window.TikReaderOverlay?.onData)attach(window.TikReaderOverlay);else window.addEventListener('tikreader:runtime-ready',event=>attach(event.detail),{once:true});}
})();
