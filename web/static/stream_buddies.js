(()=>{
 'use strict';
 const config=JSON.parse(document.getElementById('buddies-config').textContent),stage=document.getElementById('buddies');
 const params=new URLSearchParams(location.search),preview=params.get('preview')==='1',catalog=params.has('catalog'),actors=new Map();
 const later=globalThis.setTimeout||globalThis.setInterval,clearLater=globalThis.clearTimeout||globalThis.clearInterval||(()=>{}),cancelFrame=globalThis.cancelAnimationFrame||(()=>{});
 let settings=config.settings,session=null,last=0,demoTick=0,staleAt=performance.now(),demoOrder=[],paused=document.hidden,frameId=0,pollTimer=0,demoTimer=0,livePush=false,renderedCatalog=false;
 function pool(){return config.characters.filter(c=>settings.theme==='todos'||c.theme===settings.theme);}
 function demo(){const chars=pool();if(!demoOrder.length)demoOrder=[...chars].sort(()=>Math.random()-.5);return Array.from({length:Math.min(settings.max_friends,10)},(_,i)=>({id:'demo-'+i,sprite_seed:i,character_id:demoOrder[i%demoOrder.length].id,user:['Luna','Carlos','Sofi','Alex','Dani','Milo','Nora','Leo','Ana','Max'][i],coins:Math.round((settings.coins_to_max||1000)*(1-i/10)),comment:i===demoTick%10?'¡Me encanta mi personaje! ✨':'',comment_id:'demo-'+demoTick}));}
 function draw(members,reset=false){
  stage.dataset.format=settings.canvas_format||'horizontal';
  if(reset){for(const a of actors.values())a.el.remove();actors.clear();}
  const ids=new Set(members.map(m=>m.id));for(const[id,a]of actors)if(!ids.has(id)){a.el.remove();actors.delete(id);}
  stage.style.fontFamily=settings.font;stage.style.fontSize=settings.font_size+'px';stage.style.lineHeight=settings.line_spacing/100;stage.style.letterSpacing=settings.letter_spacing+'px';
  const chars=pool();
  members.forEach((m,i)=>{
   let a=actors.get(m.id);const fresh=!a;
   if(!a){const el=document.createElement('div'),name=document.createElement('div'),art=document.createElement('div'),img=document.createElement('img'),speech=document.createElement('div');el.className='buddy';name.className='buddy-name';art.className='buddy-art';speech.className='buddy-speech';speech.hidden=true;img.alt='';art.append(img);el.append(speech,name,art);stage.append(el);a={el,name,art,img,speech,x:(i+.5)/Math.max(1,members.length)*stage.clientWidth,dir:i%2?-1:1,seen:m.comment_id,until:0,speechWidth:0,walkPhase:((m.sprite_seed||i)*.61803398875)%1,stride:.25,frames:24};actors.set(m.id,a);}
   a.el.dataset.top=String(i===0);a.name.textContent=(i===0?'♛ ':'')+m.user;a.name.hidden=!settings.show_names;
   const level=Math.min(10,Math.max(1,1+Math.floor(9*Math.max(0,m.coins)/(settings.coins_to_max||1000))));a.el.dataset.level=String(level);const size=settings.base_size+(settings.max_size-settings.base_size)*(level-1)/9;const fit=Math.min(1,stage.clientWidth*.24/settings.max_size,stage.clientHeight*.22/settings.max_size);a.size=size*fit;a.el.style.width=a.size+'px';a.art.style.width=a.size+'px';a.art.style.height=a.size+'px';
   const character=chars.find(c=>c.id===m.character_id)||chars[m.sprite_seed%chars.length];const gait=globalThis.BUDDY_WALK_METADATA?.[character.id];a.stride=gait?.stride||.25;a.frames=gait?.frames||24;a.art.dataset.anatomy=gait?.anatomy||'biped';a.img.style.width=(settings.speed>0?a.frames*100:100)+'%';const src='/static/stream-buddies/walk-v3/'+character.id+(settings.speed>0?'':'-idle')+'.png?v=knight-12';if(a.img.getAttribute('src')!==src)a.img.src=src;
   if(settings.bubbles&&m.comment&&((!fresh&&m.comment_id!==a.seen)||preview)){a.speech.textContent=m.comment;a.speechWidth=0;a.until=performance.now()+settings.speech_duration*1000;}
   if(a.until>performance.now()&&a.speech.textContent!==m.comment){a.speech.textContent=m.comment;a.speechWidth=0;}
   a.seen=m.comment_id;if(!settings.bubbles||!m.comment)a.until=0;
  });
 }
 function scheduleFrame(){cancelFrame(frameId);if(!paused&&!renderedCatalog)frameId=requestAnimationFrame(animate);}
 function animate(now){const frameTime=actors.size>20?1000/30:1000/60;if(last&&now>=last&&now-last<frameTime){scheduleFrame();return;}const dt=last&&now>=last?Math.min((now-last)/1000,.05):0;last=now;const stageWidth=stage.clientWidth;
  for(const a of actors.values()){
   const limit=Math.max(0,stageWidth-a.size);a.x=Math.max(0,Math.min(limit,a.x));const before=a.x;const walkSpeed=Math.min(settings.speed,a.size*a.stride*1.8);a.x+=a.dir*walkSpeed*dt;if(a.x>=limit){a.x=limit;a.dir=-1;}if(a.x<=0){a.x=0;a.dir=1;}
   a.el.style.transform=`translate3d(${a.x}px,0,0)`;a.art.style.transform=`scaleX(${a.dir})`;a.walkPhase=(a.walkPhase+Math.abs(a.x-before)/Math.max(1,a.size*a.stride))%1;const frame=settings.speed>0?Math.floor(a.walkPhase*a.frames):0;a.img.style.transform=`translate3d(${-frame*100/a.frames}%,0,0)`;a.art.dataset.frame=String(frame);a.speech.hidden=now>=a.until;
   if(!a.speech.hidden){const w=a.speechWidth||(a.speechWidth=a.speech.offsetWidth);const center=a.x+a.size/2;a.speech.style.left=(Math.max(w/2,Math.min(stageWidth-w/2,center))-a.x-w/2)+'px';}
  }
  if(catalog)renderedCatalog=true;scheduleFrame();
 }
 function queuePoll(delay=0){clearLater(pollTimer);if(!paused&&!preview)pollTimer=later(poll,delay);}
 async function poll(){if(paused||preview)return;try{const r=await fetch('/broadcast/stream-buddies',{cache:'no-store',signal:AbortSignal.timeout(4500)});if(!r.ok)throw Error();const d=await r.json();settings=d.settings;draw(d.muted?[]:d.members,session!==d.session);session=d.session;staleAt=performance.now();}catch(_){if(performance.now()-staleAt>5000)draw([]);}finally{queuePoll(livePush?5000:1000);}}
 function queueDemo(delay=5000){clearLater(demoTimer);if(!paused&&preview&&!catalog)demoTimer=later(()=>{demoTick++;draw(demo());queueDemo();},delay);}
 if(preview){draw(demo());queueDemo();}else queuePoll();
 function setPaused(value){paused=!!value;clearLater(pollTimer);clearLater(demoTimer);cancelFrame(frameId);if(!paused){last=performance.now();renderedCatalog=false;scheduleFrame();if(preview)queueDemo(600);else queuePoll(0);}}
 addEventListener('visibilitychange',()=>setPaused(document.hidden));addEventListener('pagehide',()=>setPaused(true),{once:true});
 addEventListener('tikreader:runtime-ready',event=>{livePush=true;event.detail?.onData?.(()=>queuePoll(0));event.detail?.lifecycle?.onPause?.(setPaused);});
 if(preview)addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent||e.data?.type!=='buddies-preview')return;const changed=e.data.settings.theme&&e.data.settings.theme!==settings.theme;if(changed)demoOrder=[];settings={...settings,...e.data.settings};demoTick++;draw(demo(),Boolean(changed));});
 scheduleFrame();
})();
