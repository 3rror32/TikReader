(()=>{
 const root=document.getElementById('scene');let scene=null;
 const fit=()=>{if(scene)root.style.transform=`scale(${Math.min(innerWidth/scene.width,innerHeight/scene.height)})`};addEventListener('resize',fit);
 async function poll(){try{
  const response=await fetch('/broadcast/scene/'+encodeURIComponent(root.dataset.sceneId),{cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Escena no disponible');const data=await response.json();
  if(data.muted){root.replaceChildren();return}scene=data.scene;SceneRenderer.render(root,scene);fit();
 }catch(_){root.replaceChildren()}finally{setTimeout(poll,1500)}}poll();
})();
