/* Keep the existing voice tab alive while preparing scenes and community. */
(()=>{
 const pane=document.createElement('section');pane.dataset.section='creator-suite';pane.className='studio-pane';pane.style.cssText='padding:0;min-height:75vh';
 const frame=document.createElement('iframe');frame.title='Estudio, comunidad y calendario de TikReader';frame.style.cssText='display:block;width:100%;height:calc(100vh - 115px);min-height:550px;border:0;border-radius:12px';pane.append(frame);document.querySelector('.app').append(pane);
 const syncTheme=()=>frame.contentWindow?.postMessage({type:'creator-theme',skin:document.documentElement.dataset.skin||'original'},location.origin);
 frame.addEventListener('load',syncTheme);
 addEventListener('tikreader:skin',syncTheme);
 let target='scenes';
 window.CreatorBridge={open(tab='scenes'){target=tab;if(!frame.getAttribute('src'))frame.src='/creator#'+tab;else frame.contentWindow.postMessage({type:'creator-tab',tab},location.origin)}};
 addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==frame.contentWindow)return;
  if(event.data?.type==='creator-open')window.Shell?.show(event.data.section);
  if(event.data?.type==='creator-rules-changed')window.dispatchEvent(new Event('tikreader:rules-changed'));
 });
 const section=document.querySelector('[data-section="overlay-gallery"]');
 if(section){const button=document.createElement('button');button.textContent='Abrir editor de escenas';button.type='button';button.style.cssText='margin:10px 0 18px';button.onclick=()=>window.Shell?.show('creator-scenes');section.prepend(button)}
 const notified=new Set();
 async function reminders(){try{
  const response=await fetch('/creator-api/calendar',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok)return;const data=await response.json(),now=Date.now()/1000;
  for(const e of Object.values(data.items)){const key=e.id+':'+e.start+':'+e.remind;if(now<e.start-e.remind*60||now>e.start+e.duration*60||notified.has(key))continue;notified.add(key);
   const container=document.getElementById('toast-container');if(!container)continue;
   const box=document.createElement('div');box.setAttribute('role','status');box.style.cssText='background:var(--skin-surface);color:var(--skin-text);border:1px solid var(--skin-accent);border-radius:12px;padding:16px;margin:8px;max-width:350px;pointer-events:auto';
   const text=document.createElement('p');text.textContent='Recordatorio: '+e.title+' · '+new Date(e.start*1000).toLocaleTimeString();const open=document.createElement('button');open.textContent='Ver calendario';open.onclick=()=>{window.Shell?.show('creator-calendar');box.remove()};const close=document.createElement('button');close.textContent='Cerrar';close.onclick=()=>box.remove();box.append(text,open,close);container.append(box);
  }
 }catch(_){}finally{setTimeout(reminders,60000)}}setTimeout(reminders,15000);
})();
