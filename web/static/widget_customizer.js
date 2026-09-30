(()=>{
 const panels=[['chat','Comentarios'],['gifts','Regalos'],['ranking','Ranking'],['stats','Contadores'],['goals','Metas'],['highlight','Destacado'],['announcement','Respuestas y escenas']];
 const links=document.getElementById('widget-links');if(!links)return;
 panels.forEach(([key,label],index)=>{const row=links.children[index];if(!row)return;const button=document.createElement('button');button.type='button';button.textContent='Ver y personalizar';button.setAttribute('aria-label',`Ver y personalizar ${label}`);button.onclick=()=>{window.Shell?.show('overlay-gallery');requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('tikreader:open-overlay',{detail:{key,label}})))};row.append(button)});
})();
