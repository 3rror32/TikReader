// Raindrop FX (MIT) on an offscreen WebGL2 surface, composited over transparent rain.
window.RainAtmosphere=(()=>{
 const fallback=window.RainAtmosphere;
 let fx=null,surface=null,ready=false,failed=false,pending=null,rain=[],total=0,signature='',waterCache=null,dirty=true,frameCache=null;
 const rand=(a,b)=>a+Math.random()*(b-a);
 function report(message){
  document.body.dataset.rainRenderer=failed?'fallback':'webgl2';
  if(parent!==window)parent.postMessage({type:'seasonal-renderer-status',message},location.origin);
  console.warn(message);
 }
 function configure(w,h,s){
  if(!ready)return;dirty=true;
  if(fx.options.width!==w||fx.options.height!==h)fx.resize(w,h);
  Object.assign(fx.options,{
   spawnLimit:s.glass_count,spawnInterval:[2/Math.max(1,s.glass_count),5/Math.max(1,s.glass_count)],
   spawnSize:[35,90],gravity:2400,slipRate:.35,motionInterval:[.15,.7],
   trailDropDensity:.15,trailDropSize:[.22,.38],trailDistance:[8,17],
   initialSpread:.5,velocitySpread:.3,evaporate:9,xShifting:[-.04,.04],
   dropletsPerSeconds:0,mist:false
  });
  const next=[w,h,s.glass_count].join(':');
  if(next!==signature){
   signature=next;
   fx.simulator=new fx.simulator.constructor(fx.options);
   // Start with visible beads instead of making the user wait for a wet pane.
   for(let i=0;i<s.glass_count;i++){
    const pos=fx.options.viewport.min.clone();pos.x=rand(0,w);pos.y=rand(0,h);
    const size=i%4===0?rand(65,90):rand(25,50);
    fx.simulator.add(fx.simulator.spawner.spawn(pos,size));
   }
  }
 }
 async function initialize(){
  try{
   waterCache=document.createElement('canvas');surface=document.createElement('canvas');surface.width=pending.w;surface.height=pending.h;
   const blank=document.createElement('canvas');blank.width=blank.height=2;
   fx=new RaindropFX({canvas:surface,background:blank,mist:false,dropletsPerSeconds:0,backgroundBlurSteps:0});
   await fx.renderer.loadAssets();ready=true;
   document.body.dataset.rainRenderer='webgl2';
   configure(pending.w,pending.h,pending.s);
  }catch(error){failed=true;report('No se pudo iniciar el agua con WebGL2. Se muestra la lluvia básica; revisa la aceleración gráfica del navegador.');console.error(error);}
 }
 function reset(w,h,s){
  pending={w,h,s};fallback.reset(w,h,s);
  if(rain.length!==s.density)rain=Array.from({length:s.density},()=>({x:rand(0,w),y:rand(0,h),z:rand(.35,1)}));
  if(!surface&&!failed)initialize();else configure(w,h,s);
 }
 function draw(ctx,w,h,s,dt){
  if(dt===0&&!dirty&&frameCache){ctx.drawImage(frameCache,0,0,w,h);return;}
  if(failed){fallback.draw(ctx,w,h,s,dt);return;}
  // Rain in the air retains separate density, speed, length, thickness and wind controls.
  ctx.save();ctx.lineCap='round';
  for(const p of rain){
   const vx=s.wind*2,vy=s.speed*(4+5*p.z),length=s.size*(.6+p.z);
   p.x+=vx*dt;p.y+=vy*dt;
   if(p.y>h+length){p.y=-length;p.x=rand(0,w);}
   if(p.x< -length)p.x=w+length;if(p.x>w+length)p.x=-length;
   ctx.globalAlpha=s.opacity/100*(.2+p.z*.35);ctx.strokeStyle='#d6e9f5';ctx.lineWidth=s.thickness*(.4+p.z*.6);
   ctx.beginPath();ctx.moveTo(p.x-vx/Math.max(vy,1)*length,p.y-length);ctx.lineTo(p.x,p.y);ctx.stroke();
  }
  if(ready&&s.glass_count>0){
   const step=dt*s.glass_speed/25;total+=step;
   // Substeps keep fast motion stable on slower displays.
   if(step>0){const n=Math.max(1,Math.ceil(step/.03));for(let i=0;i<n;i++)fx.simulator.update({dt:step/n,total:total-step+step*(i+1)/n});}
   // The control is a hard cap including trails, and zero removes all glass droplets.
   while(fx.simulator.raindrops.length>s.glass_count){const p=fx.simulator.raindrops.pop();p.grid?.delete(p);}
   if(dt>0||dirty){
    fx.renderer.render(fx.simulator.raindrops,{dt:0,total});
    if(waterCache.width!==w||waterCache.height!==h){waterCache.width=w;waterCache.height=h;}
    const cache=waterCache.getContext('2d');cache.clearRect(0,0,w,h);cache.drawImage(surface,0,0,w,h);dirty=false;
   }
   ctx.globalAlpha=s.opacity/100;ctx.drawImage(waterCache,0,0,w,h);
  }
  ctx.restore();
  if(!frameCache)frameCache=document.createElement('canvas');
  if(frameCache.width!==w||frameCache.height!==h){frameCache.width=w;frameCache.height=h;}
  const snapshot=frameCache.getContext('2d');snapshot.clearRect(0,0,w,h);snapshot.drawImage(ctx.canvas,0,0,w,h);
 }
 addEventListener('pagehide',()=>{fx?.destroy();fx=null;});
 return {reset,draw};
})();
