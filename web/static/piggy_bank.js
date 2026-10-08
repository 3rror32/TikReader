(() => {
  const markup = `<img class="piggy-custom-image" alt="" aria-hidden="true"><div class="piggy-fill" aria-hidden="true"></div><img class="piggy-glass" src="/static/piggy-bank-glass.png" alt="Alcancía de cochito de cristal"><span class="piggy-slot" aria-hidden="true"></span>`;
  const models={
    cochito:{label:'Cochito',src:'/static/piggy-bank-glass.png',area:[0,0,0,100],slot:[44,16]},
    cochita:{label:'Cochita',src:'/static/banks/cochita.png?v=2',area:[0,0,0,100],slot:[40,23]},
    pato:{label:'Pato',src:'/static/banks/pato.png',area:[0,0,0,100],slot:[46,40]},
    oso:{label:'Oso',src:'/static/banks/oso.png',area:[0,0,0,100],slot:[54,41]},
    perro:{label:'Perro',src:'/static/banks/perro.png',area:[0,0,0,100],slot:[53,41]},
    gato:{label:'Gato',src:'/static/banks/gato.png',area:[0,0,0,100],slot:[55,41]},
    custom:{label:'Personalizada',src:'',area:[0,0,0,100],slot:[50,16]}
  };
  let customShapes={};
  const shapeFor=key=>customShapes[key]||{points:window.BankShapes[key]||window.BankShapes.cochito,slot:models[key].slot};
  const assetId=value=>typeof value==='string'&&/^[a-f0-9]{32}\.(?:png|jpg|webp)$/.test(value)&&!/[\r\n]/.test(value);
  const percent=(value,fallback)=>Number.isFinite(Number(value))&&Number(value)>=0&&Number(value)<=100?Number(value):fallback;
  const contourFor=(key,w,h)=>(shapeFor(key).points||[]).map(([x,y])=>[x*w/100,y*h/100]);
  function fitWorld(world,key,w,h){world.width=w;world.height=h;world.contour=contourFor(key,w,h);if(!world.contour.length)delete world.contour;}
  const glassImages=new Map();
  const customImageSizes=new Map();
  function prepare(pig,key='cochito',options={}) {
    const custom=key==='custom'&&assetId(options.custom_bank_asset);
    key=custom?'custom':Object.hasOwn(models,key)&&key!=='custom'?key:'cochito';
    const shape=shapeFor(key),revision=JSON.stringify(shape);
    const position={x:percent(options.bank_position?.x,50),y:percent(options.bank_position?.y,50)};
    const entry={x:percent(options.entry_point?.x,shape.slot[0]),y:percent(options.entry_point?.y,shape.slot[1])};
    const scale=Number.isFinite(Number(options.bank_scale))&&Number(options.bank_scale)>=25&&Number(options.bank_scale)<=200?Number(options.bank_scale):100;
    const customRevision=custom?JSON.stringify([options.custom_bank_asset,position,entry,scale]):'';
    if(pig.dataset.bank===key&&pig.dataset.shape===revision&&pig.dataset.bankScale===String(scale)&&pig.dataset.customRevision===customRevision)return;
    pig.dataset.shape=revision;
    pig.dataset.bank=key;pig.dataset.customRevision=customRevision;const model=models[key];
    pig.classList.toggle('is-custom-bank',custom);
    const customImage=pig.querySelector('.piggy-custom-image'),selectedImage=pig.querySelector('.piggy-glass');
    if(custom){
      pig.dataset.customAsset=options.custom_bank_asset;
      customImage.style.display='block';
      selectedImage.style.display='none';
      const src=`/broadcast/bank-assets/${options.custom_bank_asset}`;
      if(customImage.dataset.asset!==options.custom_bank_asset){
        customImage.dataset.asset=options.custom_bank_asset;
        customImage.onload=()=>{
          if(customImage.dataset.asset!==options.custom_bank_asset||pig.dataset.bank!=='custom'||pig.dataset.customAsset!==options.custom_bank_asset)return;
          if(customImage.naturalWidth&&customImage.naturalHeight){
            const dimensions=[customImage.naturalWidth,customImage.naturalHeight];
            customImageSizes.set(options.custom_bank_asset,dimensions);
            pig.style.setProperty('aspect-ratio',`${dimensions[0]} / ${dimensions[1]}`,'important');
          }
        };
        customImage.onerror=()=>{if(customImage.dataset.asset===options.custom_bank_asset)customImage.style.display='none';};
        customImage.src=src;
      }
      const dimensions=customImageSizes.get(options.custom_bank_asset)||
        (customImage.dataset.asset===options.custom_bank_asset&&customImage.naturalWidth&&customImage.naturalHeight?[customImage.naturalWidth,customImage.naturalHeight]:null);
      pig.style.setProperty('aspect-ratio',dimensions?`${dimensions[0]} / ${dimensions[1]}`:'1 / 1','important');
      pig.dataset.bankScale=String(scale);
      pig.style.setProperty('left',`${position.x}%`,'important');pig.style.setProperty('top',`${position.y}%`,'important');
      pig.style.setProperty('bottom','auto','important');pig.style.setProperty('width','min(82vw,720px)','important');
      pig.style.setProperty('transform',`translate(-50%, -50%) scale(${scale/100})`,'important');
      ['left','right','bottom','height'].forEach(part=>pig.style.removeProperty(`--bank-${part}`));
    }else{
      pig.dataset.customAsset='';
      customImage.style.display='none';selectedImage.style.removeProperty('display');
      ['left','top','bottom','width','aspect-ratio'].forEach(part=>pig.style.removeProperty(part));
      pig.dataset.bankScale=String(scale);
      pig.style.setProperty('transform',`translateX(-50%) scale(${scale/100})`,'important');
    }
    pig.querySelector('.piggy-fill').style.clipPath='polygon('+shape.points.map(p=>p.join('% ')+'%').join(',')+')';
    pig.classList.toggle('bank-variant',key!=='cochito');
    ['left','right','bottom','height'].forEach((part,i)=>pig.style.setProperty('--bank-'+part,model.area[i]+'%'));
    if(custom){
      const fill=pig.querySelector('.piggy-fill');
      ['left','right','bottom','height'].forEach((part,index)=>fill.style.setProperty(part,['0%','0%','0%','100%'][index],'important'));
      const slot=pig.querySelector('.piggy-slot');slot.style.setProperty('left',`${entry.x}%`,'important');slot.style.setProperty('top',`${entry.y}%`,'important');
      slot.style.setProperty('width','14%','important');
    }else{
      const fill=pig.querySelector('.piggy-fill'),slot=pig.querySelector('.piggy-slot');
      ['left','right','bottom','height'].forEach(part=>fill.style.removeProperty(part));
      ['left','top','width'].forEach(part=>slot.style.removeProperty(part));
      pig.style.setProperty('--bank-slot-x',shape.slot[0]+'%');pig.style.setProperty('--bank-slot-y',shape.slot[1]+'%');
      selectedImage.classList.remove('is-ready');selectedImage.alt='Alcancía de cristal: '+model.label;
    }
    if(!custom){
    let glassImage=glassImages.get(key);
    // The original photo has a black backdrop. Render its glass highlights
    // with alpha so gifts and the broadcast remain visible through the pig.
    glassImage ||= new Promise((resolve, reject) => {
      const source = new Image();
      source.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = source.naturalWidth;
          canvas.height = source.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(source, 0, 0);
          const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
          for (let i = 0; i < pixels.data.length; i += 4) {
            const alpha = Math.max(pixels.data[i], pixels.data[i + 1], pixels.data[i + 2]);
            pixels.data[i + 3] = alpha;
            if (alpha) for (let c = 0; c < 3; c++) pixels.data[i + c] = Math.round(pixels.data[i + c] * 255 / alpha);
          }
          ctx.putImageData(pixels, 0, 0);
          resolve(canvas.toDataURL('image/png'));
        } catch (error) { reject(error); }
      };
      source.onerror = reject;
      source.src = model.src;
    });
    glassImages.set(key,glassImage);
    const img = selectedImage;
    glassImage.then(src => {if(pig.dataset.bank!==key)return;img.src = src; img.classList.add('is-ready');})
      .catch(() => {if(pig.dataset.bank!==key)return;img.src=model.src;img.style.mixBlendMode='screen';img.classList.add('is-ready');});
    }
    requestAnimationFrame(()=>{
      const fill=pig.querySelector('.piggy-fill'),world=piles.get(fill);
      if(!world||!world.width||!world.height||!fill.clientWidth)return;
      const w=fill.clientWidth,h=fill.clientHeight;
      for(const b of world.bodies){b.x*=w/world.width;b.y*=h/world.height;b.node.style.transform=`translate(${b.x-b.size/2}px,${b.y-b.size/2}px) rotate(${b.angle}deg)`;}
      fitWorld(world,key,w,h);for(const b of world.bodies)window.PiggyPhysics.contain(world,b);
    });
  }
  let catalog, catalogAt=0;
  const giftName = name => /^(rosa|rose)$/i.test(String(name||'').trim()) ? 'rose' : String(name||'').trim().toLowerCase();
  function loadCatalog() {
    if (!catalog || Date.now()-catalogAt>60000) {
      catalogAt=Date.now();
      catalog=fetch('/gift-catalog').then(r=>r.ok?r.json():{gifts:[]}).then(d=>d.gifts||[]).catch(()=>[]);
    }
    return catalog;
  }
  function paintGift(token,event={}) {
    token.classList.add('gift-token');
    const id=String(event.gift_id||'');
    const name=event.gift||(id||event.image_url?'Regalo':'Rosa');
    const isRose=id? id==='5655'||id==='observed:rose' : giftName(name)==='rose';
    token.setAttribute('aria-label',name);
    // Keep gifts visible while artwork loads, including offline broadcasts.
    const fallback=document.createElement('span');fallback.textContent=isRose?'🌹':'🎁';fallback.setAttribute('aria-hidden','true');token.append(fallback);
    const show = src => new Promise(resolve=>{
      if(typeof src!=='string'||!(/^(https?:\/\/|\/static\/)/.test(src))){resolve(false);return;}
      const img=document.createElement('img');img.alt=name;img.referrerPolicy='no-referrer';
      img.onload=()=>{token.replaceChildren(img);resolve(true);};img.onerror=()=>resolve(false);img.src=src;
    });
    (async()=>{
      if(isRose&&await show('/static/rose.png'))return;
      if(await show(event.image_url))return;
      const gifts=await loadCatalog();
      // A numeric TikTok ID is authoritative; similar names can be different gifts.
      const gift=gifts.find(g=>id&&String(g.id)===id) ||
        (!/^\d+$/.test(id)&&gifts.find(g=>giftName(g.name)===giftName(name)));
      await show(gift?.image_url);
    })();
  }
  const piles=new WeakMap();
  const giftDiameter=(size,w,h)=>Math.min(64*.66,w*.09,h*.1)*size/64;
  function setSize(pig,size){
    size=Number(size);if(!Number.isFinite(size)||size<=0)return;
    const fill=pig.querySelector('.piggy-fill'),world=piles.get(fill);
    pig.dataset.giftSize=String(size);
    if(!world)return;
    const diameter=giftDiameter(size,fill.clientWidth,fill.clientHeight);
    if(world.bodies.every(b=>b.size===diameter))return;
    for(const b of world.bodies){
      b.size=diameter;b.r=diameter*.43;
      b.node.style.width=b.node.style.height=diameter+'px';
      b.node.style.setProperty('--drop-size',diameter+'px');
      if(world.contour)window.PiggyPhysics.contain(world,b);
      b.node.style.transform=`translate(${b.x-b.size/2}px,${b.y-b.size/2}px) rotate(${b.angle}deg)`;
    }
    world.activeUntil=performance.now()+7000/(world.timeScale||.19);
    if(!world.frame&&world.tick){world.last=0;world.frame=requestAnimationFrame(world.tick);}
  }
  function settle(token,event,pig) {
    token.getAnimations().forEach(a=>a.cancel());
    const fill=pig.querySelector('.piggy-fill');
    let world=piles.get(fill);
    if(!world){world={bodies:[],width:fill.clientWidth,height:fill.clientHeight,frame:0,last:0,carry:0,activeUntil:0};piles.set(fill,world);}
    fitWorld(world,pig.dataset.bank||'cochito',fill.clientWidth,fill.clientHeight);
    world.bodies=world.bodies.filter(b=>b.node.parentNode===fill);
    const size=Number(pig.dataset.giftSize)||parseFloat(token.style.width)||48;
    const diameter=giftDiameter(size,world.width,world.height);
    const r=diameter*.43;
    const slot=pig.querySelector('.piggy-slot').getBoundingClientRect(),rect=fill.getBoundingClientRect();
    const transformScale=Math.max(.25,Math.min(2,Number(pig.dataset.bankScale)/100||1));
    const x=Math.max(r,Math.min(world.width-r,(slot.left+slot.width/2-rect.left)/transformScale));
    const b={node:token,id:event.id,x,y:(slot.top-rect.top)/transformScale+r,r,size:diameter,vx:(Math.random()-.5)*60,vy:12,angle:Math.random()*80-40,spin:matchMedia('(prefers-reduced-motion: reduce)').matches?0:(Math.random()-.5)*90};
    token.classList.add('settled');
    Object.assign(token.style,{left:'0',top:'0',bottom:'auto',width:diameter+'px',height:diameter+'px',opacity:'1'});
    token.style.setProperty('--drop-size',diameter+'px');fill.append(token);world.bodies.push(b);
    // Capacity follows the actual cavity and gift size, rather than 40 tokens.
    const area=world.contour?window.PiggyPhysics.polygonArea(world.contour):world.width*world.height;
    const capacity=Math.max(40,Math.min(220,Math.floor(area*.76/(Math.PI*r*r))));
    while(world.bodies.length>capacity)world.bodies.shift().node.remove();
    if(world.contour)window.PiggyPhysics.contain(world,b);
    // Keep the interior motion at the same pace as the selected fall duration.
    world.timeScale=Math.max(.05,Math.min(.28,.8/(Number(token.dataset.fallSeconds)||4.2)));
    world.activeUntil=performance.now()+7000/world.timeScale;
    const render=()=>world.bodies.forEach(b=>b.node.style.transform=`translate(${b.x-b.size/2}px,${b.y-b.size/2}px) rotate(${b.angle}deg)`);
    render();
    if(world.frame)return;
    world.last=0;
    const tick=now=>{
      world.frame=0;
      world.bodies=world.bodies.filter(b=>b.node.parentNode===fill);
      if(!fill.isConnected||!world.bodies.length)return;
      const w=fill.clientWidth,h=fill.clientHeight;
      if(w!==world.width||h!==world.height){
        for(const body of world.bodies){body.x*=w/world.width;body.y*=h/world.height;}
        fitWorld(world,pig.dataset.bank||'cochito',w,h);for(const b of world.bodies)window.PiggyPhysics.contain(world,b);
      }
      world.carry+=(world.last?Math.min(.05,(now-world.last)/1000):1/60)*world.timeScale;world.last=now;
      while(world.carry>=1/120){window.PiggyPhysics.step(world,1/120);world.carry-=1/120;}
      render();
      if(pig.dataset.epoch&&now-(world.savedAt||0)>1000){
        world.savedAt=now;
        try{localStorage.setItem('tikreader.bank-positions',JSON.stringify({epoch:pig.dataset.epoch,bank:pig.dataset.bank,shape:pig.dataset.shape,bodies:world.bodies.map(b=>({id:b.id,x:b.x/w,y:b.y/h,angle:b.angle}))}));}catch(_){}
      }
      if(now<world.activeUntil)world.frame=requestAnimationFrame(tick);
    };
    world.tick=tick;world.frame=requestAnimationFrame(tick);
  }
  function drop({token,stage,pig,slot,event={},duration,onDeposit}) {
    const size=token.getBoundingClientRect().width,stageRect=stage.getBoundingClientRect();
    const slotRect=slot.getBoundingClientRect(),fill=pig.querySelector('.piggy-fill');
    const drift=Number(event.drift)||0, x=slotRect.left-stageRect.left+slotRect.width/2-size/2;
    const entry=slotRect.top-stageRect.top, slotY=slotRect.top-stageRect.top-size/2;
    const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isRose=event.gift_id?['5655','observed:rose'].includes(String(event.gift_id)):giftName(event.gift)==='rose';
    const bankScale=Math.max(.25,Math.min(2,Number(pig.dataset.bankScale)/100||1));
    const scale=giftDiameter(size,fill.clientWidth,fill.clientHeight)/size*bankScale;
    const angle=reduced?0:Math.random()*80-40;
    const fallMs=reduced&&isRose?320:Math.max(1500,Math.min(12000,Number(duration)||4200));
    token.classList.toggle('rose-drop',isRose&&!reduced);
    if(isRose&&!reduced)token.style.setProperty('--rose-flight',`${fallMs}ms`);
    token.dataset.fallSeconds=String(fallMs/1000);
    token.style.left=token.style.top='0';
    // Fixed half-second acceleration/deceleration; only the cruise changes
    // with the duration. Integrating velocity avoids a jump between phases.
    const easeMs=reduced&&isRose?Math.min(500,fallMs*.2):500, travelTime=fallMs-easeMs;
    const progressAt=t=>t<easeMs ? t*t/(2*easeMs*travelTime)
      : t>fallMs-easeMs ? 1-(fallMs-t)**2/(2*easeMs*travelTime)
      : (t-easeMs/2)/travelTime;
    const path=[
      {p:0,x:x+drift,y:-size,a:reduced?0:angle-70,s:1},
      {p:.2,x:x+drift*.8,y:slotY*.12,a:reduced?0:angle-45,s:1},
      {p:.8,x,y:slotY,a:angle,s:scale},
      {p:1,x,y:entry-size/2+size*scale*.43,a:reduced?0:angle+10,s:scale}
    ];
    const times=new Set([0,easeMs,fallMs-easeMs,fallMs]);
    for(let t=1000/60;t<fallMs;t+=1000/60)times.add(t);
    const frames=[...times].sort((a,b)=>a-b).map(t=>{
      const p=progressAt(t),end=path.findIndex(point=>point.p>=p);
      const b=path[Math.max(1,end)],a=path[Math.max(1,end)-1];
      const fraction=(p-a.p)/(b.p-a.p),lerp=key=>a[key]+(b[key]-a[key])*fraction;
      const x=isRose&&!reduced?lerp('x')+Math.sin(p*Math.PI*2)*size*.18:lerp('x');
      const y=isRose&&!reduced?lerp('y')-Math.sin(p*Math.PI)*size*.72:lerp('y');
      const angle=isRose&&!reduced?lerp('a')+Math.sin(p*Math.PI*2)*18:lerp('a');
      return {transform:`translate(${x}px,${y}px) rotate(${angle}deg) scale(${lerp('s')})`,
        opacity:Math.min(1,t/easeMs),offset:t/fallMs};
    });
    const motion=token.animate(frames,{duration:fallMs,easing:'linear',fill:'forwards'});
    motion.onfinish=()=>{if(token.isConnected)onDeposit?.();};
    motion.finished.catch(()=>{});
    return motion;
  }
  function restoreContents(pig,events,size,epoch){
    pig.dataset.giftSize=String(size);
    pig.dataset.epoch=epoch||'';
    const fill=pig.querySelector('.piggy-fill');
    fill.replaceChildren();
    const w=fill.clientWidth,h=fill.clientHeight;if(!w||!h)return false;
    const diameter=giftDiameter(size,w,h),r=diameter*.43;
    const world={width:w,height:h,contour:contourFor(pig.dataset.bank,w,h)},places=[];
    // Pack from the bottom up within the real outline, including the head.
    for(let y=h-r,row=0;y>r;y-=r*1.78,row++)for(let x=r+(row%2)*r;x<w-r;x+=r*2.08){
      const c=window.PiggyPhysics.contact(world,{x,y});if(c.inside&&c.distance>=r)places.push({x,y});
    }
    const saved=events.slice(-Math.min(220,places.length));
    let positions=[];
    try{const cache=JSON.parse(localStorage.getItem('tikreader.bank-positions'));if(cache?.epoch===epoch&&cache.bank===pig.dataset.bank&&cache.shape===pig.dataset.shape)positions=cache.bodies||[];}catch(_){}
    saved.forEach((event,i)=>{
      const token=document.createElement('i');token.className='overlay-drop-token drop-token';token.style.width=size+'px';
      paintGift(token,event);settle(token,event,pig);
      const pile=piles.get(fill),b=pile.bodies.at(-1);Object.assign(b,places[i],{vx:0,vy:0});
      const pose=positions.find(p=>p.id===event.id);if(pose&&[pose.x,pose.y,pose.angle].every(Number.isFinite)){b.x=pose.x*w;b.y=pose.y*h;b.angle=pose.angle;window.PiggyPhysics.contain(pile,b);}
      b.node.style.transform=`translate(${b.x-b.size/2}px,${b.y-b.size/2}px) rotate(${b.angle}deg)`;
    });
    return true;
  }
  window.PiggyBank = {markup,prepare,drop,paintGift,settle,models,shapeFor,restoreContents,setSize,giftDiameter,setShapes:shapes=>{customShapes=shapes||{};}};
})();
