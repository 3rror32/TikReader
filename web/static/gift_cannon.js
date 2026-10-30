/* Arcade gift launcher: cohesive pixel-art cradle, steel hub and aiming needle. */
window.GiftCannon = (() => {
 const piles=new WeakMap();
 function artwork(node,name){
  const img=document.createElement('img');img.alt='';img.draggable=false;
  const files={cannon:'cannon-v3.png',sack:'sack-v2.png',arrow:'aim-arrow-v3.svg'};
  img.src='/static/arcade-launcher/'+files[name];node.append(img);
 }
 function portrait(node,record){
  const label=document.createElement('span');label.textContent=String(record.user||'Participante').replace(/^@/,'').trim().slice(0,1).toUpperCase()||'P';node.append(label);
  if(typeof record.avatar_url!=='string')return;
  let url;try{url=new URL(record.avatar_url);}catch(_){return;}
  if(!['https:','http:'].includes(url.protocol))return;
  const img=document.createElement('img');img.alt='';img.draggable=false;img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();img.src=url.href;node.append(img);
 }
 function start(scene,settings,record={}) {
  scene.querySelector('.arcade-launcher')?.remove();scene.querySelector('.cannon-caption')?.remove();
  const cannon=document.createElement('div');cannon.className='gift-cannon arcade-launcher';
  const sack=document.createElement('div'),gear=document.createElement('div'),needle=document.createElement('div'),loaded=document.createElement('div'),supply=document.createElement('div');
  sack.className='arcade-sack';gear.className='arcade-gear';needle.className='arcade-needle';loaded.className='arcade-loaded';supply.className='arcade-supply';
  artwork(sack,'sack');artwork(gear,'cannon');artwork(needle,'arrow');portrait(loaded,record);portrait(supply,record);
  cannon.append(sack,gear,needle,loaded,supply);scene.append(cannon);
  const caption=document.createElement('div');caption.className='cannon-caption';caption.textContent=(record.user||'Participante')+' · '+(record.gift||'Regalo')+' × '+(record.count||1);scene.append(caption);
  const reduced=scene.dataset.motion==='reduced'||scene.dataset.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.dataset.discardPending='false';
  const MAX_BURST=36,MAX_RETAINED=80;
  let count=Math.min(MAX_BURST,Math.max(1,Math.floor(Number(record.count)||1)));const balls=piles.get(scene)||[];piles.set(scene,balls);
  let frame=0,stopped=false,last=0,elapsed=0,created=0,phase='transfer',phaseTime=0,activeBall=null;
  let resolveDone;const done=new Promise(resolve=>resolveDone=resolve);
  const hopSeconds=.6,loadSeconds=.25;
  loaded.style.opacity=supply.style.opacity='0';
  function spawn(width,height,size,floor,angle){
   const node=document.createElement('div');node.className='cannon-ball';node.style.width=node.style.height=size+'px';portrait(node,record);scene.append(node);
   const pivot=loaded.getBoundingClientRect(),bounds=scene.getBoundingClientRect(),radians=angle*Math.PI/180;
   const force=.85+Math.random()*.65;
   const ball={size,age:0,settled:false,node,x:pivot.left+pivot.width/2-bounds.left-size/2,y:pivot.top+pivot.height/2-bounds.top-size/2,vx:Math.sin(radians)*height*force,vy:-Math.cos(radians)*height*force,angle:0,spin:Math.random()*140-70};
   if(reduced){ball.x=width*(.08+.82*created/Math.max(1,count-1))-size/2;ball.y=floor;ball.vx=ball.vy=0;}
   while(balls.length>=MAX_RETAINED){const old=balls.find(candidate=>candidate.settled)||balls[0];balls.splice(balls.indexOf(old),1);old.node.remove();}
   balls.push(ball);activeBall=ball;created++;phase='flight';phaseTime=0;
  }
  function tick(now){
   if(stopped)return;
   const dt=last?Math.min(.04,(now-last)/1000):0;last=now;elapsed+=dt;
   const width=scene.clientWidth,height=scene.clientHeight,size=Math.max(20,Math.min(Number(settings.size)||48,width*.12,height*.18)),floor=height-size-6;
   const angle=reduced?0:Math.sin(elapsed*1.55-.65)*52;
   needle.style.transform=`rotate(${angle}deg)`;
   const paused=scene.dataset.queuePaused==='true';
   if(scene.dataset.discardPending==='true'){count=created+(phase==='transfer'||phase==='loaded'?1:0);scene.dataset.discardPending='false';}
   if(!paused||phase==='flight'||phase==='recover')phaseTime+=dt;
   loaded.style.opacity=phase==='loaded'?'1':'0';
   supply.style.opacity=phase==='transfer'?'1':'0';
   if(phase==='transfer'){
    const t=reduced?1:Math.min(1,phaseTime/hopSeconds),ease=t*t*(3-2*t);
    // The sender portrait follows an arc from the open sack to the hub.
    supply.style.transform=`translate(${ease*155}px,${-Math.sin(t*Math.PI)*58-ease*10}px)`;
    if(t===1){phase='loaded';phaseTime=0;supply.style.opacity='0';loaded.style.opacity='1';}
   }else if(phase==='loaded'&&!paused&&(reduced||phaseTime>=loadSeconds)){
    spawn(width,height,size,floor,angle);loaded.style.opacity='0';
   }
   // All portraits expire, including sleeping and reduced-motion projectiles.
   for(let i=balls.length-1;i>=0;i--){
    const b=balls[i];b.age+=dt;b.node.style.opacity=String(Math.max(0,Math.min(1,(3.5-b.age)/.5)));
    if(b.age>=3.5){b.expired=true;b.node.remove();balls.splice(i,1);}
   }
   for(const b of balls){
    if(b.settled)continue;
    b.previousX=b.x;b.previousY=b.y;b.supported=false;
    if(!reduced){b.vy+=height*2.2*dt;b.x+=b.vx*dt;b.y+=b.vy*dt;b.angle+=b.spin*dt;
     if(b.x<0){b.x=0;b.vx=Math.abs(b.vx)*.72;}if(b.x>width-size){b.x=width-size;b.vx=-Math.abs(b.vx)*.72;}
     if(b.y<0){b.y=0;b.vy=Math.abs(b.vy)*.65;}
     if(b.y>=floor){b.supported=true;b.y=floor;const rebound=Math.abs(b.vy)*.52;b.vy=rebound>Math.max(height*.09,height*2.2*dt)?-rebound:0;b.vx*=Math.pow(.18,dt);b.spin*=Math.pow(.12,dt);if(b.vy===0&&Math.abs(b.vx)<8)b.settled=true;}
    }
    if(reduced)b.settled=true;
   }
   // Resting portraits support later arrivals until their short display expires.
   for(let pass=0;pass<4;pass++)for(let i=0;i<balls.length;i++){
    const a=balls[i];if(a.settled)continue;
    for(let j=0;j<i;j++){
     const b=balls[j],dx=a.x+a.size/2-b.x-b.size/2,dy=a.y+a.size/2-b.y-b.size/2;
     const distance=Math.hypot(dx,dy),minimum=(a.size+b.size)*.46;
     if(distance>=minimum)continue;
     const nx=distance?dx/distance:0,ny=distance?dy/distance:-1;
     if(b.settled&&ny<-.2)a.supported=true;
     a.x+=nx*(minimum-distance);a.y+=ny*(minimum-distance);
     const speed=a.vx*nx+a.vy*ny;
     if(speed<0){a.vx-=1.3*speed*nx;a.vy-=1.3*speed*ny;}
     a.vx*=.85;a.spin*=.85;
     if(ny<-.2&&(Math.abs(a.vy)<24||a.age>5)){a.settled=true;a.vx=a.vy=a.spin=0;}
    }
   }
   for(const b of balls){
    if(!b.settled){
     b.x=Math.max(0,Math.min(width-b.size,b.x));b.y=Math.max(0,Math.min(height-b.size-6,b.y));
     // Contact solvers can leave a tiny perpetual oscillation on a pile.
     // Sleep only supported gifts whose actual motion remains negligible.
     const speed=dt?Math.hypot(b.x-b.previousX,b.y-b.previousY)/dt:Infinity;
     b.restTime=b.supported&&speed<8?(b.restTime||0)+dt:0;
     if(b.restTime>=.5){b.settled=true;b.vx=b.vy=b.spin=0;}
    }
    b.node.style.transform=`translate3d(${b.x}px,${b.y}px,0) rotate(${b.angle}deg)`;
   }
   if(phase==='flight'&&(activeBall?.settled||activeBall?.expired)){phase='recover';phaseTime=0;}
   if(phase==='recover'&&phaseTime>=.15){phase=created<count?'transfer':'finished';phaseTime=0;}
   cannon.dataset.pending=String(Math.max(0,count-created-(phase==='transfer'||phase==='loaded'?1:0)));
   if(phase==='finished'&&!balls.length){resolveDone();return;}
   cannon.dataset.phase=phase;
   frame=requestAnimationFrame(tick);
  }
  frame=requestAnimationFrame(tick);
  const stop=()=>{stopped=true;cancelAnimationFrame(frame);balls.forEach(b=>b.node.remove());balls.length=0;cannon.remove();caption.remove();resolveDone();};
  stop.done=done;return stop;
 }
 return {start};
})();
