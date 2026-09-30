window.GiftFeed=(()=>{
 let session=null;const seen=new Map();
 function image(url){try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:null;}catch(_){return null;}}
 function render(root,gifts,s,currentSession,preview){
  const first=session!==currentSession;if(first){seen.clear();session=currentSession;}
  for(const g of gifts){
   if(g.summary)continue;
   const key=g.id||[g.user,g.gift,g.timestamp].join('|'),previous=seen.get(key),changed=previous===undefined||previous!==g.count;
   const box=document.createElement('article');box.className='widget-card gift-feed-row';
   if(changed&&(!first||preview)&&s.animation!=='none')box.classList.add('gift-feed-new');
   seen.set(key,g.count);
   if(s.show_avatar){const src=image(g.avatar_url);if(src){const img=document.createElement('img');img.className='gift-donor-photo';img.src=src;img.alt='';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();box.append(img);}else if(preview){const avatar=document.createElement('span');avatar.className='gift-donor-placeholder';avatar.textContent=String(g.user||'U').replace('@','').slice(0,1);box.append(avatar);}}
   const info=document.createElement('div');info.className='gift-feed-info';
   if(s.show_name){const name=document.createElement('strong');name.translate=false;name.textContent=g.user;info.append(name);}
   const text=document.createElement('p');text.translate=false;text.textContent='Envió '+(g.gift||'un regalo');info.append(text);
   if(s.show_details||s.show_time){const detail=document.createElement('small');detail.textContent=[s.show_details&&g.ongoing?'En racha':'',s.show_time?g.timestamp:''].filter(Boolean).join(' · ');info.append(detail);}
   box.append(info);
   const visual=document.createElement('div');visual.className='gift-feed-visual';const count=document.createElement('b');count.textContent='× '+(g.count||1);visual.append(count);
   const icon=document.createElement('span');icon.className='gift-feed-icon';const src=image(g.image_url);
   const fallback=()=>{icon.textContent=preview?({Rosa:'🌹',Dona:'🍩',GG:'🎮','Corazón':'💖'}[g.gift]||'🎁'):'🎁';};fallback();
   if(src){const img=document.createElement('img');img.src=src;img.alt=g.gift||'Regalo';img.referrerPolicy='no-referrer';img.onerror=fallback;icon.replaceChildren(img);}
   visual.append(icon);box.append(visual);root.append(box);
   if(changed&&(!first||preview))window.OverlayStudio?.gift(box,s);
  }
  while(seen.size>500)seen.delete(seen.keys().next().value);
 }
 return {render};
})();
