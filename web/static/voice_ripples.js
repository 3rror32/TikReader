(function(root){
 'use strict';
 class Microphone {
  constructor(media,onEnd=()=>{}){this.media=media;this.onEnd=onEnd;this.generation=0;this.stream=null;this.context=null;}
  async start(device){
   this.stop();const generation=this.generation;
   const stream=await this.media.getUserMedia({audio:device?{deviceId:{exact:device}}:true});
   if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return false;}
   this.stream=stream;
   try{
    this.context=new (root.AudioContext||root.webkitAudioContext)();
    await this.context.resume();if(generation!==this.generation)return false;
    this.source=this.context.createMediaStreamSource(stream);this.analyser=this.context.createAnalyser();this.analyser.fftSize=512;
    this.source.connect(this.analyser);this.samples=new Float32Array(512);this.frequencies=new Uint8Array(this.analyser.frequencyBinCount||256);
    stream.getTracks().forEach(t=>t.onended=()=>{this.stop();this.onEnd();});return true;
   }catch(error){if(generation===this.generation)this.stop();throw error;}
  }
  level(){if(!this.analyser)return 0;this.analyser.getFloatTimeDomainData(this.samples);return Math.sqrt(this.samples.reduce((sum,x)=>sum+x*x,0)/this.samples.length);}
  bands(){if(!this.analyser?.getByteFrequencyData)return Array(16).fill(0);this.analyser.getByteFrequencyData(this.frequencies);return Array.from({length:16},(_,i)=>{const start=Math.floor((i/16)**2*this.frequencies.length),end=Math.max(start+1,Math.floor(((i+1)/16)**2*this.frequencies.length));let sum=0;for(let j=start;j<end;j++)sum+=this.frequencies[j];return sum/(end-start)/255;});}
  stop(){this.generation++;this.stream?.getTracks().forEach(t=>{t.onended=null;t.stop();});this.stream=null;this.source?.disconnect();this.source=null;this.analyser=null;this.context?.close().catch(()=>{});this.context=null;}
 }
 if(typeof module!=='undefined'){module.exports={Microphone};return;}
 const section=document.querySelector('[data-section="voice-ripples"]');if(!section)return;
 const $=id=>section.querySelector('#vr-'+id),device=document.getElementById('vr-device'),state={amplitude:0,bands:Array(16).fill(0),color:'#60d9e8',sensitivity:2,style:'ripples',intensity:1,speed:1,avatar:'🎙️'};
 let active=false,pending=false,disconnectedIntent=false,intent=0,demoUntil=0,timer,posting=false,disposed=false,published=false,stopQueued=false,settingsQueued=false;
 const status=$('status'),start=$('start'),stop=$('stop'),mic=new Microphone(navigator.mediaDevices,()=>{disconnectedIntent=active||pending;active=false;pending=false;start.disabled=false;status.textContent='El micrófono se desconectó. Selecciona otro y actívalo.';});
 const dispose=VoiceRippleRenderer.mount($('canvas'),()=>state);
 async function devices(){if(!navigator.mediaDevices?.enumerateDevices)return;const selected=device.value;try{const list=await navigator.mediaDevices.enumerateDevices();device.replaceChildren(new Option('Predeterminado de Windows',''));list.filter(x=>x.kind==='audioinput'&&x.deviceId&&x.deviceId!=='default').forEach((x,i)=>device.append(new Option(x.label||`Micrófono ${i+1}`,x.deviceId)));device.value=Array.from(device.options).some(x=>x.value===selected)?selected:'';if(device.value!==selected)device.dispatchEvent(new Event('change'));}catch(_){}}
 function settings(){const {amplitude,bands,...values}=state;return values;}
 async function send(final=false,settingsOnly=false){
  if(disposed)return;
  if(posting){if(final)stopQueued=true;if(settingsOnly)settingsQueued=true;return;}
  if(!final&&!settingsOnly&&!active&&performance.now()>=demoUntil)return;
  const payload=settingsOnly?settings():final?{...settings(),amplitude:0,bands:Array(16).fill(0)}:{...state};
  posting=true;const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),1000);
  try{const response=await fetch('/voice-ripples',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});if(!response.ok)throw Error();}
  catch(_){status.textContent='No se pudo enviar el efecto. Comprueba que TikReader siga abierto.';}
  finally{posting=false;clearTimeout(timeout);if(stopQueued){stopQueued=false;send(true);}else if(settingsQueued){settingsQueued=false;send(false,true);}}
 }
 function halt(){disconnectedIntent=false;intent++;const owned=active||performance.now()<demoUntil||published;pending=false;active=false;demoUntil=0;published=false;mic.stop();state.amplitude=0;state.bands=Array(16).fill(0);start.disabled=false;status.textContent='Detenido · el efecto se desvanece suavemente.';if(owned)send(true);}
 async function activate(switching=false){if(disposed||(!switching&&(pending||active)))return;if(!navigator.mediaDevices?.getUserMedia){status.textContent='Abre TikReader desde localhost para permitir el micrófono.';return;}disconnectedIntent=false;const current=++intent;active=false;pending=true;start.disabled=true;status.textContent=switching?'Cambiando micrófono…':'Permite el acceso al micrófono…';try{const ready=await mic.start(device.value);if(!ready||current!==intent||disposed)return;active=true;demoUntil=0;status.textContent='Escuchando · el efecto sigue tu voz.';await devices();}catch(error){if(current!==intent||disposed)return;status.textContent=error.name==='NotAllowedError'?'Acceso denegado. Permite el micrófono en el navegador y vuelve a activarlo.':'No se pudo abrir el micrófono. Comprueba que esté conectado y disponible.';}finally{if(current===intent&&!disposed){pending=false;start.disabled=active;}}}
 start.onclick=()=>activate();
 stop.onclick=halt;device.onchange=()=>{if(active||pending||disconnectedIntent)activate(true);};
 $('demo').onclick=()=>{if(pending)halt();demoUntil=performance.now()+4500;status.textContent='Prueba del efecto · 4 segundos.';};
 const descriptions={ripples:'Gotas que se expanden sobre el agua.',halo:'Un aro de energía que crece con tu voz.',particles:'Luces que la voz empuja hacia afuera.',equalizer:'Barras que siguen las frecuencias del micrófono.',silk:'Cintas fluidas que se ondulan al hablar.',smoke:'Nubes de color que se disuelven suavemente.',aura:'Un borde luminoso con el centro transparente para tu cámara.',avatar:'Tu símbolo rebota y se ilumina con la voz.',lightning:'Descargas que vibran con la intensidad de tu voz.','camera-flashes':'Flashes de fotos que aparecen en distintos puntos con tu voz.',butterflies:'Mariposas que nacen con tu voz y vuelan hacia arriba.'};
 function describe(){if($('description'))$('description').textContent=descriptions[state.style];if($('avatar-label'))$('avatar-label').hidden=state.style!=='avatar';}
 for(const key of ['color','sensitivity','style','intensity','speed','avatar'])$(''+key).oninput=e=>{if(key==='avatar'&&!e.target.value.trim())return;state[key]=['sensitivity','intensity','speed'].includes(key)?Number(e.target.value):e.target.value;describe();send(false,true);};
 describe();
 $('url').value=location.origin+'/widget/voice-ripples';$('copy').onclick=async()=>{try{await navigator.clipboard.writeText($('url').value);status.textContent='URL copiada. Agrégala como fuente de navegador en OBS.';}catch(_){$('url').select();status.textContent='Selecciona y copia la URL para OBS.';}};
 function tick(){const now=performance.now();state.amplitude=now<demoUntil?.14+Math.max(0,Math.sin(now/150))*.65:active?Math.min(1,Math.max(0,mic.level()-.008)*state.sensitivity*5):0;state.bands=now<demoUntil?Array.from({length:16},(_,i)=>Math.max(0,Math.sin(now/220+i*.7)) *state.amplitude):active?mic.bands().map(v=>Math.min(1,v*state.sensitivity)):Array(16).fill(0);$('meter').value=state.amplitude;if(active||now<demoUntil){published=true;send();}else if(published){published=false;send(true);}timer=setTimeout(tick,80);}
 devices();navigator.mediaDevices?.addEventListener('devicechange',devices);tick();
 addEventListener('pagehide',()=>{const owned=active||performance.now()<demoUntil;disposed=true;disconnectedIntent=false;intent++;pending=false;active=false;mic.stop();clearTimeout(timer);dispose();navigator.mediaDevices?.removeEventListener('devicechange',devices);if(owned)navigator.sendBeacon('/voice-ripples',new Blob([JSON.stringify({amplitude:0,bands:Array(16).fill(0)})],{type:'application/json'}));});
})(typeof window!=='undefined'?window:globalThis);
