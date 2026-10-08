window.AlertRenderer = (() => {
  let audioContext;
  function sound(template) {
    const volume=Math.max(0,Math.min(1,(Number(template.volume)||0)/100));
    if(!volume||!template.sound||template.sound==='none')return null;
    if(template.sound==='custom'){
      if(!/^[a-f0-9]{32}\.(mp3|wav)$/.test(template.sound_asset||''))return null;
      const audio=new Audio('/broadcast/alert-media/'+encodeURIComponent(template.sound_asset));
      audio.volume=volume;audio.play().catch(()=>{});return {stop(){audio.pause();audio.currentTime=0;}};
    }
    try{
      audioContext ||= new (window.AudioContext||window.webkitAudioContext)();audioContext.resume();
      const now=audioContext.currentTime,gain=audioContext.createGain();gain.gain.setValueAtTime(Math.max(.001,.13*volume),now);gain.gain.exponentialRampToValueAtTime(.001,now+.55);gain.connect(audioContext.destination);
      const frequencies=template.sound==='sparkle'?[880,1175,1568]:[660,880];
      const oscillators=frequencies.map((frequency,index)=>{const oscillator=audioContext.createOscillator();oscillator.frequency.value=frequency;oscillator.type=template.sound==='sparkle'?'sine':'triangle';oscillator.connect(gain);oscillator.start(now+index*.1);oscillator.stop(now+.5);return oscillator;});
      return {stop(){for(const oscillator of oscillators)try{oscillator.stop();}catch(_){}}};
    }catch(_){return null;}
  }
  function render(container, template, text, options={}) {
    const stage=document.createElement('div');stage.className='alert-stage';stage.dataset.position=template.position;stage.dataset.motion=template.motion||'full';
    const card=document.createElement('div');card.className='alert-visual alert-enter';card.dataset.enter=template.enter_animation||template.animation||'pop';card.dataset.idle=template.idle_animation||'none';card.dataset.exit=template.exit_animation||'fade';
    card.style.setProperty('--alert-color',template.color);card.style.setProperty('--alert-size',template.size+'px');
    let video;
    if(template.asset&&/^[a-f0-9]{32}\.(png|jpg|gif|webp|mp4|webm)$/.test(template.asset)){
      const media=document.createElement(/\.(mp4|webm)$/.test(template.asset)?'video':'img');
      media.src='/broadcast/alert-media/'+encodeURIComponent(template.asset);media.className='alert-media';
      if(media.tagName==='VIDEO'){video=media;video.muted=!template.video_audio;video.volume=Math.max(0,Math.min(1,(Number(template.volume)||0)/100));video.playsInline=true;video.loop=true;}
      else media.alt='Imagen de la alerta';
      media.onerror=()=>{const error=document.createElement('p');error.className='alert-media-error';error.textContent='No se pudo cargar el archivo';media.replaceWith(error);};card.append(media);
    }
    const caption=document.createElement('p');caption.className='alert-caption';caption.textContent=text||'';card.append(caption);stage.append(card);container.replaceChildren(stage);
    void card.offsetWidth;
    const duration=Math.max(2,Math.min(30,Number(template.duration)||5))*1000,exitDuration=650;
    let finish,finished=false,exitTimer;const done=new Promise(resolve=>finish=resolve);
    const settle=()=>card.classList.remove('alert-enter');card.addEventListener('animationend',settle,{once:true});const settleTimer=setTimeout(settle,900);
    const alertSound=options.audio===false?null:sound(template);
    const remove=()=>{if(finished)return;finished=true;clearTimeout(exitTimer);clearTimeout(settleTimer);video?.pause();alertSound?.stop?.();stage.remove();finish();};
    const beginExit=()=>{if(finished||card.classList.contains('alert-exit'))return;card.classList.remove('alert-enter');card.classList.add('alert-exit');if(card.dataset.exit==='none')remove();else exitTimer=setTimeout(remove,exitDuration);};
    const stop=()=>{clearTimeout(timer);remove();};
    const timer=setTimeout(beginExit,Math.max(800,duration-exitDuration));
    video?.play().catch(()=>{const error=document.createElement('p');error.textContent='Video bloqueado por el navegador';card.append(error);});
    return {done,cancel:stop};
  }
  function sample(template,user='Participante de ejemplo',gift='Regalo de ejemplo',count=1){const labels={gift:'Regalo',like:'Likes',follow:'Nuevo seguidor',share:'LIVE compartido',subscribe:'Nueva suscripción'},values={usuario:user,regalo:gift,cantidad:count,diamantes:Number(template.diamonds)||0,evento:labels[template.trigger]||'Evento'};return template.text.replace(/\{(usuario|regalo|cantidad|diamantes|evento)\}/g,(_,key)=>String(values[key]));}
  return {render,sample};
})();
