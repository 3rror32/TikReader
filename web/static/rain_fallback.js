// Transparent rain and water on the virtual glass; no background is painted.
window.RainAtmosphere=(()=>{
 let rain=[],glass=[];
 const rand=(a,b)=>a+Math.random()*(b-a);
 function drop(w,h,initial=false){return {x:rand(0,w),y:rand(0,h),r:rand(1.5,4.5),age:initial?rand(.5,5):0,wait:rand(.5,3),life:rand(9,18),phase:rand(0,6.28),trail:[]};}
 function reset(w,h,s){
  rain=Array.from({length:s.density},()=>({x:rand(0,w),y:rand(0,h),z:rand(.35,1)}));
  glass=Array.from({length:s.glass_count??45},()=>drop(w,h,true));
 }
 function draw(ctx,w,h,s,dt){
  const thickness=s.thickness??1;
  ctx.save();ctx.lineCap='round';
  for(const p of rain){
   const vx=s.wind*2,vy=s.speed*(4+5*p.z),length=s.size*(.6+p.z);
   p.x+=vx*dt;p.y+=vy*dt;
   if(p.y>h+length){p.y=-length;p.x=rand(0,w);}
   if(p.x< -length)p.x=w+length;if(p.x>w+length)p.x=-length;
   const tilt=vx/Math.max(vy,1);
   ctx.globalAlpha=s.opacity/100*(.18+p.z*.35);ctx.strokeStyle='#d6e9f5';ctx.lineWidth=thickness*(.4+p.z*.6);
   ctx.beginPath();ctx.moveTo(p.x-tilt*length,p.y-length);ctx.lineTo(p.x,p.y);ctx.stroke();
  }
  for(let i=0;i<glass.length;i++){
   let p=glass[i];p.age+=dt;
   if(p.age>p.life||p.y>h+20){p=glass[i]=drop(w,h);}
   if(dt&&p.age>p.wait){
    p.trail.push({x:p.x,y:p.y,age:0});
    p.y+=dt*(s.glass_speed??25)*(.25+p.r*.24)*(1+.35*Math.sin(p.age*2+p.phase));
    p.x+=Math.sin(p.y*.035+p.phase)*dt*2;
   }
   for(const point of p.trail)point.age+=dt;
   p.trail=p.trail.filter(point=>point.age<3.5).slice(-110);
   const fade=Math.min(1,p.age*5,Math.max(0,p.life-p.age)),alpha=s.opacity/100*fade;
   // A dark rim and offset highlight keep clear water visible on light or dark scenes.
   if(p.trail.length>1){
    for(const [color,width,offset]of [['#203344',p.r*.7,0],['#e9f6ff',Math.max(.5,p.r*.18),-.6]]){
     ctx.strokeStyle=color;ctx.lineWidth=width;
     for(let j=1;j<p.trail.length;j++){
      const a=p.trail[j-1],b=p.trail[j];ctx.globalAlpha=alpha*.24*(1-b.age/3.5);
      ctx.beginPath();ctx.moveTo(a.x+offset,a.y);ctx.lineTo(b.x+offset,b.y);ctx.stroke();
     }
    }
   }
   ctx.save();ctx.translate(p.x,p.y);
   const r=p.r,stretch=p.age>p.wait?1.5:1.05;
   ctx.scale(1,stretch);ctx.beginPath();ctx.moveTo(0,-r*1.2);
   ctx.bezierCurveTo(r*.5,-r*.8,r*1.1,-r*.1,r*.85,r*.55);
   ctx.bezierCurveTo(r*.6,r*1.2,-r*.7,r*1.2,-r*.9,r*.45);
   ctx.bezierCurveTo(-r,-r*.25,-r*.35,-r*.85,0,-r*1.2);
   const shine=ctx.createLinearGradient(-r,-r,r,r);
   shine.addColorStop(0,'rgba(255,255,255,.65)');shine.addColorStop(.28,'rgba(204,225,240,.05)');shine.addColorStop(.72,'rgba(12,28,40,.12)');shine.addColorStop(1,'rgba(235,249,255,.55)');
   ctx.globalAlpha=alpha;ctx.fillStyle=shine;ctx.fill();ctx.strokeStyle='rgba(20,35,48,.4)';ctx.lineWidth=.65;ctx.stroke();
   ctx.strokeStyle='rgba(255,255,255,.75)';ctx.lineWidth=.7;ctx.beginPath();ctx.moveTo(-r*.5,-r*.35);ctx.quadraticCurveTo(-r*.65,r*.3,-r*.3,r*.55);ctx.stroke();
   if(p.age<.35){ctx.globalAlpha=alpha*(1-p.age/.35)*.5;ctx.strokeStyle='#e2f4ff';ctx.beginPath();ctx.ellipse(0,0,r*(1+p.age*5),r*(.5+p.age*2),0,0,Math.PI*2);ctx.stroke();}
   ctx.restore();
  }
  ctx.restore();
 }
 return {reset,draw};
})();
