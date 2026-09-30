(() => {
  const app = document.querySelector('.app');
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const button = (text, action, className='') => { const node=el('button',text,className); node.type='button'; node.onclick=action; return node; };
  const api = async (path, data) => { const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)}); const body=await response.json(); if(!response.ok) throw Error(body.error||'No se pudo completar la acción'); return body; };
  const section = (key, kicker, title, copy) => { const node=el('section'); node.dataset.section=key; node.className='live-tool'; const hero=el('header',null,'live-tool-hero'); const words=el('div'); words.append(el('span',kicker),el('h2',title),el('p',copy)); hero.append(words); node.append(hero); app.append(node); return node; };
  const status = node => { const p=el('p','', 'live-tool-status'); p.role='status'; node.append(p); return p; };
  const format = seconds => `${Math.floor(seconds/3600)}:${String(Math.floor(seconds/60)%60).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const timerCall = async (action, seconds) => api('/interactivity/timer',{action,...(seconds==null?{}:{seconds})});
  const overlayCall = data => api('/interactivity/overlays',data);
  function overlayLink(node,key){const url=window.overlayUrl(`/widget/${key}`);const card=el('div',null,'overlay-link-card'),code=el('code',url),copy=button('Copiar URL',async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='URL copiada';setTimeout(()=>copy.textContent='Copiar URL',1800)}catch(_){code.focus();getSelection()?.selectAllChildren(code);}}),open=el('a','Abrir overlay');open.href=url;open.target='_blank';open.rel='noopener';card.append(el('small','FUENTE DE NAVEGADOR PARA STREAM'),code,copy,open);node.append(card);}

  const timer=section('timer-control','CONTROL DE TIEMPO','Temporizador del directo','Controla la cuenta atrás desde una sola pantalla. Los cambios también aparecen en el overlay interactivo.');
  timer.classList.add('timer-workspace');
  const timerNav=el('nav',null,'live-tool-subnav');timerNav.append(button('Abrir galería de overlays',()=>window.Shell?.show('overlay-gallery')));timer.append(timerNav);
  const timerGrid=el('div',null,'timer-console'); const clock=el('strong','0:00:00','timer-clock'); const timerState=el('span','PAUSADO','timer-state');
  const clockFace=el('div',null,'timer-face'); clockFace.append(el('small','TIEMPO RESTANTE'),clock,timerState); timerGrid.append(clockFace);
  const timerActions=el('div',null,'timer-actions');
  const start=button('Iniciar',()=>timerCall('start').then(renderTimer).catch(showTimerError),'primary');
  const pause=button('Pausar',()=>timerCall('pause').then(renderTimer).catch(showTimerError));
  const adjust=async delta => { const state=await api('/interactivity'); return timerCall('set',Math.max(0,state.remaining+delta)); };
  timerActions.append(start,pause,button('+10 s',()=>adjust(10).then(renderTimer).catch(showTimerError)),button('+1 min',()=>adjust(60).then(renderTimer).catch(showTimerError)),button('−10 s',()=>adjust(-10).then(renderTimer).catch(showTimerError)),button('Reiniciar',()=>timerCall('set',Number(localStorage.getItem('tikreader.timerDuration')||600)).then(renderTimer).catch(showTimerError)));
  timerGrid.append(timerActions); timer.append(timerGrid); const timerNotice=status(timer);

  let lastRemaining=null, audioContext=null;
  function completionTone(){if(window.tikreaderAudioMuted||localStorage.getItem('tikreader.timerSound')==='off'||!audioContext)return;const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.frequency.value=740;gain.gain.setValueAtTime(.12,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.65);oscillator.connect(gain).connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.65);}
  document.addEventListener('tikreader:audio-muted',e=>{if(e.detail){audioContext?.close().catch(()=>{});audioContext=null;}});
  timer.addEventListener('click',()=>{if(window.tikreaderAudioMuted)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();}catch(_){}});
  function renderTimer(data){if(lastRemaining>0&&data.remaining===0)completionTone();lastRemaining=data.remaining;clock.textContent=format(data.remaining);timerState.textContent=data.running?'EN MARCHA':'PAUSADO';timerState.classList.toggle('running',data.running);start.disabled=data.running;pause.disabled=!data.running;}
  function showTimerError(error){timerNotice.textContent=error.message;}
  async function refreshTimer(){try{renderTimer(await api('/interactivity'));}catch(error){showTimerError(error);}}
  setInterval(refreshTimer,1000); refreshTimer();

  const configuration=el('div',null,'timer-configuration');timer.append(configuration);
  const timerPanel=(id,title,copy)=>{const panel=el('section',null,'timer-panel');panel.id=id;const heading=el('h3',title);heading.id=id+'-title';panel.setAttribute('aria-labelledby',heading.id);panel.append(heading,el('p',copy,'timer-panel-copy'));configuration.append(panel);return panel;};
  const settings=timerPanel('timer-settings','Ajustes del temporizador','Define la duración de reinicio y el comportamiento cuando la cuenta llegue a cero.');
  const form=el('div',null,'tool-card'); const duration=el('input'); duration.type='number'; duration.min=1; duration.max=86400; duration.value=localStorage.getItem('tikreader.timerDuration')||600;
  const durationLabel=el('label','Duración inicial en segundos'); durationLabel.append(duration); const endSound=el('input'); endSound.type='checkbox'; endSound.checked=localStorage.getItem('tikreader.timerSound')!=='off'; const soundLabel=el('label',null,'timer-sound-option'); soundLabel.append(endSound,document.createTextNode(' Avisar con sonido al llegar a cero'));
  const settingsNotice=status(settings); form.append(durationLabel,soundLabel,button('Guardar ajustes',async()=>{try{const value=Math.max(1,Math.min(86400,Math.round(Number(duration.value))||600));duration.value=value;localStorage.setItem('tikreader.timerDuration',value);localStorage.setItem('tikreader.timerSound',endSound.checked?'on':'off');renderTimer(await timerCall('set',value));settingsNotice.textContent='Ajustes guardados y duración aplicada.';}catch(error){settingsNotice.textContent=error.message;}},'primary')); settings.insertBefore(form,settingsNotice);

  const shortcuts=timerPanel('timer-shortcuts','Atajos del temporizador','Funcionan mientras TikReader tenga el foco y no estés escribiendo en un campo.');
  const shortcutCard=el('div',null,'tool-card shortcut-list'); const shortcutRows=[['Espacio','Iniciar o pausar'],['Alt + ↑','Añadir 10 segundos'],['Alt + ↓','Quitar 10 segundos'],['Alt + R','Reiniciar']]; shortcutRows.forEach(([key,label])=>{const row=el('div');row.append(el('kbd',key),el('span',label));shortcutCard.append(row);}); shortcuts.append(shortcutCard);
  overlayLink(timer,'timer');
  document.addEventListener('keydown',async event=>{if(event.repeat||event.defaultPrevented||event.target.closest('input,textarea,select,button,a,[role=button],[contenteditable=true]'))return;let job=null;if(event.code==='Space'){event.preventDefault();job=timerState.classList.contains('running')?timerCall('pause'):timerCall('start');}if(event.altKey&&event.key==='ArrowUp'){event.preventDefault();job=adjust(10);}if(event.altKey&&event.key==='ArrowDown'){event.preventDefault();job=adjust(-10);}if(event.altKey&&event.key.toLowerCase()==='r'){event.preventDefault();job=timerCall('set',Number(localStorage.getItem('tikreader.timerDuration')||600));}if(job)job.then(renderTimer).catch(showTimerError);});

  const wheel=section('fortune-wheel','SORTEO LOCAL','Rueda de la fortuna','Edita las opciones y haz un sorteo visible para retos, premios o decisiones del directo.');
  const wheelLayout=el('div',null,'wheel-layout'); const wheelStage=el('div',null,'wheel-stage'); const wheelDisc=el('div',null,'wheel-disc'); wheelStage.append(el('i',null,'wheel-pointer'),wheelDisc); const wheelPanel=el('div',null,'tool-card');
  const wheelInput=el('textarea'); wheelInput.rows=7; wheelInput.value=localStorage.getItem('tikreader.wheelOptions')||'Reto sorpresa\n+1 minuto\nEl chat elige\nGiro extra\nSaludo especial\nSin premio'; const wheelLabel=el('label','Opciones, una por línea'); wheelLabel.append(wheelInput); const wheelResult=el('strong','Lista para girar','wheel-result'); const wheelHistory=el('ol',null,'wheel-history'); let wheelAngle=0,spinning=false,wheelSerial=null;
  const wheelTitle=el('input');wheelTitle.value='RUEDA DE LA FORTUNA';const wheelDuration=el('input');wheelDuration.type='range';wheelDuration.min=2;wheelDuration.max=12;wheelDuration.step=.2;wheelDuration.value=4.8;const wheelTurns=el('input');wheelTurns.type='number';wheelTurns.min=2;wheelTurns.max=12;wheelTurns.step=1;wheelTurns.value=5;const wheelShow=el('input');wheelShow.type='checkbox';wheelShow.checked=true;
  const labeled=(text,input)=>{const label=el('label',text);label.append(input);return label};
  const options=()=>wheelInput.value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,12); const colors=['#ff476f','#00d8bd','#ffcf5a','#8668ff','#4ea1ff','#ff8f4d','#e85bd3','#55c56f','#f45f5f','#53c7df','#c998ff','#e5b849'];
  function paintWheel(){const list=options(); const step=360/Math.max(1,list.length); wheelDisc.style.background=list.length?`conic-gradient(${list.map((_,i)=>`${colors[i%colors.length]} ${i*step}deg ${(i+1)*step}deg`).join(',')})`:'#334155'; wheelDisc.replaceChildren(...list.map((text,i)=>{const s=el('span',text);s.style.setProperty('--slot-angle',`${i*step+step/2}deg`);return s;}));}
  wheelInput.oninput=()=>{localStorage.setItem('tikreader.wheelOptions',wheelInput.value);paintWheel();};
  const normalizedTurns=()=>{const raw=Number(wheelTurns.value),value=Number.isInteger(raw)?Math.max(2,Math.min(12,raw)):5;wheelTurns.value=value;return value};
  const animateWheel=w=>{wheelAngle=w.angle;return window.WheelMotion.spin({disc:wheelDisc,pointer:wheelStage.querySelector('.wheel-pointer'),startAngle:w.spin_start_angle,endAngle:w.angle,duration:w.duration,segments:w.options.length,sound:true})};
  const saveWheel=async()=>{const data=await overlayCall({game:'wheel',action:'configure',options:options(),title:wheelTitle.value,duration:Number(wheelDuration.value),turns:normalizedTurns(),show_result:wheelShow.checked});wheelAngle=data.wheel.angle;wheelResult.textContent='Configuración publicada en el overlay.';return data};
  const spin=button('Girar en directo',async()=>{if(spinning)return;spinning=true;spin.disabled=true;try{window.WheelMotion.unlockAudio();await saveWheel();const data=await overlayCall({game:'wheel',action:'spin'}),w=data.wheel;wheelSerial=w.serial;wheelResult.textContent=`Girando ${w.turns} vueltas…`;await animateWheel(w);spinning=false;spin.disabled=false;wheelResult.textContent=`Resultado: ${w.winner}`;wheelHistory.prepend(el('li',w.winner));while(wheelHistory.children.length>5)wheelHistory.lastChild.remove();await overlayCall({game:'wheel',action:'finish'}).catch(()=>{});}catch(error){spinning=false;spin.disabled=false;wheelResult.textContent=error.message}},'primary');
  wheelPanel.append(wheelLabel,labeled('Título del overlay',wheelTitle),labeled('Duración del giro',wheelDuration),labeled('Vueltas',wheelTurns),labeled('Mostrar ganador',wheelShow),button('Guardar configuración',()=>saveWheel().catch(e=>wheelResult.textContent=e.message)),spin,wheelResult,el('small','Últimos resultados'),wheelHistory);wheelLayout.append(wheelStage,wheelPanel);wheel.append(wheelLayout);overlayLink(wheel,'fortune-wheel');paintWheel();
  overlayCall().then(data=>{const w=data.wheel;wheelInput.value=w.options.join('\n');wheelTitle.value=w.title;wheelDuration.value=w.duration;wheelTurns.value=w.turns;wheelShow.checked=w.show_result;wheelAngle=w.angle;paintWheel();wheelDisc.style.transform=`rotate(${w.angle}deg)`}).catch(()=>{});

  const drop=section('point-drop','MINIJUEGO','Caída de puntos','Lanza fichas manualmente o usa la acción Soltar punto en alcancía de una regla del LIVE. El marcador visual es independiente del saldo de los espectadores.');
  const dropLayout=el('div',null,'drop-layout'); const arena=el('div',null,'drop-arena'); const score=el('strong','0','drop-score'); const dropPanel=el('div',null,'tool-card'); let total=0,settledCoins=0;
  const piggy=el('div',null,'piggy-bank');piggy.innerHTML=window.PiggyBank.markup;window.PiggyBank.prepare(piggy);
  const dropTitle=el('input');dropTitle.value='LLUVIA DE PUNTOS';const dropSpeed=el('input');dropSpeed.type='range';dropSpeed.min=1.5;dropSpeed.max=12;dropSpeed.step=.1;dropSpeed.value=4.2;const dropSize=el('input');dropSize.type='range';dropSize.min=36;dropSize.max=120;dropSize.value=64;const dropDensity=el('input');dropDensity.type='number';dropDensity.min=1;dropDensity.max=20;dropDensity.value=8;const dropShow=el('input');dropShow.type='checkbox';dropShow.checked=true;
  const bankSelect=el('select');bankSelect.id='drop-bank-model';for(const[key,model]of Object.entries(window.PiggyBank.models)){const option=el('option',model.label);option.value=key;bankSelect.append(option);}
  const speedLabel=el('span');const updateSpeedLabel=()=>{speedLabel.textContent=`Duración de caída: ${Number(dropSpeed.value).toFixed(1)} s · más tiempo = más lento`;};dropSpeed.addEventListener('input',updateSpeedLabel);updateSpeedLabel();
  async function saveDrop(){const data=await overlayCall({game:'drop',action:'configure',title:dropTitle.value,bank:bankSelect.value,speed:Number(dropSpeed.value),size:Number(dropSize.value),density:Number(dropDensity.value),show_score:dropShow.checked});dropDensity.value=data.drop.density;dropPanel.querySelector('.config-note').textContent='Configuración publicada en el overlay.';return data}
  let sizeTimer, sizePending=false, sizeSending=false;
  async function publishSize(){
    if(sizeSending)return;sizeSending=true;
    try{while(sizePending){sizePending=false;await overlayCall({game:'drop',action:'configure',size:Number(dropSize.value)});}}
    catch(error){configNote.textContent=error.message;}
    finally{sizeSending=false;}
  }
  dropSize.addEventListener('input',()=>{
    const size=Number(dropSize.value);window.PiggyBank.setSize(piggy,size);
    for(const frame of document.querySelectorAll('iframe')){
      try{for(const jar of frame.contentDocument.querySelectorAll('.overlay-piggy-bank'))frame.contentWindow.PiggyBank?.setSize(jar,size);}catch(_){}
    }
    sizePending=true;clearTimeout(sizeTimer);sizeTimer=setTimeout(publishSize,100);
  });
  const paintPoint=(token,event)=>window.PiggyBank.paintGift(token,event);
  function settleCoin(token,event){settledCoins++;window.PiggyBank.settle(token,event,piggy);}
  const dropSeen=new Set();
  function showDeposit(d,event){if(arena.closest('.piggy-editor'))return;if(dropSeen.has(event.id))return;dropSeen.add(event.id);if(dropSeen.size>500)dropSeen.delete(dropSeen.values().next().value);const token=el('span',null,'drop-token gift-token'),slot=piggy.querySelector('.piggy-slot'),size=d.size;paintPoint(token,event);token.style.width=token.style.height=size+'px';token.style.setProperty('--drop-size',size+'px');token.setAttribute('aria-label','Punto depositado');arena.append(token);window.PiggyBank.drop({token,stage:arena,pig:piggy,slot,event,duration:d.speed*1000,onDeposit:()=>{if(!token.isConnected)return;settleCoin(token,event);configNote.textContent='Regalo guardado en la alcancía.'}});configNote.textContent='Regalo en camino.';}
  let bankSaving=false;bankSelect.onchange=async()=>{bankSaving=true;try{await saveDrop();window.PiggyBank.prepare(piggy,bankSelect.value);}catch(e){configNote.textContent=e.message;}finally{bankSaving=false;}};
  async function launch(){const data=await overlayCall({game:'drop',action:'launch'});total=data.drop.score;score.textContent=total;showDeposit(data.drop,data.drop.event);}
  const configNote=el('small','Configura cómo se verá la caída.','config-note');arena.append(el('span','PUNTOS'),score,piggy);dropPanel.append(el('p','Cada activación deposita un regalo en la alcancía.'),labeled('Tipo de alcancía',bankSelect),labeled('Título del overlay',dropTitle),(()=>{const label=el('label');label.append(speedLabel,dropSpeed);return label;})(),labeled('Tamaño de regalos',dropSize),labeled('Cantidad por lluvia',dropDensity),labeled('Mostrar marcador',dropShow),button('Guardar configuración',()=>saveDrop().catch(e=>configNote.textContent=e.message)),button('Soltar rosa de ejemplo',async()=>{try{await saveDrop();await launch();}catch(e){configNote.textContent=e.message;}},'primary'),button('Lluvia en directo',async()=>{try{await saveDrop();const count=Number(dropDensity.value);configNote.textContent=`Lluvia iniciada: ${count} puntos.`;for(let i=0;i<count;i++)setTimeout(()=>launch().catch(e=>configNote.textContent=e.message),i*420)}catch(e){configNote.textContent=e.message}}),button('Vaciar alcancía',async()=>{try{await overlayCall({game:'drop',action:'reset'});total=0;settledCoins=0;score.textContent='0';arena.querySelectorAll('.drop-token').forEach(x=>x.remove());configNote.textContent='Alcancía vacía y marcador reiniciado.';}catch(error){configNote.textContent=error.message;}}),configNote);dropLayout.append(arena,dropPanel);drop.append(dropLayout);overlayLink(drop,'point-drop');
  overlayCall().then(data=>{const d=data.drop;total=d.score;score.textContent=total;dropTitle.value=d.title==='LLUVIA DE DONACIONES'?'LLUVIA DE PUNTOS':d.title;bankSelect.value=d.bank||'cochito';window.PiggyBank.prepare(piggy,bankSelect.value);dropSpeed.value=d.speed;updateSpeedLabel();dropSize.value=d.size;dropDensity.value=d.density;dropShow.checked=d.show_score}).catch(()=>{});
  let gamesBusy=false;
  async function syncGames(){
    if(gamesBusy)return;gamesBusy=true;
    try{
      const data=await overlayCall(),w=data.wheel,d=data.drop;window.PiggyBank.setShapes(d.shapes);
      if(!spinning&&w.serial!==wheelSerial){
        wheelSerial=w.serial;
        if(w.spinning){spinning=true;spin.disabled=true;wheelResult.textContent='Girando…';
          animateWheel({...w,duration:Math.max(.1,(w.ends_at||Date.now()/1000)-Date.now()/1000)}).then(()=>{wheelResult.textContent=`Resultado: ${w.winner}`;}).catch(e=>{wheelResult.textContent=e.message;}).finally(()=>{spinning=false;spin.disabled=false;});}
        if(!w.spinning)wheelResult.textContent=w.winner?`Resultado: ${w.winner}`:'Lista para girar';
        if(!w.spinning)wheelDisc.style.transform=`rotate(${w.angle}deg)`;
        if(w.winner){wheelHistory.prepend(el('li',w.winner));while(wheelHistory.children.length>5)wheelHistory.lastChild.remove();}
      }
      if(!bankSaving&&document.activeElement!==bankSelect){bankSelect.value=d.bank||'cochito';window.PiggyBank.prepare(piggy,bankSelect.value);}
      total=d.score;score.textContent=total;
      if(!sizePending&&!sizeSending){window.PiggyBank.setSize(piggy,d.size);if(document.activeElement!==dropSize)dropSize.value=d.size;}
      if(!total){arena.querySelectorAll('.drop-token').forEach(x=>x.remove());settledCoins=0;}
      for(const event of d.events||[]){if(Date.now()/1000-event.at<15)showDeposit(d,event);}
    }catch(error){configNote.textContent=error.message;}finally{gamesBusy=false;}
  }
  setInterval(syncGames,1000);
  window.OverlayGallery?.registerGameControls('fortune-wheel',wheel);
  window.OverlayGallery?.registerGameControls('point-drop',drop);

})();
