window.DonorRanking={render(root,rows,s,kind='coins'){
 for(const [i,row]of rows.entries()){
  const item=document.createElement('article');item.className='widget-card donor-rank-row';
  const rank=document.createElement('b');rank.className='donor-position';rank.textContent=['🥇','🥈','🥉'][i]||String(i+1)+'.';item.append(rank);
  if(s.show_avatar){const portrait=document.createElement('div');portrait.className='donor-portrait';portrait.dataset.place=i+1;const fallback=document.createElement('span');fallback.className='donor-initial';fallback.textContent=String(row.user||'U').replace('@','').slice(0,1).toUpperCase();portrait.append(fallback);
   try{const url=new URL(row.avatar_url);if(url.protocol==='https:'&&!url.username&&!url.password){const img=document.createElement('img');img.alt='';img.referrerPolicy='no-referrer';img.src=url.href;img.onload=()=>fallback.hidden=true;img.onerror=()=>img.remove();portrait.append(img);}}catch(_){}
   if(i===0){const crown=document.createElement('i');crown.className='donor-crown';crown.title=kind==='likes'?'Líder de likes':'Principal donador';portrait.append(crown);}item.append(portrait);
  }
  const info=document.createElement('div');info.className='donor-rank-info';
  if(s.show_name){const name=document.createElement('strong');name.translate=false;name.textContent=row.user;info.append(name);}
  const score=document.createElement('p');score.textContent=(kind==='likes'?'♥ ':'🟡 ')+new Intl.NumberFormat('es-MX').format(row[kind]);score.title=kind==='likes'?'Likes identificados en esta sesión':'Monedas recibidas en esta sesión';info.append(score);item.append(info);root.append(item);
 }
}};
