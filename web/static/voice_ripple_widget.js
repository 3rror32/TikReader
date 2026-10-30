(()=>{
 let state={amplitude:0},stopped=false,timer,controller;
 const params=new URLSearchParams(location.search);
 const catalog=params.get('preview')==='1'&&params.get('catalog')==='1';
 function read(){
  if(!catalog)return state;
  // Catalog cards rotate through the shared effects locally, without touching a live feed.
  const t=performance.now()/1000,amplitude=.18+.55*(.5+.5*Math.sin(t*3.6))**2;
  const styles=VoiceRippleRenderer.STYLES,style=styles[Math.floor(t/3)%styles.length];
  return {style,avatar:'🎙️',color:'#60d9e8',intensity:1,speed:1,amplitude,
   bands:Array.from({length:16},(_,i)=>amplitude*(.45+.55*Math.sin(t*2+i*.4)**2))};
 }
 const dispose=VoiceRippleRenderer.mount(document.querySelector('canvas'),read);
 async function poll(){
  if(stopped||document.hidden||controller&&!controller.signal.aborted)return;
  const current=new AbortController();controller=current;const timeout=setTimeout(()=>current.abort(),900);
  try{const response=await fetch('/voice-ripples',{signal:current.signal,cache:'no-store'});if(!response.ok)throw Error();state=await response.json();}catch(_){state.amplitude=0;state.bands=Array(16).fill(0);}finally{clearTimeout(timeout);if(controller===current){controller=undefined;if(!stopped&&!document.hidden)timer=setTimeout(poll,70);}}
 }
 function visibilityChanged(){
  if(document.hidden){clearTimeout(timer);timer=undefined;controller?.abort();return;}
  if(!catalog&&!stopped){clearTimeout(timer);timer=undefined;poll();}
 }
 if(!catalog)poll();
 document.addEventListener('visibilitychange',visibilityChanged);
 addEventListener('pagehide',()=>{stopped=true;clearTimeout(timer);controller?.abort();dispose();});
})();
