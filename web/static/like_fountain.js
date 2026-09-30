(()=>{
 'use strict';
 const root=document.getElementById('effect-stage'),preview=new URLSearchParams(location.search).get('preview')==='1',particles=[];
 let settings={size:38,duration:5,color:'#ff75b5',position:'center',show_avatar:true,motion:'full'},epoch=null,cursor=0,last=0;
 const ns='http://www.w3.org/2000/svg';
 function heart(){const svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');svg.setAttribute('viewBox','0 0 64 64');path.setAttribute('d','M32 57C25 50 5 36 5 21C5 5 24 1 32 15C40 1 59 5 59 21C59 36 39 50 32 57Z');path.setAttribute('fill','currentColor');svg.append(path);svg.style.width='100%';svg.style.height='100%';return svg;}
 function clear(){for(const p of particles)p.el.remove();particles.length=0;}
 function burst(s,record={}){
  const reduced=s.motion==='reduced'||s.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches;
  const count=Math.min(18,Math.max(3,Math.ceil(Math.sqrt(Math.max(1,Number(record.count)||1))*3)));
  for(let i=0;i<count&&particles.length<72;i++){
   const el=document.createElement('div'),size=Math.max(16,Math.min(120,Number(s.size)||38))*(.65+Math.random()*.35),origin=.5;
   Object.assign(el.style,{position:'absolute',width:size+'px',height:size+'px',left:'0',top:'0',color:s.color||'#ff75b5',pointerEvents:'none',willChange:'transform,opacity'});el.className='like-fountain-particle';el.append(heart());
   if(s.show_avatar&&i%4===2&&typeof record.avatar_url==='string'&&/^https?:\/\//.test(record.avatar_url)){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';Object.assign(img.style,{position:'absolute',inset:'0',width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%'});img.onload=()=>el.firstChild.style.visibility='hidden';img.onerror=()=>img.remove();img.src=record.avatar_url;el.append(img);}
   root.append(el);particles.push({el,size,origin,age:-i*.11,duration:Math.max(2,Math.min(30,Number(s.duration)||5)),phase:Math.random()*Math.PI*2,drift:(Math.random()-.5)*.12,reduced});
  }
 }
 function frame(now){const dt=Math.min(.1,(now-last)/1000);last=now;const w=root.clientWidth,h=root.clientHeight;
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;if(p.retiring!=null){p.retiring+=dt;if(p.retiring>=.5){p.el.remove();particles.splice(i,1);continue;}}const t=p.age/p.duration;if(t>=1){p.el.remove();particles.splice(i,1);continue;}if(t<0){p.el.style.opacity='0';continue;}
   const x=Math.max(0,Math.min(w-p.size,w*(p.origin+p.drift*t)+Math.sin(t*7+p.phase)*Math.min(32,w*.04)*Math.min(1,t*4)-p.size/2));
   const y=p.reduced?h*.65:h-(h+p.size)*t;
   p.el.style.transform=`translate3d(${x}px,${y}px,0)`;p.el.style.opacity=String(Math.min(1,t*8)*(1-Math.pow(t,2))*(p.retiring==null?1:1-p.retiring/.5));
  }requestAnimationFrame(frame);
 }
 if(preview){burst(settings,{count:12});setInterval(()=>burst(settings,{count:12}),1500);addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='animation-preview')return;settings={...settings,...e.data.settings};for(const p of particles)p.retiring=0;burst(settings,{count:16});});}
 else {async function poll(){try{const r=await fetch('/broadcast/animations/fountain',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d=await r.json();if(epoch!==d.epoch){clear();epoch=d.epoch;cursor=d.serial;}if(d.muted)clear();else for(const e of d.events)if(e.id>cursor)burst(e.settings,e.record);cursor=d.serial;}catch(_){clear();}setTimeout(poll,800);}poll();}
 requestAnimationFrame(frame);
})();
