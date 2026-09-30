window.VipCelebration={decorate(scene,key,s,record){
 scene.classList.add('vip-scene');scene.style.setProperty('--vip-accent',s.accent||'#36dcc4');scene.style.setProperty('--vip-text',(s.text_size||36)+'px');
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;};
 if(key==='vip-runway'){
  for(const side of ['left','right']){const light=el('div','vip-light vip-light-'+side);light.append(el('div','vip-lamp'),el('div','vip-beam'));scene.append(light);}
  const runway=el('div','vip-runway');runway.append(el('div','vip-carpet'));for(let i=0;i<7;i++){const post=el('i','vip-post');post.style.left=(5+i*15)+'%';runway.append(post);}scene.append(runway);
 }
 const hero=el('div','vip-hero'),portrait=el('div','vip-portrait'),fallback=el('span','vip-monogram',(record.user||'TikReader').replace('@','').slice(0,1).toUpperCase());portrait.append(fallback);
 if(s.show_avatar!==false&&typeof record.avatar_url==='string'&&/^https:\/\//.test(record.avatar_url)){const img=el('img','vip-avatar');img.alt='';img.referrerPolicy='no-referrer';img.onload=()=>fallback.hidden=true;img.onerror=()=>img.remove();img.src=record.avatar_url;portrait.append(img);}
 const message=window.OverlayAnimationRenderer?.formatMessage(s.message,record.user,'¡Gracias por suscribirte!')||(s.message||'¡Gracias por suscribirte!');
 portrait.append(el('span','vip-crown','♛'));hero.append(portrait,el('strong','vip-name',record.user||'TikReader'),el('div','vip-message',message));scene.append(hero);
 const ns='http://www.w3.org/2000/svg';
 for(let i=0;i<Math.max(10,Math.min(64,s.density||45));i++){
  const p=el('div','vip-particle'),svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 64 64');
  const path=document.createElementNS(ns,'path'),heart=key==='vip-hearts';path.setAttribute('d',heart?'M32 57C25 50 5 36 5 21C5 5 24 1 32 15C40 1 59 5 59 21C59 36 39 50 32 57Z':'M13 8H51L62 25L32 59L2 25Z');path.setAttribute('fill',heart?(i%2?'#ff75ad':'var(--vip-accent)'):(i%2?'#a4edff':'var(--vip-accent)'));svg.append(path);
  if(!heart){const facets=document.createElementNS(ns,'path');facets.setAttribute('d','M2 25H62M13 8L22 25L32 59L42 25L51 8M22 25L32 8L42 25');facets.setAttribute('stroke','#fff');facets.setAttribute('stroke-width','2');facets.setAttribute('fill','none');svg.append(facets);}
  p.append(svg);p.style.setProperty('--x',Math.random()*100+'%');p.style.setProperty('--y',Math.random()*90+'%');p.style.setProperty('--p-size',(s.size||48)*(.3+Math.random()*.65)+'px');p.style.setProperty('--fall',(3+Math.random()*4)+'s');p.style.setProperty('--delay',(-Math.random()*7)+'s');p.style.setProperty('--drift',(Math.random()-.5)*180+'px');scene.append(p);
 }
}};
