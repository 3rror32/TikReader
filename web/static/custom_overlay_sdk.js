/* Bridge available inside every imported overlay package. */
(()=>{
 const target=new EventTarget();
 const api={settings:{},manifest:{},ready:false,on(type,handler){target.addEventListener(type,handler);return()=>target.removeEventListener(type,handler)},once(type,handler){target.addEventListener(type,handler,{once:true})}};
 function emit(type,detail){const event=new CustomEvent(type,{detail});target.dispatchEvent(event);window.dispatchEvent(new CustomEvent('tikreader:'+type,{detail}));}
 function cssVariables(settings){for(const[key,value]of Object.entries(settings||{})){if(['string','number','boolean'].includes(typeof value))document.documentElement.style.setProperty('--tikreader-'+key.replaceAll('_','-'),String(value));}}
 window.TikReaderOverlay=api;
 window.addEventListener('message',event=>{
  const message=event.data;if(!message||message.source!=='tikreader')return;
  if(message.kind==='init'){
   api.settings=message.settings||{};api.manifest=message.manifest||{};api.preview=message.preview===true;api.ready=true;cssVariables(api.settings);emit('ready',{settings:api.settings,manifest:api.manifest,preview:api.preview});emit('settings',{settings:api.settings});
  }else if(message.kind==='event'){
   const detail={data:message.data||{},type:message.event,types:message.types||[message.event],preview:message.preview===true};emit('event',detail);if(message.event)emit(message.event,detail);
  }
 });
 parent.postMessage({source:'tikreader-overlay',kind:'ready'},'*');
})();
