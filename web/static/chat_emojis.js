(()=>{
 'use strict';
 const root=document.getElementById('emoji-stage'),preview=new URLSearchParams(location.search).get('preview')==='1',particles=[];
 let settings=JSON.parse(document.getElementById('emoji-settings').textContent),session=null,cursor=0,last=0;
 function safeImage(value){try{const u=new URL(value);return u.protocol==='https:'&&!u.username?u.href:null;}catch(_){return null;}}
 function clear(){for(const p of particles)p.el.remove();particles.length=0;}
 function burst(record,demo=false){
  const emojis=[];for(const part of ChatEmojiParser.parts(record.comment,record.emotes)){if(part.url){const url=safeImage(part.url);if(url)emojis.push({url,alt:part.alt||'Emoji de TikTok'});}else for(const text of ChatEmojiParser.extract(part.text,settings.max_emojis-emojis.length))emojis.push({text});if(emojis.length>=settings.max_emojis)break;}
  const origin=.15+Math.random()*.7;
  for(const [i,emoji]of emojis.entries()){
   if(particles.length>=72)break;
   const el=document.createElement('div');el.className='chat-emoji';el.style.fontSize=settings.size+'px';
   if(settings.show_avatar){const avatarUrl=safeImage(record.avatar_url);if(avatarUrl){const img=document.createElement('img');img.className='emoji-user-avatar';img.alt='';img.referrerPolicy='no-referrer';img.src=avatarUrl;img.onerror=()=>img.remove();el.append(img);}else if(demo){const avatar=document.createElement('span');avatar.className='emoji-avatar';avatar.textContent='L';el.append(avatar);}}
   if(emoji.url){const image=document.createElement('img');image.className='chat-emote-image';image.alt=emoji.alt;image.referrerPolicy='no-referrer';image.src=emoji.url;image.onerror=()=>image.remove();el.append(image);}else{const text=document.createElement('span');text.textContent=emoji.text;el.append(text);}root.append(el);
   particles.push({el,width:0,height:0,age:-i*.6,duration:settings.duration,origin,phase:Math.random()*6,direction:settings.direction,reduced:settings.motion==='reduced'||settings.motion==='system'&&matchMedia('(prefers-reduced-motion: reduce)').matches});
  }
 }
 function frame(now){const dt=Math.min(.08,(now-last)/1000);last=now;const w=root.clientWidth,h=root.clientHeight;
  // Batch layout reads once per new emoji instead of forcing layout every frame.
  for(const p of particles)if(!p.width){const box=p.el.getBoundingClientRect();p.width=box.width;p.height=box.height;}
  for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.age+=dt;const t=p.age/p.duration;if(t>=1){p.el.remove();particles.splice(i,1);continue;}if(t<0){p.el.style.opacity='0';continue;}
   const width=p.width,height=p.height;let x,y;
   if(p.reduced){x=p.origin*Math.max(0,w-width);y=h*.65;}
   else if(p.direction==='up'){x=p.origin*Math.max(0,w-width)+Math.sin(t*6+p.phase)*24;y=h-(h+height)*t;}
   else{x=p.direction==='left'?w-(w+width)*t:-width+(w+width)*t;y=p.origin*Math.max(0,h-height)+Math.sin(t*6+p.phase)*18;}
   if(p.direction==='up')x=Math.max(0,Math.min(w-width,x));else y=Math.max(0,Math.min(h-height,y));
   p.el.style.transform=`translate3d(${x}px,${y}px,0)`;p.el.style.opacity=String(Math.min(1,t*10,(1-t)*5));
  }requestAnimationFrame(frame);
 }
 if(preview){const demo=()=>burst({comment:'😂 😍 🥳 💜 🔥 ✨'},true);demo();setInterval(demo,2500);addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='emoji-preview')return;settings=e.data.settings;clear();demo();});}
 else{async function poll(){try{const options={cache:'no-store'},controller=typeof AbortController==='function'?new AbortController():null;if(controller){options.signal=controller.signal;setTimeout(()=>controller.abort(),4000);}const r=await fetch('/broadcast/emoji-overlay',options);if(!r.ok)throw Error();const d=await r.json();settings=d.settings;
   if(session!==d.session){clear();session=d.session;cursor=d.serial;}
   // Clear existing photos immediately if the delivered feed removes them.
   if(!settings.show_avatar||d.comments.length&&d.comments.every(c=>!c.avatar_url))for(const p of particles)p.el.querySelector('img')?.remove();
   if(d.muted)clear();else for(const c of d.comments)if(c.sequence>cursor)burst(c);cursor=d.serial;
  }catch(_){clear();}setTimeout(poll,800);}poll();}
 requestAnimationFrame(frame);
})();
