// Integration only: original.js is the byte-for-byte upstream Raindrop FX bundle.
(()=>{
 const canvas=document.getElementById('original-rain'),preview=new URLSearchParams(location.search).get('preview')==='1';
 let settings=JSON.parse(document.getElementById('season-settings').textContent),fx,ready=false,muted=!preview,last=0,total=0,background='',loading=false,revision=0;
 let viewportWidth=0,viewportHeight=0,resizeFrame=0;
 function example(){
  const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');
  const sky=x.createLinearGradient(0,0,0,720);sky.addColorStop(0,'#94b1bd');sky.addColorStop(.6,'#496777');sky.addColorStop(1,'#18282e');x.fillStyle=sky;x.fillRect(0,0,1280,720);
  x.filter='blur(18px)';
  for(let i=0;i<20;i++){const height=100+(i*137%340);x.fillStyle=['#253d49','#46606b','#354956'][i%3];x.fillRect(i*75-40,720-height,64,height);}
  for(let i=0;i<35;i++){x.fillStyle=i%2?'#e2b87c':'#e9ddae';x.beginPath();x.arc((i*197)%1280,470+(i*83%230),4+i%9,0,Math.PI*2);x.fill();}
  return c;
 }
 function error(e){const p=document.getElementById('error');p.hidden=false;p.textContent='No se pudo cargar Raindrop FX original. Comprueba la imagen y la aceleración gráfica.';console.error(e);}
 function installBackgroundToggle(){
  const renderer=fx.renderer,drawBackground=renderer.drawBackground.bind(renderer),gl=renderer.renderer.gl;
  renderer.drawBackground=()=>{
   if(settings.background_visible!==false){drawBackground();return;}
   // The upstream pass cleared to opaque black. Clear only its canvas background,
   // then let the original water composition run with the existing reflection image.
   gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);
  };
 }
 function controls(){
  if(!fx)return;
  Object.assign(fx.options,{spawnInterval:[1/settings.density,1/settings.density],spawnSize:[settings.size,settings.size*5/3],spawnLimit:settings.glass_count===0?-1:settings.glass_count});
  // Keep the upstream composition blend state intact. Overriding its alpha
  // channel makes the water layer disappear even though the simulation runs.
  canvas.style.opacity=settings.opacity/100;
 }
 async function setBackground(){
  if(loading||!ready||background===settings.background_image)return;
  loading=true;const target=settings.background_image;
  try{await fx.setBackground(target||example());background=target;document.getElementById('error').hidden=true;}
  catch(e){error(e);background=target;}
  finally{loading=false;if(background!==settings.background_image)setBackground();}
 }
 function viewportSize(){
  const rect=canvas.getBoundingClientRect();
  return {
   width:Math.max(1,Math.round(rect.width||document.documentElement.clientWidth||innerWidth)),
   height:Math.max(1,Math.round(rect.height||document.documentElement.clientHeight||innerHeight))
  };
 }
 function commitResize(){
  resizeFrame=0;if(!ready)return;
  const size=viewportSize();
  if(size.width===viewportWidth&&size.height===viewportHeight)return;
  viewportWidth=size.width;viewportHeight=size.height;
  fx.resize(size.width,size.height);
  // Droplets store positions in pixels, so rebuild them for the new aspect ratio.
  // The upstream renderer then covers (crops) the background instead of stretching it.
  fx.simulator=new fx.simulator.constructor(fx.options);revision++;
 }
 function scheduleResize(){
  cancelAnimationFrame(resizeFrame);
  // The first frame applies the parent's 16:9/9:16 layout; the second measures it.
  resizeFrame=requestAnimationFrame(()=>{resizeFrame=requestAnimationFrame(commitResize);});
 }
 function apply(s){const sizeChanged=s.size!==settings.size;settings=s;controls();if(ready&&sizeChanged){fx.simulator=new fx.simulator.constructor(fx.options);}setBackground();scheduleResize();revision++;}
 let renderedRevision=-1;
 function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;canvas.hidden=muted;
  const reduced=settings.motion==='reduced'||settings.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(ready&&!loading&&!muted){
   if(!reduced){const step=dt*settings.speed/30;total+=step;const n=Math.max(1,Math.ceil(step/.03));for(let i=0;i<n;i++)fx.simulator.update({dt:step/n,total:total-step+step*(i+1)/n});}
   if(!reduced||renderedRevision!==revision){fx.renderer.render(fx.simulator.raindrops,{dt:reduced?0:dt,total});renderedRevision=revision;}
  }requestAnimationFrame(frame);
 }
 async function init(){try{
  const size=viewportSize();canvas.width=size.width;canvas.height=size.height;viewportWidth=size.width;viewportHeight=size.height;
  const initialBackground=settings.background_image;fx=new RaindropFX({canvas,background:initialBackground||example()});installBackgroundToggle();controls();
  await fx.renderer.loadAssets();background=initialBackground;ready=true;setBackground();scheduleResize();document.body.dataset.rainRenderer='raindrop-fx-original';requestAnimationFrame(frame);
 }catch(e){error(e);}}
 if(preview)addEventListener('message',e=>{if(e.origin===location.origin&&e.source===parent&&e.data?.type==='seasonal-preview')apply(e.data.settings);});
 else{async function poll(){try{const r=await fetch('/broadcast/seasonal/rain-original',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d=await r.json();if(JSON.stringify(settings)!==JSON.stringify(d.settings))apply(d.settings);muted=d.muted;}catch(_){muted=true;}setTimeout(poll,1000);}poll();}
 const resizeObserver='ResizeObserver' in window?new ResizeObserver(scheduleResize):null;
 resizeObserver?.observe(canvas);
 addEventListener('resize',scheduleResize);addEventListener('pagehide',()=>{cancelAnimationFrame(resizeFrame);resizeObserver?.disconnect();fx?.destroy();});init();
})();
