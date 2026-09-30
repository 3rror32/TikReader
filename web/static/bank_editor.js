/* Edit the existing live preview; never mount a second bank. */
(() => {
  const panel=document.querySelector('[data-overlay-game="point-drop"] .tool-card');if(!panel)return;
  const box=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Ajustar área de llenado y entrada';box.append(summary);
  const note=document.createElement('p');note.textContent='Arrastra los puntos sobre la alcancía. El punto amarillo es la entrada. También puedes seleccionar un punto y moverlo con las flechas.';box.append(note);
  const status=document.createElement('p');status.role='status';box.append(status);panel.append(box);
  let svg=null,draft=null,key=null,selected=0;
  function close(){svg?.remove();svg=null;}
  const action=(label,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{b.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{b.disabled=false;}};box.append(b);return b;};
  const ns='http://www.w3.org/2000/svg';
  function draw(){
    svg.replaceChildren();const polygon=document.createElementNS(ns,'polygon');polygon.setAttribute('points',draft.points.map(p=>p.join(',')).join(' '));polygon.setAttribute('fill','#6de3c433');polygon.setAttribute('stroke','#6de3c4');polygon.setAttribute('stroke-width','.45');svg.append(polygon);
    [...draft.points,draft.slot].forEach((p,i)=>{const c=document.createElementNS(ns,'circle');c.setAttribute('cx',p[0]);c.setAttribute('cy',p[1]);c.setAttribute('r',i===selected?1.7:1.2);c.setAttribute('fill',i===draft.points.length?'#ffda68':'#6de3c4');c.setAttribute('stroke','#081720');c.setAttribute('stroke-width','.4');c.setAttribute('tabindex','0');c.setAttribute('role','button');c.setAttribute('aria-label',i===draft.points.length?'Entrada de regalos':`Punto ${i+1}`);c.style.cursor='grab';
      c.onpointerdown=e=>{selected=i;c.setPointerCapture(e.pointerId);};
      c.onpointermove=e=>{if(!c.hasPointerCapture(e.pointerId))return;const r=svg.getBoundingClientRect();p[0]=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));p[1]=Math.max(0,Math.min(100,(e.clientY-r.top)/r.height*100));c.setAttribute('cx',p[0]);c.setAttribute('cy',p[1]);polygon.setAttribute('points',draft.points.map(p=>p.join(',')).join(' '));};
      c.onpointerup=()=>draw();c.onfocus=()=>{selected=i;};c.onkeydown=e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();p[0]=Math.max(0,Math.min(100,p[0]+delta[0]*(e.shiftKey?1:.25)));p[1]=Math.max(0,Math.min(100,p[1]+delta[1]*(e.shiftKey?1:.25)));draw();svg.children[i+1].focus();};svg.append(c);
    });
  }
  async function edit(){
    close();const frame=document.getElementById('overlay-preview'),pig=frame?.contentDocument?.querySelector('.overlay-piggy-bank');
    if(!pig)throw Error('Espera a que cargue la alcancía en la vista previa.');
    key=pig.dataset.bank;draft=structuredClone(frame.contentWindow.PiggyBank.shapeFor(key));
    svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','none');svg.setAttribute('aria-label','Contorno de llenado');Object.assign(svg.style,{position:'absolute',inset:'0',width:'100%',height:'100%',zIndex:30,touchAction:'none',overflow:'visible'});pig.append(svg);draw();status.textContent='Editando '+window.PiggyBank.models[key].label+'. Los cambios se publican al guardar.';
  }
  action('Editar sobre la alcancía',edit);
  action('Añadir punto después del seleccionado',()=>{if(!draft||!svg)throw Error('Abre el editor primero.');if(draft.points.length>=64)throw Error('Máximo 64 puntos.');const i=Math.min(selected,draft.points.length-1),a=draft.points[i],b=draft.points[(i+1)%draft.points.length];draft.points.splice(i+1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);selected=i+1;draw();});
  action('Quitar punto seleccionado',()=>{if(!draft||!svg)throw Error('Abre el editor primero.');if(selected>=draft.points.length||draft.points.length<=6)throw Error('Conserva al menos seis puntos y la entrada.');draft.points.splice(selected,1);selected=0;draw();});
  async function save(shape){const r=await fetch('/interactivity/overlays',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({game:'drop',action:'shape',bank:key,shape})});const d=await r.json();if(!r.ok)throw Error(d.error);close();status.textContent='Cavidad guardada para '+window.PiggyBank.models[key].label+'.';}
  action('Guardar cavidad',()=>{if(!svg)throw Error('Abre el editor primero.');return save(draft);});
  action('Restaurar contorno original',()=>{key=document.getElementById('drop-bank-model').value;return save(null);});
  action('Cancelar edición',()=>{close();status.textContent='Edición cancelada.';});
  box.ontoggle=()=>{if(!box.open)close();};document.getElementById('drop-bank-model').addEventListener('change',close);
  document.getElementById('overlay-preview')?.addEventListener('load',close);
})();
