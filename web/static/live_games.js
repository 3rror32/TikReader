(() => {
  const app = document.querySelector('.app');
  const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
  const button = (text, action, className='') => { const node=el('button',text,className); node.type='button'; node.onclick=action; return node; };
  const api = async (path, data) => { const response=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)}); const body=await response.json(); if(!response.ok) throw Error(body.error||'No se pudo completar la acción'); return body; };
  const section = (key, kicker, title, copy) => { const node=el('section'); node.dataset.section=key; node.className='live-tool'; const hero=el('header',null,'live-tool-hero'); const words=el('div'); words.append(el('span',kicker),el('h2',title),el('p',copy)); hero.append(words); node.append(hero); window.OperatorViewRegistry.register(key,node); return node; };
  const status = node => { const p=el('p','', 'live-tool-status'); p.role='status'; node.append(p); return p; };
  const format = (seconds,mode='hms') => {const hours=String(Math.floor(seconds/3600)),minutes=String(Math.floor(seconds/60)%60).padStart(2,'0'),secs=String(seconds%60).padStart(2,'0');return mode==='ms'?`${Math.floor(seconds/60)}:${secs}`:mode==='auto'&&hours==='0'?`${minutes}:${secs}`:`${hours}:${minutes}:${secs}`;};
  const timerCall = async (action, seconds) => api('/interactivity/timer',{action,...(seconds==null?{}:{seconds})});
  const overlayCall = data => api('/interactivity/overlays',data);
  function overlayLink(node,key){const url=window.overlayUrl(`/widget/${key}`);const card=el('div',null,'overlay-link-card'),code=el('code',url),copy=button('Copiar URL',async()=>{try{await navigator.clipboard.writeText(url);copy.textContent='URL copiada';setTimeout(()=>copy.textContent='Copiar URL',1800)}catch(_){code.focus();getSelection()?.selectAllChildren(code);}}),open=el('a','Abrir overlay');open.href=url;open.target='_blank';open.rel='noopener';card.append(el('small','FUENTE DE NAVEGADOR PARA STREAM'),code,copy,open);node.append(card);}

  const timer=section('timer-control','CONTROL DE TIEMPO','Temporizador del directo','Controla la cuenta atrás desde una sola pantalla. Los cambios también aparecen en el overlay interactivo.');
  timer.classList.add('timer-workspace');
  const timerNav=el('nav',null,'live-tool-subnav');timerNav.append(button('Abrir herramientas de overlays',()=>window.Shell?.show('overlay-tools')));timer.append(timerNav);
  const timerGrid=el('div',null,'timer-console'); const clock=el('strong','0:00:00','timer-clock'); const timerState=el('span','PAUSADO','timer-state');
  const clockLabel=el('small','TIEMPO RESTANTE');const clockFace=el('div',null,'timer-face'); clockFace.append(clockLabel,clock,timerState); timerGrid.append(clockFace);
  const timerActions=el('div',null,'timer-actions');
  const start=button('Iniciar',()=>timerCall('start').then(renderTimer).catch(showTimerError),'primary');
  const pause=button('Pausar',()=>timerCall('pause').then(renderTimer).catch(showTimerError));
  const adjust=async delta => { const state=await api('/interactivity'); return timerCall('set',Math.max(0,state.remaining+delta)); };
  timerActions.append(start,pause,button('+10 s',()=>adjust(10).then(renderTimer).catch(showTimerError)),button('+1 min',()=>adjust(60).then(renderTimer).catch(showTimerError)),button('−10 s',()=>adjust(-10).then(renderTimer).catch(showTimerError)),button('Reiniciar',()=>timerCall('set',Number(localStorage.getItem('tikreader.timerDuration')||600)).then(renderTimer).catch(showTimerError)));
  timerGrid.append(timerActions); timer.append(timerGrid); const timerNotice=status(timer);

  let lastRemaining=null, audioContext=null,timerStyle={theme:'dark',background:'#111820',text_color:'#f4f7fc',accent_color:'#5db8f3',border_color:'#5db8f3',font_family:'Segoe UI',font_size:64,title_size:14,radius:16,opacity:93,show_background:true,timer_title:'TIEMPO RESTANTE',timer_format:'hms',timer_show_label:true,timer_show_state:true,timer_warning_seconds:30,timer_digit_animation:'flip',timer_animation_speed:420,timer_glow:true};
  function completionTone(){if(window.tikreaderAudioMuted||localStorage.getItem('tikreader.timerSound')==='off'||!audioContext)return;const oscillator=audioContext.createOscillator(),gain=audioContext.createGain();oscillator.frequency.value=740;gain.gain.setValueAtTime(.12,audioContext.currentTime);gain.gain.exponentialRampToValueAtTime(.001,audioContext.currentTime+.65);oscillator.connect(gain).connect(audioContext.destination);oscillator.start();oscillator.stop(audioContext.currentTime+.65);}
  document.addEventListener('tikreader:audio-muted',e=>{if(e.detail){audioContext?.close().catch(()=>{});audioContext=null;}});
  timer.addEventListener('click',()=>{if(window.tikreaderAudioMuted)return;try{audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();}catch(_){}});
  function applyTimerStyle(value={}){timerStyle={...timerStyle,...value};clockFace.dataset.theme=timerStyle.theme||'dark';clockFace.dataset.background=timerStyle.show_background===false?'off':'on';clockFace.dataset.digitAnimation=timerStyle.timer_digit_animation||'flip';clockFace.dataset.glow=timerStyle.timer_glow===false?'off':'on';clockFace.style.setProperty('--timer-bg',timerStyle.background||'#111820');clockFace.style.setProperty('--timer-text',timerStyle.text_color||'#f4f7fc');clockFace.style.setProperty('--timer-accent',timerStyle.accent_color||'#5db8f3');clockFace.style.setProperty('--timer-border',timerStyle.border_color||'#5db8f3');clockFace.style.setProperty('--timer-font',timerStyle.font_family||'Segoe UI');clockFace.style.setProperty('--timer-clock-size',`${Math.round((Number(timerStyle.font_size)||64)*1.45)}px`);clockFace.style.setProperty('--timer-title-size',`${Number(timerStyle.title_size)||14}px`);clockFace.style.setProperty('--timer-radius',`${Number(timerStyle.radius)||16}px`);clockFace.style.setProperty('--timer-opacity',`${Math.max(0,Math.min(100,Number(timerStyle.opacity)||0))/100}`);clockFace.style.setProperty('--timer-motion-speed',`${Math.max(120,Math.min(1400,Number(timerStyle.timer_animation_speed)||420))}ms`);clockLabel.textContent=timerStyle.timer_title||'TIEMPO RESTANTE';clockLabel.hidden=timerStyle.timer_show_label===false;timerState.hidden=timerStyle.timer_show_state===false;if(lastRemaining!==null)clock.textContent=format(lastRemaining,timerStyle.timer_format);clockFace.dataset.warning=lastRemaining>0&&lastRemaining<=Number(timerStyle.timer_warning_seconds||0)?'yes':'no';}
  timer.applyOverlaySettings=applyTimerStyle;applyTimerStyle();
  function renderTimer(data){const changed=lastRemaining!==null&&data.remaining!==lastRemaining;if(lastRemaining>0&&data.remaining===0)completionTone();lastRemaining=data.remaining;clock.textContent=format(data.remaining,timerStyle.timer_format);timerState.textContent=data.running?'EN MARCHA':'PAUSADO';timerState.classList.toggle('running',data.running);clockFace.dataset.warning=data.remaining>0&&data.remaining<=Number(timerStyle.timer_warning_seconds||0)?'yes':'no';if(changed&&timerStyle.timer_digit_animation!=='none'){clock.classList.remove('timer-digit-changing');void clock.offsetWidth;clock.classList.add('timer-digit-changing');}start.disabled=data.running;pause.disabled=!data.running;}
  function showTimerError(error){timerNotice.textContent=error.message;}
  async function refreshTimer(){if(document.hidden||timer.hidden)return;try{renderTimer(await api('/interactivity'));}catch(error){showTimerError(error);}}
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
  const bankFile=el('input');bankFile.type='file';bankFile.accept='image/png,image/jpeg,image/webp';bankFile.setAttribute('aria-label','Imagen de alcancía PNG, JPEG o WebP');
  let bankState={custom_bank_asset:null,bank_position:{x:50,y:50},bank_scale:100,bank_scales:Object.fromEntries(Object.keys(window.PiggyBank.models).map(key=>[key,100])),entry_point:{x:50,y:16}};
  let bankStateRevision=0;
  function hydrateBankState(data){const d=data?.drop||{},bank=d.bank||'cochito',scales=Object.fromEntries(Object.keys(window.PiggyBank.models).map(key=>{const value=Number(d.bank_scales?.[key]);return [key,Number.isFinite(value)&&value>=25&&value<=200?value:100]}));if(!d.bank_scales?.[bank]&&Number.isFinite(Number(d.bank_scale))&&Number(d.bank_scale)>=25&&Number(d.bank_scale)<=200)scales[bank]=Number(d.bank_scale);bankState={custom_bank_asset:d.custom_bank_asset||null,bank_position:{x:Number.isFinite(Number(d.bank_position?.x))?Number(d.bank_position.x):50,y:Number.isFinite(Number(d.bank_position?.y))?Number(d.bank_position.y):50},bank_scale:scales[bank]??100,bank_scales:scales,entry_point:{x:Number.isFinite(Number(d.entry_point?.x))?Number(d.entry_point.x):50,y:Number.isFinite(Number(d.entry_point?.y))?Number(d.entry_point.y):16}};return bankState;}
  function publishBankHydration(){const detail={bank:bankSelect.value,customBankAsset:bankState.custom_bank_asset,bankPosition:{...bankState.bank_position},bankScale:bankState.bank_scale,bankScales:{...bankState.bank_scales},entryPoint:{...bankState.entry_point}};window.__pointDropBankHydration=detail;window.dispatchEvent(new CustomEvent('point-drop-bank-hydrated',{detail}));}
  function applyInitialBankState(data,revisionAtStart=bankStateRevision){if(revisionAtStart!==bankStateRevision)return;const d=data.drop;bankSelect.value=d.bank||'cochito';bankState=hydrateBankState(data);window.PiggyBank.prepare(piggy,bankSelect.value,d);publishBankHydration();}
  function acceptBankEditorState(next){bankStateRevision++;bankState={custom_bank_asset:next.custom_bank_asset,bank_position:next.bank_position,bank_scale:next.bank_scale,bank_scales:{...bankState.bank_scales,...next.bank_scales},entry_point:next.entry_point};if(bankSelect.value)bankState.bank_scales[bankSelect.value]=bankState.bank_scale;window.PiggyBank.prepare(piggy,bankSelect.value,bankState);}
  window.addEventListener('point-drop-bank-state',event=>acceptBankEditorState(event.detail));
  const speedLabel=el('span');const updateSpeedLabel=()=>{speedLabel.textContent=`Duración de caída: ${Number(dropSpeed.value).toFixed(1)} s · más tiempo = más lento`;};dropSpeed.addEventListener('input',updateSpeedLabel);updateSpeedLabel();
  const configNote=el('small','Configura cómo se verá la caída.','config-note'),dropActionButtons=[];
  let dropActionBusy=false;
  async function runDropAction(pending,action){
    if(dropActionBusy){configNote.textContent='Espera a que termine la acción actual.';return;}
    dropActionBusy=true;configNote.textContent=pending;
    for(const control of [...dropActionButtons,dropTitle,dropSpeed,dropSize,dropDensity,dropShow,bankSelect,bankFile])control.disabled=true;
    try{configNote.textContent=await action();}
    catch(error){configNote.textContent=error.message==='Emisión silenciada'?'Activa la emisión para lanzar regalos.':error.message;}
    finally{dropActionBusy=false;for(const control of [...dropActionButtons,dropTitle,dropSpeed,dropSize,dropDensity,dropShow,bankSelect,bankFile])control.disabled=false;}
  }
  function dropAction(text,pending,action,className=''){
    const control=button(text,()=>runDropAction(pending,action),className);dropActionButtons.push(control);return control;
  }
  async function saveDrop(){const revision=++bankStateRevision,bank=bankSelect.value,scales={...bankState.bank_scales},scale=scales[bank]??bankState.bank_scale;scales[bank]=scale;const payload={game:'drop',action:'configure',title:dropTitle.value,bank,speed:Number(dropSpeed.value),size:Number(dropSize.value),density:Number(dropDensity.value),show_score:dropShow.checked,...bankState,bank_scale:scale,bank_scales:scales};const data=await overlayCall(payload);dropDensity.value=data.drop.density;if(revision===bankStateRevision){bankSelect.value=data.drop.bank||bank;hydrateBankState(data);publishBankHydration();}return data}
  let sizeTimer, sizePending=false, sizeSending=false;
  async function publishSize(){
    if(sizeSending)return;sizeSending=true;
    try{await runDropAction('Actualizando tamaño…',async()=>{while(sizePending){sizePending=false;await overlayCall({game:'drop',action:'configure',size:Number(dropSize.value)});}return 'Tamaño actualizado.';});}
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
  bankSelect.onchange=()=>runDropAction('Guardando tipo de alcancía…',async()=>{const data=await saveDrop();window.PiggyBank.prepare(piggy,bankSelect.value,data.drop);notifyDropPreview();return 'Tipo de alcancía actualizado.';});
  const uploadBank=dropAction('Subir imagen','Subiendo imagen…',async()=>{
    const file=bankFile.files?.[0];if(!file)throw Error('Selecciona una imagen antes de subirla.');
    const form=new FormData();form.append('file',file);
    const response=await fetch('/interactivity/bank-assets',{method:'POST',body:form,signal:AbortSignal.timeout(15000)});
    const result=await response.json();if(!response.ok)throw Error(result.error||'No se pudo subir la imagen.');
    bankState.custom_bank_asset=result.asset_id;bankSelect.value='custom';
    const data=await saveDrop();window.PiggyBank.prepare(piggy,'custom',data.drop);notifyDropPreview();bankFile.value='';return 'Imagen personalizada guardada.';
  });
  function notifyDropPreview(){const preview=document.getElementById('overlay-preview');if(!preview?.contentWindow)return;try{const url=new URL(preview.src,location.href);if(url.pathname==='/widget/point-drop'&&url.searchParams.has('editor'))preview.contentWindow.postMessage({type:'widget-point-drop-refresh'},location.origin);}catch(_){}}
  async function launch(){const data=await overlayCall({game:'drop',action:'launch'});total=data.drop.score;score.textContent=total;showDeposit(data.drop,data.drop.event);notifyDropPreview();}
  arena.append(el('span','PUNTOS'),score,piggy);
  dropPanel.append(el('p','Cada activación deposita un regalo en la alcancía.'),labeled('Tipo de alcancía',bankSelect),labeled('Imagen PNG, JPEG o WebP',bankFile),uploadBank,labeled('Título del overlay',dropTitle),(()=>{const label=el('label');label.append(speedLabel,dropSpeed);return label;})(),labeled('Tamaño de regalos',dropSize),labeled('Cantidad por lluvia',dropDensity),labeled('Mostrar marcador',dropShow),dropAction('Guardar configuración','Guardando configuración…',async()=>{await saveDrop();notifyDropPreview();return 'Configuración guardada.';}),dropAction('Soltar rosa de ejemplo','Enviando rosa de ejemplo…',async()=>{await saveDrop();await launch();return 'Rosa de ejemplo enviada a la alcancía.';},'primary'),dropAction('Lluvia en directo','Iniciando lluvia…',async()=>{await saveDrop();const count=Number(dropDensity.value);for(let i=0;i<count;i++){if(i)await new Promise(resolve=>setTimeout(resolve,420));await launch();}return `Lluvia completada: ${count} regalos.`;}),dropAction('Vaciar alcancía','Vaciando alcancía…',async()=>{await overlayCall({game:'drop',action:'reset'});total=0;settledCoins=0;score.textContent='0';arena.querySelectorAll('.drop-token').forEach(x=>x.remove());notifyDropPreview();return 'Alcancía vacía y marcador reiniciado.';}),configNote);
  dropLayout.append(arena,dropPanel);drop.append(dropLayout);overlayLink(drop,'point-drop');
  const initialBankRevision=bankStateRevision;
  overlayCall().then(data=>{const d=data.drop;total=d.score;score.textContent=total;dropTitle.value=d.title==='LLUVIA DE DONACIONES'?'LLUVIA DE PUNTOS':d.title;applyInitialBankState(data,initialBankRevision);dropSpeed.value=d.speed;updateSpeedLabel();dropSize.value=d.size;dropDensity.value=d.density;dropShow.checked=d.show_score}).catch(()=>{});
  let gamesBusy=false;
  async function syncGames(){
    if(document.hidden||(wheel.hidden&&drop.hidden))return;
    if(gamesBusy)return;gamesBusy=true;const bankRevisionAtStart=bankStateRevision;
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
      if(!dropActionBusy&&document.activeElement!==bankSelect&&bankRevisionAtStart===bankStateRevision){bankSelect.value=d.bank||'cochito';bankState=hydrateBankState(data);window.PiggyBank.prepare(piggy,bankSelect.value,d);publishBankHydration();}
      total=d.score;score.textContent=total;
      if(!sizePending&&!sizeSending){window.PiggyBank.setSize(piggy,d.size);if(document.activeElement!==dropSize)dropSize.value=d.size;}
      if(!total){arena.querySelectorAll('.drop-token').forEach(x=>x.remove());settledCoins=0;}
      for(const event of d.events||[]){if(Date.now()/1000-event.at<15)showDeposit(d,event);}
    }catch(error){configNote.textContent=error.message;}finally{gamesBusy=false;}
  }
  setInterval(syncGames,1000);
  window.addEventListener('tikreader:navigation-change',()=>{refreshTimer();syncGames();});
  window.OverlayGallery?.registerGameControls('timer',timer);
  window.OverlayGallery?.registerGameControls('fortune-wheel',wheel);
  window.OverlayGallery?.registerGameControls('point-drop',drop);

})();
