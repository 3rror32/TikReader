window.OverlayCanvas=(()=>{
 const $=id=>document.getElementById(id);
 const options=[['horizontal','PC horizontal (16:9)'],['vertical','Celular vertical (9:16)']];
 let format='horizontal',target='',targetOptions={};
 function normalize(value){return value==='vertical'?'vertical':'horizontal';}
 function url(extra={}){
  if(!target)return '';
  const value=new URL(target,window.location.origin);
  if(extra.preview)value.searchParams.set('preview','1');
  return window.overlayUrl(value.href,{canvasFormat:format});
 }
 function syncLinks(){
  if(!target)return;
  const code=$('overlay-selected-url'),open=$('overlay-open'),copy=$('overlay-copy'),help=$('overlay-source-resolution');
  if(code)code.textContent=url();
  if(open)open.href=url({preview:targetOptions.preview});
  if(copy)copy.textContent='Copiar URL';
  if(help)help.textContent=format==='vertical'
   ?'TikTok LIVE Studio: activa Resolución personalizada y usa 1080 × 1920; después elige Ajustar a pantalla.'
   :'TikTok LIVE Studio: activa Resolución personalizada y usa 1920 × 1080; después elige Ajustar a pantalla.';
 }
 function setTarget(path,options={}){target=path;targetOptions=options;syncLinks();}
 function apply(value,note){
  format=normalize(value);const frame=$('overlay-preview'),screen=frame?.closest('.overlay-screen');
  if(screen){
   screen.dataset.canvasFormat=format;
   const stage=screen.closest?.('.overlay-stage')||screen.parentElement;
   if(stage)stage.dataset.canvasFormat=format;
  }
  const label=document.querySelector('.overlay-stage-bar b');
  if(label)label.textContent=(format==='vertical'?'9:16':'16:9')+' · ZONA SEGURA';
  if(note)note.textContent=format==='vertical'
   ?'En tu programa de Stream usa una fuente de navegador de 1080 × 1920.'
   :'En tu programa de Stream usa una fuente de navegador de 1920 × 1080.';
  syncLinks();
  return format;
 }
 return {options,normalize,apply,setTarget,current:()=>format,url};
})();
