(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const bar=el('section');bar.className='participants-bar';bar.setAttribute('aria-label','Actividad reciente de participantes');
 const head=el('div');head.className='participants-head';const title=el('h2','Actividad reciente');const count=el('span','0 recientes');
 const tabs=el('div');tabs.className='participants-tabs';const present=el('button','Actividad reciente');const joined=el('button','Se unieron');present.type=joined.type='button';present.className='active';
 const list=el('div');list.className='participants-list';
 const auto=el('button');auto.id='greeting-auto-toggle';auto.type='button';auto.className='auto-reading-toggle';
 const reading=el('div');reading.className='live-reading-controls';reading.setAttribute('role','group');reading.setAttribute('aria-label','Lectura de participantes');reading.append(auto);
 head.append(title,count);tabs.append(present,joined);bar.append(head,reading,tabs,list);document.querySelector('.live-columns > .gifts-column').before(bar);
 let data={participants:[],joins:[]},mode='participants',session=null,revision=-1,expiryTimer=null;
 function safeAvatar(url,user){if(!url)return null;try{const u=new URL(url);if(u.protocol!=='https:'||u.username)return null;const img=el('img');img.src=u.href;img.alt=`Foto de ${user}`;img.loading='lazy';img.decoding='async';img.referrerPolicy='no-referrer';img.onerror=()=>img.remove();return img}catch(_){return null}}
 function draw(){
  const rows=mode==='joins'?data.joins:data.participants;
  const isEmpty=!data.participants.length&&!data.joins.length;
  bar.classList.toggle('is-empty',isEmpty);present.classList.toggle('active',mode==='participants');joined.classList.toggle('active',mode==='joins');
  count.textContent=isEmpty?'Sin actividad':String(data.participants.length);
  count.setAttribute('aria-label',window.I18n?.t?.('{count} participantes con actividad reciente',{count:data.participants.length})||`${data.participants.length} participantes con actividad reciente`);
  list.replaceChildren();
  for(const row of rows){
   const item=el('div');item.className='participant-chip';const img=safeAvatar(row.avatar_url,row.user);
   item.append(img||el('span',(row.user||'?').replace(/^@/,'').slice(0,1).toUpperCase()),el('b',row.user));
   const badges=el('div');badges.className='participant-badges';
   window.ChatExtras?.badges(badges,row.badges);if(badges.childNodes.length)item.append(badges);
   if(mode==='joins')item.append(el('small',new Date(row.joined_at*1000).toLocaleTimeString((window.I18n?.locale || 'es-419'),{hour12:true})));
   window.ChatExtras?.greeting(item,row.user);list.append(item);
  }
  if(!rows.length)list.append(el('p',isEmpty?'Aparecerán al entrar o interactuar.':mode==='joins'?'Sin entradas recientes.':'Sin actividad reciente.'));
 }
 function scheduleExpiry(){
  if(expiryTimer!==null){clearTimeout(expiryTimer);expiryTimer=null;}
  const windowSeconds=Number(data.activity_window_seconds)||180;
  const deadlines=(data.participants||[]).map(row=>Number(row.last_seen)+windowSeconds).filter(Number.isFinite);
  if(!deadlines.length)return;
  const delay=Math.max(0,Math.min(...deadlines)*1000-Date.now());
  expiryTimer=setTimeout(()=>{
   expiryTimer=null;const cutoff=Date.now()/1000-windowSeconds;
   data={...data,participants:(data.participants||[]).filter(row=>Number(row.last_seen)>cutoff)};
   draw();scheduleExpiry();
  },delay);
 }
 const seen=new Set();let ready=false;
 function render(next){
  if(!next)return;
  if(next.session!==session){session=next.session;revision=-1;seen.clear();ready=false;}
  if((next.revision??0)<revision)return;
  revision=next.revision??revision;
  for(const row of [...(next.participants||[]),...(next.joins||[])]){
   const key=(row.user||'').replace(/^@/,'').toLocaleLowerCase();
   if(!key||seen.has(key))continue;
   seen.add(key);if(ready)window.Studio?.greetAutomatic(row.user);
  }
  ready=true;data=next;draw();scheduleExpiry();
 }
 window.ChatExtras.bindAutoToggle(auto,'tts-greetings-enabled','saludos automáticos a participantes','Saludar participantes');
 window.ChatExtras.bindAutoToggle(document.getElementById('gift-auto-toggle'),'tts-gifts-enabled','lectura automática de regalos','Leer regalos');
 present.onclick=()=>{mode='participants';draw()};joined.onclick=()=>{mode='joins';draw()};
 window.Participants={render};window.addEventListener('tikreader:participants',e=>render(e.detail));draw();
})();
