(()=>{
 const root=document.getElementById('user-info'),preview=new URLSearchParams(location.search).get('preview')==='1';let settings=JSON.parse(document.getElementById('info-settings').textContent),signature='';
 function render(info){const next=JSON.stringify([info,settings]);if(next===signature)return;signature=next;root.replaceChildren();root.hidden=!info;if(!info)return;root.style.fontSize=settings.font_size+'px';
  const rank=document.createElement('span');rank.className='rank';rank.textContent=info.rank?info.rank+'.':'—';rank.title='Posición por puntos acumulados';root.append(rank);
  const portrait=document.createElement('div');portrait.className='portrait';const initial=document.createElement('span');initial.className='initial';initial.textContent=String(info.user||'U').replace('@','').slice(0,1).toUpperCase();portrait.append(initial);
  if(settings.show_avatar&&typeof info.avatar_url==='string'&&/^https:\/\//.test(info.avatar_url)){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=info.avatar_url;img.onload=()=>initial.hidden=true;img.onerror=()=>img.remove();portrait.append(img);}
  if(settings.show_crown&&info.rank===1){const crown=document.createElement('span');crown.className='crown';crown.title='Primer lugar';portrait.append(crown);}root.append(portrait);
  const details=document.createElement('div');details.className='details';const level=document.createElement('span');level.className='level';level.textContent=info.level;level.title='Nivel';const user=document.createElement('strong');user.textContent=info.user;details.append(level,user);
  const points=document.createElement('div');points.className='points';points.textContent=new Intl.NumberFormat('es-MX').format(info.points)+' '+info.currency;details.append(points);root.append(details);
 }
 const demo=()=>render({user:'TikReader',points:123456,level:90,rank:1,currency:'Puntos'});
 if(preview){demo();addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='user-info-preview')return;settings=e.data.settings;demo();});}
 else{async function poll(){try{const r=await fetch('/broadcast/user-info',{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d=await r.json();settings=d.settings;render(d.info);}catch(_){render(null);}setTimeout(poll,700);}poll();}
})();
