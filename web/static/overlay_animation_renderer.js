window.OverlayAnimationRenderer=(()=>{
 let audio;
 function formatMessage(template,user,fallback='Bienvenido TikReader'){
  const value=typeof template==='string'&&template.trim()?template.trim():fallback;
  return value.replace(/\{usuario\}/gi,String(user||'Participante').replace(/^@/,''));
 }
 function icon(shape){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 64 64');svg.setAttribute('aria-hidden','true');
  const path=document.createElementNS(ns,'path');
  path.setAttribute('d',shape==='heart'?'M32 56C26 51 5 36 5 21C5 5 24 1 32 15C40 1 59 5 59 21C59 36 38 51 32 56Z':shape==='spark'?'M32 3L39 25L61 32L39 39L32 61L25 39L3 32L25 25Z':'M32 3L40 22L61 24L45 38L50 59L32 48L14 59L19 38L3 24L24 22Z');
  path.setAttribute('fill','currentColor');svg.append(path);
  const shine=document.createElementNS(ns,'path');shine.setAttribute('d',shape==='heart'?'M13 22C13 13 20 11 24 15':'M27 24L32 13L36 25');shine.setAttribute('fill','none');shine.setAttribute('stroke','#fff');shine.setAttribute('stroke-opacity','.7');shine.setAttribute('stroke-width','3');shine.setAttribute('stroke-linecap','round');svg.append(shine);return svg;
 }
 function render(root,key,s,record={},preview=false){
  const retained=key==='cannon'?root.querySelector?.('.effect-cannon'):null;
  const scene=retained||document.createElement('div');scene.className='effect-scene effect-'+key;scene.style.setProperty('--size',s.size+'px');if(!retained)root.replaceChildren(scene);
  scene.dataset.motion=['full','reduced','system'].includes(s.motion)?s.motion:'system';
  const caption=document.createElement('div');caption.className='effect-caption';
  const name=record.user||'Participante';
  const labels={hearts:'¡Gracias por los likes!',coins:'¡Gracias, '+name+'!',welcome:formatMessage(s.message,name),celebration:record.title||'¡Meta completada!'};
  if(key!=='energy-ring'&&key!=='custom'&&key!=='cannon'&&!key.startsWith('vip-')){
   const emblem=document.createElement('div');emblem.className='effect-emblem';emblem.append(icon(key==='hearts'?'heart':'star'));caption.append(emblem);
   const label=document.createElement('small');label.textContent={hearts:'LLUVIA DE CARIÑO',coins:'REGALO RECIBIDO',welcome:'NUEVO SEGUIDOR',celebration:'OBJETIVO CONSEGUIDO'}[key];caption.append(label);
   if(key==='welcome'){
    if(typeof record.avatar_url==='string'&&/^https?:\/\//.test(record.avatar_url)){const avatar=document.createElement('img');avatar.src=record.avatar_url;avatar.alt='';avatar.referrerPolicy='no-referrer';avatar.onload=()=>emblem.classList.add('has-avatar');avatar.onerror=()=>avatar.remove();emblem.append(avatar);}
   }
   const text=document.createElement('span');text.textContent=labels[key];caption.append(text);scene.append(caption);
   if(key==='coins'){const detail=document.createElement('b');detail.className='effect-detail';detail.textContent=(record.gift||'Regalo')+' × '+(record.count||1);caption.append(detail);}
  }
  if(key==='energy-ring'){
   ['accent','secondary','tertiary'].forEach((k,i)=>scene.style.setProperty('--ring-'+i,/^#[0-9a-f]{6}$/i.test(s[k])?s[k]:['#647cff','#bc62ff','#35efff'][i]));
   scene.style.setProperty('--ring-speed',(12-Math.max(1,Math.min(10,Number(s.speed)||5)))+'s');
   scene.style.setProperty('--ring-glow',Math.max(0,Math.min(100,Number(s.glow??65)))/100);
   const wrap=document.createElement('div');wrap.className='energy-wrap';
   const orb=document.createElement('div');orb.className='energy-orb';
   for(let i=0;i<4;i++){const arc=document.createElement('i');arc.className='energy-arc energy-arc-'+i;orb.append(arc);}
   const portrait=document.createElement('div');portrait.className='energy-portrait';portrait.textContent=String(name).replace('@','').slice(0,1).toUpperCase();
   if(s.show_avatar!==false&&typeof record.avatar_url==='string'&&/^https?:\/\//.test(record.avatar_url)){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=record.avatar_url;img.onerror=()=>img.remove();portrait.append(img);}
   orb.append(portrait);wrap.append(orb);
   if(s.show_name!==false){const label=document.createElement('strong');label.className='energy-name';label.textContent=name;wrap.append(label);}
   scene.append(wrap);
  }
  let media;
  if(key==='custom'){
   if(s.asset&&/^[a-f0-9]{32}\.(png|jpg|gif|webp|mp4|webm)$/.test(s.asset)){
    media=document.createElement(/\.(mp4|webm)$/.test(s.asset)?'video':'img');media.className='effect-media';media.src='/broadcast/alert-media/'+s.asset;
    media.style.width=Math.min(100,s.size/120*100)+'%';media.style.height=media.style.width;media.style.margin='auto';
    if(media.tagName==='VIDEO'){media.muted=true;media.loop=true;media.playsInline=true;media.play().catch(()=>{});}
    media.onerror=()=>{media.remove();};scene.append(media);
   }else if(preview){caption.textContent='Sube un GIF o video para ver tu animación';scene.append(caption);}
  }
  const palettes={hearts:['#ff3977','#ff7699','#ffacbe','#ff604c'],coins:['#ffd36a','#ffeaa6','#e7a433','#fff3c4'],welcome:['#62e9d5','#78cfff','#d3f9f4','#4ac7dd'],celebration:['#ffcf65','#64ddff','#ff7199','#a996ff']};
  if(key!=='energy-ring'&&key!=='custom'&&key!=='cannon'&&!key.startsWith('vip-'))for(let i=0;i<(key==='welcome'?24:key==='hearts'?30:48);i++){
   const p=document.createElement('i'),spark=i%4===0;p.className='effect-particle'+(spark?' effect-spark':'');
   if(key==='celebration'&&!spark)p.classList.add('effect-confetti');
   else p.append(icon(spark?'spark':key==='hearts'?'heart':'star'));
   const vars={x:Math.random()*100+'%',y:(8+Math.random()*84)+'%',size:Math.max(12,s.size*(spark?.28:.5+Math.random()*.6))+'px',time:(2.8+Math.random()*2)+'s',delay:(-Math.random()*5)+'s',spin:(Math.random()*720-360)+'deg',dx:(Math.random()-.5)*140+'vw',drift:(Math.random()-.5)*30+'vw',color:palettes[key][i%4]};
   for(const[k,v]of Object.entries(vars))p.style.setProperty('--'+k,v);scene.append(p);
  }
  if(key.startsWith('vip-'))window.VipCelebration.decorate(scene,key,s,record);
  const stopCannon=key==='cannon'?window.GiftCannon.start(scene,s,record):null;
  const stopStudio=window.OverlayStudio?.effect(scene,key,s);
  const oscillators=[];
  if(s.sound!=='none'&&s.volume>0){try{
   audio=audio||new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});
   for(const [i,f] of (s.sound==='bell'?[660]:[523,659,784]).entries()){
    const o=audio.createOscillator(),g=audio.createGain(),start=audio.currentTime+i*.12;o.frequency.value=f;g.gain.setValueAtTime(s.volume/100*.15,start);g.gain.exponentialRampToValueAtTime(.001,start+.55);o.connect(g);g.connect(audio.destination);o.start(start);o.stop(start+.6);o.onended=()=>{o.disconnect();g.disconnect();};oscillators.push(o);
   }
  }catch(_){}}
  let resolve,finished=false,leaving=false,exitTimer=null;const done=new Promise(r=>resolve=r);
  function cancel(){if(finished)return;finished=true;clearTimeout(timer);clearTimeout(exitTimer);stopCannon?.();stopStudio?.();media?.pause?.();oscillators.forEach(o=>{try{o.stop()}catch(_){}});scene.remove();resolve();}
  // Natural completion waits for the whole scene to fade before releasing the queue.
  // Explicit cancellation remains immediate for privacy/emergency controls.
  function finish(){
   if(finished||leaving)return;leaving=true;clearTimeout(timer);
   if(key==='cannon'){
    // Keep the idle launcher visible in gallery cards and the editor.
    // Only the event caption exits; deposited roses persist across donations.
    scene.classList.add('cannon-preview-rest');
    exitTimer=setTimeout(()=>{if(finished)return;finished=true;scene.querySelector('.cannon-caption')?.remove();resolve();},500);
   }else{scene.classList.add('effect-leaving');exitTimer=setTimeout(cancel,500);}
  }
  const duration=Math.max(2,Math.min(30,Number(s.duration)||5))*1000;
  let timer=key==='cannon'?null:setTimeout(finish,duration);
  function extend(){
   if(finished||leaving||key!=='hearts')return false;
   clearTimeout(timer);timer=setTimeout(finish,duration);return true;
  }
  if(stopCannon?.done)stopCannon.done.then(finish);return {done,cancel,finish,extend};
 }
 return {render,formatMessage};
})();
