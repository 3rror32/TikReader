(function(root){
 'use strict';
 const STYLES=['ripples','halo','particles','equalizer','silk','smoke','aura','avatar','lightning','camera-flashes','butterflies'];
 function waterWaves(ring,size,reduced){
  const progress=Math.max(0,Math.min(1,ring.age/2.4));
  // Keep the original pulse, with gentler outward travel for reduced motion.
  const travel=reduced?.12: .48;
  return [{radius:size*(.05+progress*travel),alpha:Math.sin(Math.min(1,progress*5)*Math.PI/2)*(1-progress)**2}];
 }
 function silkWaves(width,height,level,time,reduced=false){
  const size=Math.min(width,height),t=reduced?0:time,power=Math.max(0,Math.min(1,level));
  const amplitude=size*(.04+power*.05)*(.88+.12*Math.sin(t*.55));
  return Array.from({length:5},(_,ribbon)=>{
   const baseline=height/2+(ribbon-2)*size*.1;
   return Array.from({length:97},(_,index)=>{
    // Positive temporal phase carries crests left without a wrap or reset.
    const u=index/96,travel=u+t*.055,phase=travel*Math.PI*2*1.45;
    const carrier=Math.sin(phase),fold=Math.sin(travel*Math.PI*2*.72+.16*Math.sin(t*.42));
    // Broad coordinated folds allow visible fabric curvature without crossing.
    const detail=Math.sin(phase+ribbon*.58+.12*Math.sin(t*.4+ribbon*.7))*size*(.003+power*.003);
    return {x:width*u,y:baseline+amplitude*(carrier*.78+fold*.22)+detail};
   });
  });
 }
 function lightningPaths(seed){
  let value=seed>>>0;
  const random=()=>{value=(Math.imul(value,1664525)+1013904223)>>>0;return value/4294967296;};
  // Independent edge/cloud origins use both canvas axes, without a center pivot.
  const slots=[[-.42,-.43,-.12,-.06],[.43,-.42,.12,-.06],[-.43,.42,-.12,.06],[.42,.43,.12,.06],[-.44,-.12,-.08,.36],[.44,.12,.08,-.36],[-.28,-.43,-.23,.34],[.28,.43,.23,-.34]];
  const slot=slots[(seed>>>0)%slots.length],jitter=()=> (random()-.5)*.025;
  const clamp=v=>Math.max(-.46,Math.min(.46,v));
  const point=(x,y)=>({x:clamp(x),y:clamp(y)});
  const start=point(slot[0]+jitter(),slot[1]+jitter()),end=point(slot[2]+jitter(),slot[3]+jitter());
  // Coarse crooked leaders subdivide into finer electric detail once per strike.
  const jagged=(from,to,roughness,depth)=>{
   let points=[from,to];
   for(let pass=0;pass<depth;pass++){
    const next=[points[0]];
    for(let i=1;i<points.length;i++){
     const a=points[i-1],b=points[i],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1;
     const displacement=(random()-.5)*roughness;
     next.push(point((a.x+b.x)/2-dy/length*displacement,(a.y+b.y)/2+dx/length*displacement),b);
    }
    points=next;roughness*=.53;
   }
   return points;
  };
  const trunk=jagged(start,end,.14,5),paths=[trunk];
  for(const [index,direction] of [[11,-1],[22,1]]){
   const origin=trunk[index],dx=end.x-start.x,dy=end.y-start.y,length=Math.hypot(dx,dy);
   const branchEnd=point(origin.x+dx/length*.065-dy/length*.075*direction,origin.y+dy/length*.065+dx/length*.075*direction);
   const branch=jagged(origin,branchEnd,.055,3);paths.push(branch);
   const forkOrigin=branch[4],forkEnd=point(forkOrigin.x+dx/length*.025+dy/length*.035*direction,forkOrigin.y+dy/length*.025-dx/length*.035*direction);
   paths.push(jagged(forkOrigin,forkEnd,.022,2));
  }
  return paths;
 }
 function smokeShape(p){
  const age=p.age,motion=age*p.motion,spread=1-Math.exp(-motion*.8);
  return {x:Math.sin(motion*p.curl+p.phase)*spread*.075+Math.sin(motion*2.1+p.phase)*spread*.025,
   y:-motion*p.rise,radius:(.022+age*.028)*p.size,
   stretch:1.1+Math.sin(motion*1.3+p.phase)*.28,rotation:p.phase+motion*p.spin,
   alpha:Math.min(1,age/.25)*(1-age/p.life)**2*p.power};
 }
 class SmokeField {
  constructor(seed=Math.floor(Math.random()*4294967296)){this.seed=seed>>>0;this.puffs=[];this.accumulator=0;this.emission=0;this.emitted=0;}
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  clear(){this.puffs=[];this.accumulator=0;this.emission=0;}
  step(dt,amplitude,speed=1,reduced=false){
   this.accumulator+=Math.min(.1,Math.max(0,dt));
   const tick=1/120,target=Number.isFinite(amplitude)?Math.max(0,Math.min(1,amplitude)):0;
   while(this.accumulator+1e-10>=tick){
    this.accumulator=Math.max(0,this.accumulator-tick);
    for(const p of this.puffs)p.age+=tick*speed;
    this.puffs=this.puffs.filter(p=>p.age<p.life);
    if(target>.035){
     this.emission+=tick*speed*(6+target*9)*(reduced?.75:1);
     while(this.emission>=1){
      this.emission-=1;this.emitted++;
      this.puffs.push({age:0,originX:0,originY:0,power:.35+target*.65,life:2.8+this.random()*.9,
       phase:this.random()*Math.PI*2,curl:1+this.random()*1.5,rise:.10+this.random()*.035,
       size:.8+this.random()*.6,spin:(this.random()-.5)*.9,motion:reduced?.45:1});
     }
    }else this.emission=0;
    this.puffs=this.puffs.slice(-48);
   }
  }
 }
 function flashEnvelope(flash){
  const progress=Math.max(0,Math.min(1,flash.age/flash.life));
  if(progress===0||progress===1)return 0;
  if(flash.reduced)return Math.sin(progress*Math.PI)**2;
  const attack=Math.min(1,flash.age/.055);
  return Math.sin(attack*Math.PI/2)*(1-progress)**2;
 }
 function butterflyShape(p){
  const time=p.age*p.motion,phase=time*p.sway+p.phase,progress=p.age/p.life;
  const drift=p.drift??0,curl=p.curl??.7;
  const x=drift*time+.018*(Math.sin(phase)-Math.sin(p.phase))+.012*(Math.sin(time*curl+p.phase*1.7)-Math.sin(p.phase*1.7));
  const vx=drift+.018*p.sway*Math.cos(phase)+.012*curl*Math.cos(time*curl+p.phase*1.7);
  const glide=Math.max(0,Math.sin(time*.83+p.phase)-.78)/.22;
  const wing=.14+.86*(.5+.5*Math.sin(time*p.beat+.45*Math.sin(time*1.7+p.phase)+p.phase))*(1-glide*.26);
  return {x,y:-p.rise*(time+.1*(Math.cos(p.phase)-Math.cos(time*1.4+p.phase))/1.4),
   wing,farWing:Math.max(.1,wing*(.82+.13*Math.sin(phase+.8))),
   tilt:Math.atan2(vx,p.rise*(1+.1*Math.sin(time*1.4+p.phase)))*.65,size:p.size*(.72+Math.min(1,p.age/.5)*.28),
   alpha:Math.min(1,p.age/.3)*Math.min(1,(1-progress)/.28)*p.power};
 }
 class ButterflyField {
  constructor(seed=Math.floor(Math.random()*4294967296)){this.seed=seed>>>0;this.butterflies=[];this.accumulator=0;this.emission=0;this.emitted=0;}
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  clear(){this.butterflies=[];this.accumulator=0;this.emission=0;}
  step(dt,amplitude,speed=1,reduced=false){
   this.accumulator+=Number.isFinite(dt)?Math.min(.1,Math.max(0,dt)):0;
   const tick=1/120,target=Number.isFinite(amplitude)?Math.max(0,Math.min(1,amplitude)):0;
   speed=Number.isFinite(speed)?Math.max(.25,Math.min(2,speed)):1;
   while(this.accumulator+1e-10>=tick){
    this.accumulator=Math.max(0,this.accumulator-tick);
    for(const p of this.butterflies)p.age+=tick*speed;
    this.butterflies=this.butterflies.filter(p=>p.age<p.life);
    if(target>.035){
     this.emission+=tick*speed*(1.8+target*3.5)*(reduced?.7:1);
     while(this.emission>=1){
      this.emission--;this.emitted++;
      this.butterflies.push({age:0,originX:0,originY:0,power:.55+target*.45,life:3.7+this.random()*.8,
       phase:this.random()*Math.PI*2,sway:1.2+this.random()*1.4,rise:.115+this.random()*.045,
       size:.025+this.random()*.016,beat:14+this.random()*9,drift:(this.random()-.5)*.023,curl:.55+this.random()*.65,shade:this.random(),motion:reduced?.55:1});
     }
    }else this.emission=0;
    this.butterflies=this.butterflies.slice(-28);
   }
  }
 }
 class CameraFlashField {
  constructor(seed=Math.floor(Math.random()*4294967296)){this.seed=seed>>>0;this.flashes=[];this.accumulator=0;this.clock=0;this.next=0;this.emitted=0;}
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  clear(){this.flashes=[];this.accumulator=0;this.next=this.clock;}
  step(dt,amplitude,speed=1,reduced=false){
   this.accumulator+=Math.min(.1,Math.max(0,dt));
   const tick=1/120,target=Number.isFinite(amplitude)?Math.max(0,Math.min(1,amplitude)):0;
   speed=Number.isFinite(speed)?Math.max(.25,Math.min(2,speed)):1;
   while(this.accumulator+1e-10>=tick){
    this.accumulator=Math.max(0,this.accumulator-tick);this.clock+=tick;
    for(const flash of this.flashes)flash.age+=tick;
    this.flashes=this.flashes.filter(flash=>flash.age<flash.life);
    if(target>.035&&this.clock+1e-10>=this.next&&this.flashes.length<2){
     this.emitted++;
     const x=.18+this.random()*.64,y=.18+this.random()*.64;
     this.flashes.push({age:0,x:reduced?.5:x,y:reduced?.5:y,size:.035+this.random()*.025,
      aspect:1.6+this.random()*.7,angle:(this.random()-.5)*.22,power:.6+target*.4,
      life:reduced?2.6:Math.max(.45,Math.min(1.05,(.65+this.random()*.22)/Math.sqrt(speed))),reduced:reduced?1:0});
     // Cadence uses wall time: neither a fast speed nor loud speech creates a strobe.
     this.next=this.clock+(reduced?1.8+this.random()*.65:Math.max(.65,(.9+(1-target)*.35+this.random()*.45)/speed));
    }
   }
  }
 }
 class RippleField {
  constructor(){this.rings=[];this.bolts=[];this.level=0;this.clock=0;this.boltClock=0;this.boltSequence=0;this.last=-1;this.lastBolt=-10;this.sequence=0;this.bands=Array(16).fill(0);}
  step(dt,amplitude,bands=[],speed=1,style='ripples',reduced=false){
   dt=Math.min(.1,Math.max(0,dt));this.clock+=dt*speed;
   const target=Number.isFinite(amplitude)?Math.max(0,Math.min(1,amplitude)):0;
   const mix=1-Math.exp(-dt/(target>this.level?.045:.22));this.level+=(target-this.level)*mix;
   this.bands=this.bands.map((v,i)=>v+((Number.isFinite(bands[i])?Math.max(0,Math.min(1,bands[i])):0)-v)*mix);
   if(target>.035&&this.clock-this.last>(style==='ripples'?.14+(1-this.level)*.2:.46+(1-this.level)*.24)){this.sequence++;this.rings.push({age:0,power:this.level,x:0,y:0});this.last=this.clock;}
   const boltDt=reduced?dt:dt*speed;this.boltClock+=boltDt;
   if(target>.075&&this.boltClock-this.lastBolt>(reduced?1.8:.62+(1-this.level)*.5)){
    const count=1+Math.floor(this.level*(reduced?1.9:2.5));
    for(let i=0;i<count;i++)this.bolts.push({age:0,power:this.level*(1-i*.15),life:reduced?2.8:1.15,attack:reduced?.07:.045,paths:lightningPaths(++this.boltSequence+17)});
    this.lastBolt=this.boltClock;
   }
   this.bolts=this.bolts.filter(b=>(b.age+=boltDt)<b.life).slice(-4);
   this.rings=this.rings.filter(r=>(r.age+=dt*speed)<2.4).slice(-18);return this.rings;
  }
 }
 function mount(canvas,read){
  const field=new RippleField(),smoke=new SmokeField(),flashes=new CameraFlashField(),butterflies=new ButterflyField(),ctx=canvas.getContext('2d');let frame,last=0,disposed=false,lastStyle='ripples';
  const reduced=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  function draw(now){
   if(disposed)return;
   const dpr=Math.min(root.devicePixelRatio||1,2),w=Math.min(canvas.clientWidth||root.innerWidth||640,4096),h=Math.min(canvas.clientHeight||root.innerHeight||360,4096);
   if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
   ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
   const s=read(),dt=last?(now-last)/1000:0;last=now;
   const speed=Math.max(.25,Math.min(2,s.speed||1)),intensity=Math.max(.25,Math.min(2,s.intensity||1)),color=s.color||'#60d9e8';
   if(lastStyle!==s.style){field.rings=[];field.bolts=[];field.lastBolt=-10;smoke.clear();flashes.clear();butterflies.clear();lastStyle=s.style;}
   field.step(dt,s.amplitude,s.bands,speed,STYLES.includes(s.style)?s.style:'ripples',!!reduced?.matches);
   const level=Math.min(1,field.level*intensity),t=reduced?.matches?0:field.clock,cx=w/2,cy=h/2,size=Math.min(w,h),style=STYLES.includes(s.style)?s.style:'ripples';
   ctx.strokeStyle=color;ctx.fillStyle=color;ctx.shadowColor=color;ctx.shadowBlur=reduced?.matches?0:14;ctx.lineWidth=2;ctx.globalAlpha=level;
   const circle=(x,y,r)=>{ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);};
   if(style==='ripples'){
    for(const ring of field.rings)for(const wave of waterWaves(ring,size,reduced?.matches)){
     ctx.globalAlpha=wave.alpha*Math.min(1,(.3+ring.power*.7)*intensity);
     ctx.lineWidth=1+ring.power*3;
     ctx.beginPath();ctx.ellipse(cx,cy,wave.radius,wave.radius*.72,0,0,Math.PI*2);ctx.stroke();
    }
   }
   if(level>.001){
    if(style==='halo'){for(let i=0;i<3;i++){ctx.globalAlpha=level/(i+1);ctx.lineWidth=3+i*2;circle(cx,cy,size*(.16+i*.035+level*.06)+Math.sin(t*3+i)*4);ctx.stroke();}}
    if(style==='particles'){for(let i=0;i<64;i++){const a=i*2.39996,phase=(t*.3+i/64)%1,r=size*(.08+phase*.38)*(.4+level);ctx.globalAlpha=level*(1-phase);circle(cx+Math.cos(a)*r,cy+Math.sin(a)*r*.75,1+(i%4));ctx.fill();}}
    if(style==='equalizer'){const gap=w*.012,bw=(w*.8-gap*15)/16;ctx.shadowBlur=5;for(let i=0;i<16;i++){const bh=Math.max(0,field.bands[i])*intensity*h*.65;ctx.globalAlpha=Math.min(1,level+.2);ctx.fillRect(w*.1+i*(bw+gap),cy-bh/2,bw,bh);}}
    if(style==='silk'){
     ctx.shadowBlur=reduced?.matches?0:Math.min(7,size*.012);
     for(const [ribbon,points] of silkWaves(w,h,level,t).entries()){
      ctx.globalAlpha=level*(.35+ribbon*.11);ctx.lineWidth=Math.min(1.2+ribbon*.3,size*.008);
      ctx.beginPath();for(const [index,point] of points.entries())index?ctx.lineTo(point.x,point.y):ctx.moveTo(point.x,point.y);
      ctx.stroke();
     }
    }
    if(style==='aura'){ctx.shadowBlur=24;for(let i=0;i<3;i++){const inset=8+i*7;ctx.globalAlpha=level/(i+1);ctx.lineWidth=2+level*5;ctx.strokeRect(inset,inset,Math.max(0,w-inset*2),Math.max(0,h-inset*2));}}
    if(style==='avatar'){const bounce=reduced?.matches?0:Math.abs(Math.sin(t*7))*level*size*.06;ctx.font=`${Math.round(size*(.19+level*.035))}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowBlur=25*level;ctx.fillText(s.avatar||'🎙️',cx,cy-bounce, w*.8);}
   }
    if(style==='smoke'){
     smoke.step(dt,s.amplitude,speed,!!reduced?.matches);ctx.shadowBlur=0;
     // Overlapping stretched lobes form a continuous plume with drifting rolled edges.
     // Each puff retains its variation; no per-frame random flicker or jumping emitter.
     for(const puff of smoke.puffs){
      const shape=smokeShape(puff),r=shape.radius*size;
      ctx.save();ctx.translate(cx+shape.x*size,cy+shape.y*size);ctx.rotate(shape.rotation);
      ctx.scale(shape.stretch,1/shape.stretch);
      for(let lobe=0;lobe<3;lobe++){
       const angle=lobe*2.094+puff.phase+puff.age*puff.motion*.4,offset=r*(.15+lobe*.16),x=Math.cos(angle)*offset,y=Math.sin(angle)*offset;
       const radius=r*(1-lobe*.16),gradient=ctx.createRadialGradient(x,y,0,x,y,radius);
       gradient.addColorStop(0,color);gradient.addColorStop(.35,color);gradient.addColorStop(1,'transparent');
       ctx.fillStyle=gradient;ctx.globalAlpha=shape.alpha*Math.min(2,intensity)*.16;
       circle(x,y,radius);ctx.fill();
      }
      ctx.restore();
     }
    }
    if(style==='butterflies'){
     butterflies.step(dt,s.amplitude,speed,!!reduced?.matches);ctx.shadowBlur=0;
     for(const butterfly of butterflies.butterflies){
      const shape=butterflyShape(butterfly),r=size*shape.size;
      ctx.save();ctx.translate(cx+shape.x*size,h*.7+shape.y*size);ctx.rotate(shape.tilt);
      ctx.globalAlpha=shape.alpha*Math.min(1,intensity);ctx.fillStyle=color;ctx.strokeStyle='#292333';ctx.lineWidth=Math.max(.55,r*.055);
      // Mirrored forewings and scalloped hindwings fold around a stable slim body.
      ctx.save();
      for(const side of [-1,1]){
       ctx.save();ctx.scale(side<0?shape.farWing:shape.wing,1);
       const pigment=ctx.createLinearGradient?.(0,-r,side*r*1.4,r*.7);
       if(pigment&&typeof pigment.addColorStop==='function'){pigment.addColorStop(0,'#e6d6bb');pigment.addColorStop(.25,color);pigment.addColorStop(.7,color);pigment.addColorStop(1,'#443447');ctx.fillStyle=pigment;}else ctx.fillStyle=color;
       ctx.beginPath();ctx.moveTo(0,0);
       ctx.bezierCurveTo(side*r*.28,-r*.75,side*r*.96,-r*1.48,side*r*1.32,-r*1.25);
       ctx.bezierCurveTo(side*r*1.56,-r*1.04,side*r*1.12,-r*.35,side*r*.65,-r*.02);
       ctx.bezierCurveTo(side*r*1.15,r*.06,side*r*1.15,r*.48,side*r*.94,r*.64);
       ctx.quadraticCurveTo(side*r*.85,r*.92,side*r*.69,r*.8);ctx.quadraticCurveTo(side*r*.51,r*.97,side*r*.39,r*.73);
       ctx.quadraticCurveTo(side*r*.18,r*.68,side*r*.16,r*.55);
       ctx.quadraticCurveTo(side*r*.3,r*.15,0,0);ctx.fill();ctx.stroke();
       ctx.globalAlpha=shape.alpha*Math.min(1,intensity)*.45;
       ctx.lineWidth=Math.max(.35,r*.025);
       for(const [x,y] of [[1.24,-1.17],[1.14,-.7],[.84,-.29],[.89,.44],[.58,.71]]){ctx.beginPath();ctx.moveTo(side*r*.09,-r*.05);ctx.quadraticCurveTo(side*r*x*.53,r*y*.4,side*r*x,r*y);ctx.stroke();}
       ctx.globalAlpha=shape.alpha*Math.min(1,intensity)*(.65+butterfly.shade*.2);ctx.fillStyle='#efe5ce';
       for(const [x,y] of [[1.22,-1.02],[1.13,-.79],[.99,-.56],[.98,.34],[.83,.62],[.6,.73]]){ctx.beginPath();ctx.ellipse(side*r*x,r*y,r*.045,r*.065,side*-.35,0,Math.PI*2);ctx.fill();}
       ctx.restore();
       ctx.globalAlpha=shape.alpha*Math.min(1,intensity);
      }
      ctx.restore();ctx.fillStyle='#29213b';ctx.strokeStyle='#45384d';ctx.lineWidth=.55;
      ctx.beginPath();ctx.ellipse(0,0,r*.085,r*.58,0,0,Math.PI*2);ctx.fill();
      ctx.beginPath();ctx.moveTo(0,-r*.4);ctx.quadraticCurveTo(-r*.15,-r*.8,-r*.28,-r*.75);ctx.moveTo(0,-r*.4);ctx.quadraticCurveTo(r*.15,-r*.8,r*.28,-r*.75);ctx.stroke();ctx.restore();
     }
    }
    if(style==='camera-flashes'){
     flashes.step(dt,s.amplitude,speed,!!reduced?.matches);ctx.shadowBlur=0;
     for(const flash of flashes.flashes){
      const alpha=flashEnvelope(flash)*Math.min(1,flash.power*intensity),r=size*flash.size;
      ctx.save();ctx.translate(flash.x*w,flash.y*h);ctx.rotate(flash.angle);
      const halo=ctx.createRadialGradient(0,0,0,0,0,r*1.8);
      halo.addColorStop(0,'#ffffff');halo.addColorStop(.15,color);halo.addColorStop(1,'transparent');
      ctx.fillStyle=halo;ctx.globalAlpha=alpha*.75;circle(0,0,r*1.8);ctx.fill();
      // Optical glints have straight tapered rays, unlike the branching lightning.
      ctx.fillStyle=color;ctx.globalAlpha=alpha*.65;
      ctx.beginPath();ctx.moveTo(-r*flash.aspect,0);ctx.lineTo(0,-r*.09);ctx.lineTo(r*flash.aspect,0);ctx.lineTo(0,r*.09);ctx.closePath();ctx.fill();
      ctx.fillStyle='#ffffff';ctx.globalAlpha=alpha;
      ctx.beginPath();ctx.moveTo(-r*.8,0);ctx.lineTo(-r*.06,-r*.06);ctx.lineTo(0,-r*.8);ctx.lineTo(r*.06,-r*.06);ctx.lineTo(r*.8,0);ctx.lineTo(r*.06,r*.06);ctx.lineTo(0,r*.8);ctx.lineTo(-r*.06,r*.06);ctx.closePath();ctx.fill();
      const core=ctx.createRadialGradient(0,0,0,0,0,r*.3);
      core.addColorStop(0,'#ffffff');core.addColorStop(.35,'#ffffff');core.addColorStop(1,'transparent');
      ctx.fillStyle=core;circle(0,0,r*.3);ctx.fill();ctx.restore();
     }
    }
    if(style==='lightning'&&field.bolts.length){
     const bolts=field.bolts;
     ctx.save();
     ctx.lineJoin='miter';ctx.miterLimit=2;ctx.lineCap='butt';
     for(const bolt of bolts){
      const release=Math.max(0,Math.min(1,(bolt.age/bolt.life-.48)/.52));
      const envelope=Math.sin(Math.min(1,bolt.age/bolt.attack)*Math.PI/2)*(reduced?.matches?1-release*release*(3-2*release):(1-bolt.age/bolt.life)**2);
      // An emitted channel is luminous even for quiet speech; its own envelope still reaches zero.
      const brightness=Math.min(1,(.65+.35*Math.min(1,Math.max(bolt.power,level)))*intensity);
      for(const [index,path] of bolt.paths.entries()){
       // Current concentrates in the leader; forks and distal tips become fine filaments.
       // Short connected sections taper the existing jagged channel without changing its shape.
       const hierarchy=index?(index%2?.5:.27):1,sections=index?2:4;
       for(let section=0;section<sections;section++){
        const from=Math.floor(section*(path.length-1)/sections),to=Math.floor((section+1)*(path.length-1)/sections);
        const width=.95*hierarchy*(1-section/sections*.78);
        const trace=()=>{ctx.beginPath();for(let i=from;i<=to;i++){const point=path[i],x=cx+point.x*w,y=cy+point.y*h;i>from?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();};
        ctx.strokeStyle=color;ctx.shadowColor=color;ctx.shadowBlur=18;ctx.globalAlpha=envelope*brightness*.12*hierarchy;ctx.lineWidth=width*2.2;trace();
        ctx.shadowBlur=6;ctx.globalAlpha=envelope*brightness*.22*hierarchy;ctx.lineWidth=width*1.35;trace();
        ctx.strokeStyle='#f7feff';ctx.shadowColor='#f7feff';ctx.shadowBlur=.6;ctx.globalAlpha=envelope*brightness*(index?.8:1);ctx.lineWidth=width;trace();
       }
       ctx.shadowColor=color;
      }
     }
     ctx.restore();
    }
   ctx.globalAlpha=1;ctx.shadowBlur=0;frame=root.requestAnimationFrame(draw);
  }
  frame=root.requestAnimationFrame(draw);return ()=>{disposed=true;root.cancelAnimationFrame(frame);};
 }
 const api={ButterflyField,butterflyShape,CameraFlashField,flashEnvelope,RippleField,SmokeField,smokeShape,mount,STYLES,waterWaves,silkWaves,lightningPaths};if(typeof module!=='undefined')module.exports=api;else root.VoiceRippleRenderer=api;
})(typeof window!=='undefined'?window:globalThis);
