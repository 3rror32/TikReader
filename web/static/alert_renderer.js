window.AlertRenderer = (() => {
  function render(container, template, text) {
    const stage=document.createElement('div');stage.className='alert-stage';stage.dataset.position=template.position;stage.dataset.motion=template.motion||'full';
    const card=document.createElement('div');card.className='alert-visual alert-enter';card.dataset.enter=template.enter_animation||template.animation||'pop';card.dataset.idle=template.idle_animation||'none';card.dataset.exit=template.exit_animation||'fade';
    card.style.setProperty('--alert-color',template.color);card.style.setProperty('--alert-size',template.size+'px');
    let video;
    if(template.asset&&/^[a-f0-9]{32}\.(png|jpg|gif|webp|mp4|webm)$/.test(template.asset)){
      const media=document.createElement(/\.(mp4|webm)$/.test(template.asset)?'video':'img');
      media.src='/broadcast/alert-media/'+encodeURIComponent(template.asset);media.className='alert-media';
      if(media.tagName==='VIDEO'){video=media;video.muted=true;video.playsInline=true;video.loop=true;}
      else media.alt='Imagen de la alerta';
      media.onerror=()=>{const error=document.createElement('p');error.className='alert-media-error';error.textContent='No se pudo cargar el archivo';media.replaceWith(error);};card.append(media);
    }
    const caption=document.createElement('p');caption.className='alert-caption';caption.textContent=text||'';card.append(caption);stage.append(card);container.replaceChildren(stage);
    void card.offsetWidth;
    const duration=Math.max(2,Math.min(30,Number(template.duration)||5))*1000,exitDuration=650;
    let finish,finished=false,exitTimer;const done=new Promise(resolve=>finish=resolve);
    const settle=()=>card.classList.remove('alert-enter');card.addEventListener('animationend',settle,{once:true});const settleTimer=setTimeout(settle,900);
    const remove=()=>{if(finished)return;finished=true;clearTimeout(exitTimer);clearTimeout(settleTimer);video?.pause();stage.remove();finish();};
    const beginExit=()=>{if(finished||card.classList.contains('alert-exit'))return;card.classList.remove('alert-enter');card.classList.add('alert-exit');if(card.dataset.exit==='none')remove();else exitTimer=setTimeout(remove,exitDuration);};
    const stop=()=>{clearTimeout(timer);remove();};
    const timer=setTimeout(beginExit,Math.max(800,duration-exitDuration));
    video?.play().catch(()=>{const error=document.createElement('p');error.textContent='Video bloqueado por el navegador';card.append(error);});
    return {done,cancel:stop};
  }
  function sample(template,user='Participante de ejemplo',gift='Regalo de ejemplo',count=1){const values={usuario:user,regalo:gift,cantidad:count};return template.text.replace(/\{(usuario|regalo|cantidad)\}/g,(_,key)=>String(values[key]));}
  return {render,sample};
})();
