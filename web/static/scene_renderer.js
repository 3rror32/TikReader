/* Shared keyed compositor: moving a layer never reloads its browser source. */
window.SceneRenderer={
 render(root,scene,{preview=false}={}){
  root.style.width=scene.width+'px';root.style.height=scene.height+'px';
  const ids=new Set(scene.layers.filter(l=>l.visible!==false).map(l=>l.id));
  for(const node of [...root.children])if(!ids.has(node.dataset.layer))node.remove();
  scene.layers.forEach((layer,z)=>{
   if(layer.visible===false)return;
   let node=[...root.children].find(n=>n.dataset.layer===layer.id);
   if(!node){node=document.createElement('div');node.className='scene-layer';node.dataset.layer=layer.id;root.append(node)}
   Object.assign(node.style,{left:layer.x+'px',top:layer.y+'px',width:layer.width+'px',height:layer.height+'px',opacity:layer.opacity??1,zIndex:z});
   const signature=layer.kind+':'+(layer.widget||layer.asset||'');
   if(node.dataset.signature!==signature){
    node.replaceChildren();node.dataset.signature=signature;
    if(layer.kind==='widget'){
     const frame=document.createElement('iframe');frame.title=layer.name;frame.src='/widget/'+encodeURIComponent(layer.widget)+(preview?'?preview=1':'');
     frame.addEventListener('load',()=>{try{frame.style.colorScheme=frame.contentWindow.getComputedStyle(frame.contentDocument.documentElement).colorScheme}catch(_){}});
     frame.setAttribute('sandbox','allow-scripts allow-same-origin');frame.setAttribute('allow','autoplay');node.append(frame);
    }else if(layer.kind==='media'){
     const video=/\.(mp4|webm)$/.test(layer.asset),media=document.createElement(video?'video':'img');media.src='/broadcast/alert-media/'+encodeURIComponent(layer.asset);media.style.cssText='width:100%;height:100%;object-fit:contain';
     if(video){media.muted=true;media.autoplay=true;media.loop=true;media.playsInline=true}else media.alt=layer.name;node.append(media);
    }else{node.append(document.createElement('p'))}
   }
   if(layer.kind==='text'||layer.kind==='shape'){
    Object.assign(node.style,{color:layer.color,background:layer.kind==='shape'?layer.background:'transparent',borderRadius:(layer.radius||0)+'px',fontSize:(layer.font_size||48)+'px'});
    node.querySelector('p').textContent=layer.text||'';
   }
  });
 }
};
