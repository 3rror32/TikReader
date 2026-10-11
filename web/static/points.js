(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const pane=el('section');pane.className='studio-pane';pane.dataset.section='points';
 const notice=el('p');notice.setAttribute('role','status');const form=el('div'),table=el('div');let config={};
 async function api(path,data){const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});const d=await r.json();if(!r.ok)throw Error(d.error||'Error');return d}
 function field(label,key,type='number'){const l=el('label',label),n=el('input');n.type=type;n.dataset.key=key;l.append(n);form.append(l);return n}
 pane.append(el('h2','Sistema de puntos y niveles'),el('p','Premia actividad real observada durante el LIVE. Los saldos permanecen en este equipo y cada evento se acredita una sola vez.'));
 const enabled=field('Activar puntos','enabled','checkbox'),currency=field('Nombre de la moneda','currency','text');
 for(const [label,key] of [['Por comentario','comment'],['Por like','like'],['Por unidad de regalo','gift'],['Por follow','follow'],['Por compartir','share'],['Por suscripción','subscribe'],['Puntos por nivel','points_per_level'],['Multiplicador de suscriptor','subscriber_multiplier']])field(label,key);
 const button=(text,fn)=>{const b=el('button',text);b.type='button';b.onclick=async()=>{b.disabled=true;try{await fn()}catch(e){notice.textContent=e.message}finally{b.disabled=false}};return b};
 async function load(){const d=await api('/points');config=d.config;for(const n of form.querySelectorAll('[data-key]'))n.type==='checkbox'?n.checked=!!config[n.dataset.key]:n.value=config[n.dataset.key];render(d.users)}
 function render(users){table.replaceChildren();const t=el('table');t.style.width='100%';const head=el('tr');for(const x of ['Usuario','Saldo','Nivel','Bono confirmado en esta sesión'])head.append(el('th',x));t.append(head);for(const u of users){const row=el('tr');for(const x of [u.display_name,String(u.points),String(u.level),u.subscriber?'Sí':'No'])row.append(el('td',x));t.append(row)}table.append(t)}
 form.append(button('Guardar configuración',async()=>{const next={};for(const n of form.querySelectorAll('[data-key]'))next[n.dataset.key]=n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value;await api('/points',next);notice.textContent='Configuración de puntos guardada.';await load()}));
 pane.append(form,el('h3','Clasificación'),button('Actualizar clasificación',load),table,el('h3','Ajuste manual'));
 const user=field('Usuario','manual_user','text'),amount=field('Cantidad positiva o negativa','manual_amount');pane.append(button('Aplicar ajuste',async()=>{await api('/points/adjust',{user:user.value,amount:Number(amount.value)});notice.textContent='Saldo actualizado.';await load()}),el('h3','Restablecer todos los puntos'));
 const confirm=field('Escribe RESTABLECER PUNTOS','reset_confirmation','text');pane.append(button('Restablecer puntos',async()=>{await api('/points/reset',{confirmation:confirm.value});confirm.value='';notice.textContent='Todos los puntos fueron restablecidos.';await load()}),notice);
 window.OperatorViewRegistry.register(pane.dataset.section,pane);load().catch(e=>notice.textContent=e.message);
})();
