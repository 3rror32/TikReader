(()=>{
 const root=document.getElementById('creator-widget'),kind=root.dataset.kind,preview=new URLSearchParams(location.search).has('preview');
 const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n};
 function render(data,now,connected){root.replaceChildren();if(!data)return;const box=el('section');box.className='match';
  box.append(el('small',preview?'VISTA PREVIA · EJEMPLO':kind==='battle'?(data.source==='manual'?'MARCADOR MANUAL':'DATOS RECIBIDOS DE TIKTOK'):'JUEGOS DEL CHAT'));
  box.append(el('h1',kind==='battle'?'Batalla en vivo':data.title));
  const remaining=data.ends_at?Math.max(0,Math.ceil(data.ends_at-now)):null;
  if(kind==='battle'||data.mode==='race'){
   const scores=kind==='battle'?Object.values(data.sides||{}):Object.entries(data.scores).map(([user,score])=>({user,score}));
   const board=el('div');board.className='scoreboard';
   for(const side of scores){const team=el('div');team.className='team';team.append(el('span',side.user),el('b',side.score==null?'—':Number(side.score).toLocaleString()));board.append(team)}box.append(board);
   if(!scores.length)box.append(el('p','Esperando puntuaciones de TikTok…'));
   if(kind==='arena'){const values=Object.values(data.scores),p=el('progress');p.max=Math.max(1,values[0]+values[1]);p.value=values[0];p.setAttribute('aria-label','Proporción de puntos del equipo rojo');box.append(p,el('p','Escribe !rojo o !azul para unirte.'),el('small',data.gifts?'Cada unidad de regalo suma un punto al equipo elegido.':'Cada participante aporta un voto.'))}
  }else{box.append(el('p',data.running?'Escribe tu respuesta en el chat.':'Ronda terminada'),el('b',data.correct+' respuestas correctas'));const list=el('ol');for(const user of data.winners||[])list.append(el('li',user));box.append(list)}
  const ended=kind==='battle'?['finished','interrupted'].includes(data.status):!data.running;
  const label=ended?'Ronda terminada':remaining===null?'Tiempo no disponible':`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')} restantes`;
  box.append(el('footer',label));
  if(kind==='battle'&&data.source==='tiktok'&&(!connected||now-data.updated_at>30))box.append(el('small','Sin actualización reciente · el marcador puede estar incompleto'));
  root.append(box);
 }
 async function poll(){try{const r=await fetch('/broadcast/creator/'+kind,{cache:'no-store',signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error();const d=await r.json();if(d.muted)root.replaceChildren();else render(d.data,d.now,d.connected)}catch(_){root.replaceChildren()}finally{setTimeout(poll,1000)}}
 if(preview){const data=kind==='battle'?{source:'manual',sides:{a:{user:'Tu equipo',score:1250},b:{user:'Rival',score:980}},ends_at:Date.now()/1000+120}:{mode:'race',title:'Carrera del chat',scores:{rojo:35,azul:28},running:true,gifts:false,ends_at:Date.now()/1000+120};render(data,Date.now()/1000,true)}else poll();
})();
