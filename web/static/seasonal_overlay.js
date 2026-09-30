(()=>{
 'use strict';
 const canvas=document.getElementById('season'),ctx=canvas.getContext('2d'),kind=document.body.dataset.season,preview=new URLSearchParams(location.search).get('preview')==='1';
 let settings=JSON.parse(document.getElementById('season-settings').textContent),particles=[],w=1,h=1,last=0,elapsed=0,muted=!preview;
 const TAU=Math.PI*2;
 const reduced=()=>settings.motion==='reduced'||settings.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
 const rgba=(hex,alpha)=>{const value=parseInt(String(hex||'#ffffff').slice(1),16);return `rgba(${value>>16},${value>>8&255},${value&255},${alpha})`;};
 const color=(p,alpha=1)=>rgba(p.tone?settings.secondary_color:settings.primary_color,alpha);
 function particle(randomY=true){
  const ashShape=Array.from({length:7},()=>.68+Math.random()*.38);
  return {x:Math.random()*w,y:randomY?Math.random()*h:-40,z:.18+Math.random()**1.4*.82,phase:Math.random()*TAU,turn:Math.random()*TAU,flutter:.45+Math.random()*.9,variant:Math.floor(Math.random()*5),tone:Math.random()>.55?1:0,trail:[],glyph:Math.floor(Math.random()*96),seed:Math.random(),ash:Math.random()<.4,stretch:.75+Math.random()*1.9,ashShape,vx:0,vy:-1};
 }
 function seed(){
  if(kind==='rain')window.RainAtmosphere.reset(w,h,settings);
  const limits={aurora:10,fog:32};
  particles=Array.from({length:Math.min(settings.density,limits[kind]||180)},()=>particle()).sort((a,b)=>a.z-b.z);
 }
 function resize(){const rect=canvas.getBoundingClientRect();w=Math.max(1,Math.round(rect.width));h=Math.max(1,Math.round(rect.height));const dpr=Math.min(devicePixelRatio||1,1.5);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);seed();}
 const leaves=Array.from({length:12},(_,index)=>{
  const image=document.createElement('canvas');image.width=image.height=128;const c=image.getContext('2d');c.translate(64,60);
  const palettes=[['#d9ae54','#815129'],['#c97735','#733b28'],['#b34d32','#592c26'],['#c7b36b','#777043']],colors=palettes[Math.floor(index/3)];
  const g=c.createLinearGradient(-30,-35,30,40);g.addColorStop(0,colors[0]);g.addColorStop(.65,colors[1]);g.addColorStop(1,colors[0]);c.fillStyle=g;c.beginPath();
  if(index%3===0){c.moveTo(0,-49);c.bezierCurveTo(44,-27,42,15,0,43);c.bezierCurveTo(-30,20,-35,-23,0,-49);}
  else if(index%3===1){const pts=[[0,-51],[9,-28],[24,-36],[21,-15],[43,-22],[33,-2],[47,6],[23,20],[26,34],[7,30],[0,46],[-8,30],[-29,33],[-23,18],[-46,6],[-32,-3],[-40,-22],[-18,-15],[-22,-36],[-8,-27]];pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();}
  else{c.moveTo(0,-49);c.bezierCurveTo(20,-48,27,-35,15,-28);c.bezierCurveTo(40,-28,38,-10,20,-8);c.bezierCurveTo(44,1,34,19,16,15);c.bezierCurveTo(30,32,13,40,0,43);c.bezierCurveTo(-24,35,-30,21,-17,14);c.bezierCurveTo(-41,17,-37,-3,-19,-9);c.bezierCurveTo(-37,-17,-31,-31,-14,-29);c.bezierCurveTo(-24,-40,-12,-49,0,-49);}
  c.fill();c.save();c.clip();c.strokeStyle='#eed7a04d';c.lineWidth=1.1;for(let y=-27;y<35;y+=13){c.beginPath();c.moveTo(0,y+10);c.quadraticCurveTo(12,y+2,27,y-12);c.moveTo(0,y+10);c.quadraticCurveTo(-12,y,-25,y-10);c.stroke();}c.restore();c.strokeStyle='#593c2dbb';c.lineWidth=1.8;c.beginPath();c.moveTo(0,-41);c.quadraticCurveTo(-4,12,2,45);c.quadraticCurveTo(3,51,10,57);c.stroke();return image;
 });
 function snow(p,s){
  const r=Math.max(1.5,s*.7);ctx.rotate(p.turn*.3);ctx.strokeStyle=color(p);ctx.lineWidth=Math.max(.7,r*.09);ctx.lineCap='round';ctx.beginPath();
  for(let i=0;i<6;i++){const a=i*TAU/6,dx=Math.cos(a),dy=Math.sin(a);ctx.moveTo(0,0);ctx.lineTo(dx*r,dy*r);for(const t of [.48,.74])for(const side of [-1,1]){const x=dx*r*t,y=dy*r*t,b=a+side*Math.PI/3,length=r*(t<.6?.27:.2);ctx.moveTo(x,y);ctx.lineTo(x+Math.cos(b)*length,y+Math.sin(b)*length);}}ctx.stroke();
 }
 function wrap(p,margin){if(p.y>h+margin)p.y=-margin;if(p.y< -margin)p.y=h+margin;if(p.x>w+margin)p.x=-margin;if(p.x< -margin)p.x=w+margin;}
 function move(p,dt){
  p.phase+=dt*p.flutter;p.turn+=dt*(Math.sin(p.phase*.7)*.4+.12);
  const angle=(settings.direction||0)*Math.PI/180,speed=settings.speed*(.25+p.z*.8),gust=Math.sin(elapsed*.34)*.6+Math.sin(elapsed*.81+1)*.22;
  let vx=Math.sin(angle)*speed+settings.wind*(.15+p.z*.5),vy=Math.cos(angle)*speed;
  if(kind==='leaves'){vx=settings.wind*(1+gust*.45)*(.4+p.z)+Math.sin(p.phase)*27;vy=speed*(1+Math.sin(p.phase*1.7)*.2);}
  if(kind==='wind'){vx=(settings.wind*(1+gust*.45)+settings.speed*.75)*(.4+p.z)+Math.sin(p.phase)*8;vy=Math.sin(p.phase*.6)*9;}
  if(kind==='fireflies'){vx+=Math.sin(p.phase*1.7)*settings.speed*.7;vy+=Math.cos(p.phase*1.3)*settings.speed*.7;}
  if(kind==='stars'){vx*=.08;vy*=.08;}
  if(kind==='petals'){vx+=Math.sin(p.phase)*18;vy=Math.abs(vy)*(.55+p.z*.45);}
  if(kind==='bubbles'){vx+=Math.sin(p.phase)*8;vy=-Math.abs(speed);}
  if(kind==='embers'){
   const lift=speed*(p.ash?.42:.82+p.z*.28),turbulence=Math.sin(p.phase*2.15+p.seed*TAU)+Math.sin(elapsed*1.7+p.seed*17)*.42;
   vx=Math.sin(angle)*lift+settings.wind*(.18+p.z*.46)+turbulence*(p.ash?11:5.5);
   vy=Math.cos(angle)*lift+Math.sin(p.phase*.73+p.seed*9)*(p.ash?4.5:1.8);
  }
  if(kind==='digital-rain'){vx=0;vy=Math.abs(speed)*(1.5+p.z);}
  p.vx=vx;p.vy=vy;p.x+=vx*dt;p.y+=vy*dt;
  if(kind==='wind'){p.trail.push({x:p.x,y:p.y});if(p.trail.length>24)p.trail.shift();}
  const margin=Math.max(80,settings.size*3);
  if(kind==='embers'){
   if(p.y< -margin){p.y=h+Math.random()*margin;p.x=Math.random()*w;p.phase=Math.random()*TAU;}
   else if(p.y>h+margin){p.y=-Math.random()*margin;p.x=Math.random()*w;p.phase=Math.random()*TAU;}
   if(p.x>w+margin)p.x=-margin;else if(p.x< -margin)p.x=w+margin;
  }else wrap(p,margin);
 }
 function drawGlow(p,s){
  const pulse=.45+.55*Math.sin(p.phase*2.1)**2,r=s*(1.5+pulse);ctx.globalCompositeOperation='lighter';const g=ctx.createRadialGradient(0,0,0,0,0,r*2.2);g.addColorStop(0,color(p,.95));g.addColorStop(.2,color(p,.65));g.addColorStop(1,color(p,0));ctx.fillStyle=g;ctx.beginPath();ctx.arc(0,0,r*2.2,0,TAU);ctx.fill();ctx.fillStyle=color(p);ctx.beginPath();ctx.arc(0,0,Math.max(1,s*.2),0,TAU);ctx.fill();
 }
 function drawEmber(p,s){
  if(p.ash){
   const flake=s*(.5+p.z*.45),flip=.3+.7*Math.abs(Math.cos(p.phase*.66+p.seed*TAU));
   ctx.globalCompositeOperation='source-over';ctx.rotate(p.turn+Math.sin(p.phase*.47)*.7);ctx.scale(flip,1);
   const g=ctx.createRadialGradient(-flake*.22,-flake*.28,0,0,0,flake*1.15);
   g.addColorStop(0,'rgba(238,224,207,.78)');g.addColorStop(.48,p.tone?'rgba(145,130,117,.62)':'rgba(106,99,92,.68)');g.addColorStop(1,'rgba(45,42,39,.08)');
   ctx.fillStyle=g;ctx.strokeStyle='rgba(245,229,209,.3)';ctx.lineWidth=Math.max(.45,flake*.08);ctx.beginPath();
   for(let i=0;i<p.ashShape.length;i++){const a=i/p.ashShape.length*TAU,r=flake*p.ashShape[i],x=Math.cos(a)*r,y=Math.sin(a)*r*(.42+.18*p.seed);if(i)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.closePath();ctx.fill();ctx.stroke();return;
  }
  const flicker=.58+.42*Math.sin(p.phase*3.7+p.seed*19)**2,core=Math.max(.72,s*(.085+.06*p.z)),trail=s*p.stretch*(.8+flicker*.5),rotation=Math.atan2(p.vx,-p.vy);
  ctx.globalCompositeOperation='lighter';ctx.rotate(rotation);
  const bloom=ctx.createRadialGradient(0,0,0,0,0,s*(1.15+.55*flicker));
  bloom.addColorStop(0,color(p,.38*flicker));bloom.addColorStop(.28,color(p,.14*flicker));bloom.addColorStop(1,color(p,0));ctx.fillStyle=bloom;ctx.beginPath();ctx.arc(0,0,s*(1.15+.55*flicker),0,TAU);ctx.fill();
  const streak=ctx.createLinearGradient(0,-core,0,trail);streak.addColorStop(0,'rgba(255,255,238,.98)');streak.addColorStop(.12,color(p,.95));streak.addColorStop(.46,color({...p,tone:1},.48*flicker));streak.addColorStop(1,color(p,0));
  ctx.strokeStyle=streak;ctx.lineWidth=core*(1.2+.45*flicker);ctx.lineCap='round';ctx.shadowColor=color(p,.9);ctx.shadowBlur=s*(.65+flicker);ctx.beginPath();ctx.moveTo(0,-core*.25);ctx.quadraticCurveTo(Math.sin(p.phase*1.9)*core*1.4,trail*.38,0,trail);ctx.stroke();
  ctx.shadowBlur=0;ctx.fillStyle='rgba(255,255,244,.96)';ctx.beginPath();ctx.ellipse(0,0,core*.72,core*(1.1+.35*flicker),0,0,TAU);ctx.fill();
 }
 function drawStar(p,s){const pulse=.35+.65*Math.sin(p.phase*2+p.variant)**2;ctx.globalCompositeOperation='lighter';ctx.strokeStyle=color(p,pulse);ctx.fillStyle=color(p);ctx.shadowColor=color(p);ctx.shadowBlur=s*pulse*2;if(p.variant===0&&pulse>.92){ctx.lineWidth=Math.max(1,s*.18);ctx.beginPath();ctx.moveTo(-s*7,s*3);ctx.lineTo(s,-s*.5);ctx.stroke();}ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,r=i%2?s*.22:s;ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r);}ctx.closePath();ctx.fill();}
 function drawPetal(p,s){ctx.rotate(Math.sin(p.phase)*.8+p.turn);ctx.scale(.35+.65*Math.abs(Math.cos(p.phase*.75)),1);const g=ctx.createLinearGradient(-s,-s,s,s);g.addColorStop(0,color(p,.95));g.addColorStop(1,color({...p,tone:!p.tone},.75));ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(0,-s);ctx.bezierCurveTo(s*.9,-s*.45,s*.72,s*.65,0,s);ctx.bezierCurveTo(-s*.72,s*.65,-s*.9,-s*.45,0,-s);ctx.fill();ctx.strokeStyle='rgba(255,255,255,.28)';ctx.beginPath();ctx.moveTo(0,-s*.7);ctx.lineTo(0,s*.7);ctx.stroke();}
 function drawBubble(p,s){
  ctx.globalCompositeOperation='screen';
  const body=settings.primary_color,reflection=settings.secondary_color,rx=s*(.86+Math.sin(p.phase)*.08),rotation=Math.sin(p.phase)*.12;
  const g=ctx.createRadialGradient(-s*.32,-s*.38,s*.03,0,0,s);
  g.addColorStop(0,rgba(reflection,.92));g.addColorStop(.12,rgba(reflection,.3));g.addColorStop(.48,rgba(body,.055));g.addColorStop(.82,rgba(body,.16));g.addColorStop(1,rgba(body,.74));
  ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(0,0,rx,s,rotation,0,TAU);ctx.fill();
  const rim=ctx.createLinearGradient(-s,-s,s,s);rim.addColorStop(0,rgba(reflection,.78));rim.addColorStop(.46,rgba(body,.28));rim.addColorStop(1,rgba(reflection,.48));
  ctx.strokeStyle=rim;ctx.lineWidth=Math.max(1,s*.055);ctx.beginPath();ctx.ellipse(0,0,rx*.97,s*.97,rotation,0,TAU);ctx.stroke();
  ctx.strokeStyle=rgba(reflection,.88);ctx.lineWidth=Math.max(1,s*.075);ctx.lineCap='round';ctx.beginPath();ctx.arc(-s*.22,-s*.29,s*.2,3.45,5.65);ctx.stroke();
  ctx.fillStyle=rgba(reflection,.62);ctx.beginPath();ctx.arc(-s*.34,-s*.42,Math.max(1.1,s*.045),0,TAU);ctx.fill();
  ctx.strokeStyle=rgba(body,.3);ctx.lineWidth=Math.max(.7,s*.035);ctx.beginPath();ctx.arc(s*.12,s*.18,s*.5,.25,1.62);ctx.stroke();
 }
 function drawDigital(p,s){ctx.globalCompositeOperation='lighter';ctx.font=`600 ${Math.max(9,s)}px ui-monospace,Consolas,monospace`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.shadowColor=color(p);ctx.shadowBlur=s*.6;const glyphs='01<>/{}[]+*#アカサタナハマラ';const alpha=ctx.globalAlpha;for(let i=0;i<5+p.variant;i++){ctx.globalAlpha=alpha*(i===0?1:.72**i);ctx.fillStyle=i===0?settings.secondary_color:settings.primary_color;ctx.fillText(glyphs[(p.glyph+i*7)%glyphs.length],0,-i*s*1.05);}}
 function drawFog(){
  ctx.save();ctx.globalCompositeOperation='screen';for(const p of particles){const rx=settings.size*(2.8+p.z*4),ry=rx*(.26+.12*p.z),g=ctx.createRadialGradient(p.x,p.y,0,p.x,p.y,rx);g.addColorStop(0,color(p,settings.opacity/100*.13));g.addColorStop(.52,color({...p,tone:!p.tone},settings.opacity/100*.08));g.addColorStop(1,color(p,0));ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(p.x,p.y,rx,ry,Math.sin(p.phase)*.08,0,TAU);ctx.fill();}ctx.restore();
 }
 function drawAurora(){
  ctx.save();ctx.globalCompositeOperation='screen';const bands=Math.max(2,particles.length),slope=Math.tan((settings.direction||0)*Math.PI/180)*.15;
  for(let b=0;b<bands;b++){const y=h*(.12+(b+.5)/(bands+1)*.72),amp=settings.size*(.55+b/bands*.45),phase=elapsed*settings.speed*.035+b*1.7,g=ctx.createLinearGradient(0,y-amp,w,y+amp);g.addColorStop(0,color({tone:b%2},0));g.addColorStop(.28,color({tone:b%2},settings.opacity/100*.11));g.addColorStop(.62,color({tone:(b+1)%2},settings.opacity/100*.2));g.addColorStop(1,color({tone:b%2},0));ctx.fillStyle=g;ctx.shadowColor=b%2?settings.secondary_color:settings.primary_color;ctx.shadowBlur=28;ctx.beginPath();ctx.moveTo(-40,y);for(let x=-40;x<=w+40;x+=Math.max(34,w/26)){const wave=Math.sin(x/w*TAU*1.4+phase)*amp+Math.sin(x/w*TAU*2.7-phase*.6)*amp*.24;ctx.lineTo(x,y+wave+x*slope);}for(let x=w+40;x>=-40;x-=Math.max(34,w/26)){const wave=Math.sin(x/w*TAU*1.4+phase+.55)*amp+Math.sin(x/w*TAU*2.7-phase*.6)*amp*.2;ctx.lineTo(x,y+wave+x*slope+amp*.52);}ctx.closePath();ctx.fill();}
  ctx.restore();
 }
 function drawParticle(p){
  const s=settings.size*(.25+p.z*.75);ctx.save();ctx.globalAlpha=settings.opacity/100*(.25+.72*p.z);ctx.translate(p.x,p.y);
  if(kind==='wind'){
   ctx.translate(-p.x,-p.y);if(p.z>.48&&p.trail.length>2){ctx.lineWidth=.6+p.z*.5;for(let i=1;i<p.trail.length;i++){ctx.strokeStyle=color(p,i/p.trail.length*.3);ctx.beginPath();ctx.moveTo(p.trail[i-1].x,p.trail[i-1].y);ctx.lineTo(p.trail[i].x,p.trail[i].y);ctx.stroke();}}ctx.translate(p.x,p.y);ctx.fillStyle=color(p);ctx.beginPath();ctx.ellipse(0,0,Math.max(.8,s*.19),Math.max(.5,s*.09),p.turn,0,TAU);ctx.fill();
  }else if(kind==='snow')snow(p,s);
  else if(kind==='leaves'){ctx.rotate(Math.sin(p.phase)*.65+p.turn);ctx.scale(.25+.75*Math.abs(Math.cos(p.phase*.8)),1);ctx.drawImage(leaves[(p.tone?3:0)+p.variant%3],-s,-s,s*2,s*2);}
  else if(kind==='fireflies')drawGlow(p,s);
  else if(kind==='embers')drawEmber(p,s);
  else if(kind==='stars')drawStar(p,s);
  else if(kind==='petals')drawPetal(p,s);
  else if(kind==='bubbles')drawBubble(p,s);
  else if(kind==='digital-rain')drawDigital(p,s);
  ctx.restore();
 }
 function frame(now){
  const dt=Math.min(.05,(now-last)/1000||0);last=now;const moving=!reduced();if(moving&&!muted)elapsed+=dt;ctx.clearRect(0,0,w,h);
  if(kind==='rain'){if(!muted)window.RainAtmosphere.draw(ctx,w,h,settings,moving?dt:0);requestAnimationFrame(frame);return;}
  if(!muted){if(moving)for(const p of particles)move(p,dt);if(kind==='aurora')drawAurora();else if(kind==='fog')drawFog();else for(const p of particles)drawParticle(p);}
  requestAnimationFrame(frame);
 }
 function apply(s){const reseed=s.density!==settings.density||s.size!==settings.size;settings=s;if(reseed)seed();}
 if(preview)addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='seasonal-preview')return;apply(e.data.settings);});
 else{async function poll(){try{const r=await fetch('/broadcast/seasonal/'+kind,{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d=await r.json();apply(d.settings);muted=d.muted;}catch(_){muted=true;}setTimeout(poll,1000);}poll();}
 addEventListener('resize',resize);resize();requestAnimationFrame(frame);
})();
