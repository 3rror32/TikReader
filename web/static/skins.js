(()=>{
  const labels={original:'TikReader','broadcast-console':'Consola Broadcast','creator-pop':'Creator Pop','studio-rundown':'Guion de Estudio','terminal-crt':'Terminal Retro · CRT','cyber-neumorph':'Neumorfismo Cyberpunk','swiss-brutalist':'Brutalismo Suizo','tactile-scrapbook':'Scrapbook Táctil',kawai:'Kawai',dark:'Dark',light:'Luz de estudio',cute:'Creativo',dracula:'Dracula',ice:'Ice','one-dark-pro':'One Dark Pro','github-dark':'GitHub Dark',monokai:'Monokai',glass:'Glass',aetheria:'Aetheria',cloudfoam:'Cloudfoam',monolith:'Monolith',chromapulse:'ChromaPulse'};
  const allowed=new Set(Object.keys(labels));
  const select=document.getElementById('skin-select');
  const status=document.getElementById('skin-status');
  const recommendations=[...document.querySelectorAll('[data-skin-choice]')];
  const more=document.querySelector('.skin-more');
  if(!select||!status)return;

  let saved='original';
  try{saved=localStorage.getItem('tikreader.skin')||'original';}catch(_){}
  if(!allowed.has(saved))saved='original';

  function setSkin(skin,announce=false){
    const next=allowed.has(skin)?skin:'original';
    document.documentElement.dataset.skin=next;
    select.value=next;
    for(const button of recommendations){
      const active=button.dataset.skinChoice===next;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    }
    try{localStorage.setItem('tikreader.skin',next);}catch(_){}
    status.textContent=announce?`Tema ${labels[next]} aplicado.`:`Tema actual: ${labels[next]}.`;
    window.dispatchEvent(new CustomEvent('tikreader:skin',{detail:{skin:next}}));
  }

  setSkin(saved);
  select.addEventListener('change',()=>setSkin(select.value,true));
  for(const button of recommendations)button.addEventListener('click',()=>setSkin(button.dataset.skinChoice,true));
  if(more&&!recommendations.some(button=>button.dataset.skinChoice===saved))more.open=true;
})();

