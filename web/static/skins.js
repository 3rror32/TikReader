(()=>{
  const labels={original:'TikReader',kawai:'Kawai',dark:'Dark',light:'Light',cute:'Cute',dracula:'Dracula',ice:'Ice','one-dark-pro':'One Dark Pro','github-dark':'GitHub Dark',monokai:'Monokai',glass:'Glass',aetheria:'Aetheria',cloudfoam:'Cloudfoam',monolith:'Monolith',chromapulse:'ChromaPulse'};
  const allowed=new Set(Object.keys(labels));
  const select=document.getElementById('skin-select');
  const apply=document.getElementById('skin-apply');
  const status=document.getElementById('skin-status');
  if(!select||!apply||!status)return;

  let saved='original';
  try{saved=localStorage.getItem('tikreader.skin')||'original';}catch(_){}
  if(!allowed.has(saved))saved='original';

  function setSkin(skin,announce=false){
    const next=allowed.has(skin)?skin:'original';
    document.documentElement.dataset.skin=next;
    select.value=next;
    try{localStorage.setItem('tikreader.skin',next);}catch(_){}
    status.textContent=announce?`Skin ${labels[next]} aplicada.`:`Skin actual: ${labels[next]}.`;
    window.dispatchEvent(new CustomEvent('tikreader:skin',{detail:{skin:next}}));
  }

  setSkin(saved);
  apply.addEventListener('click',()=>setSkin(select.value,true));
})();

