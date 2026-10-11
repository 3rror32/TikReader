window.Shell=(()=>{
 const app=document.querySelector('.app'), live=document.querySelector('.live-columns');
 const sidebar=document.createElement('aside');sidebar.className='app-sidebar';sidebar.setAttribute('aria-label','Menú principal');
 const brand=document.createElement('div');brand.className='sidebar-brand';const brandIcon=document.createElement('img');brandIcon.src='/static/icons/tikreader-192.png';brandIcon.className='tikreader-brand-icon';brandIcon.alt='';brandIcon.width=36;brandIcon.height=36;const brandName=document.createElement('span');brandName.textContent='TikReader';brand.append(brandIcon,brandName);sidebar.append(brand);
 const headerIcon=document.querySelector('.logo-icon');headerIcon.replaceChildren(brandIcon.cloneNode());
 document.querySelector('.logo h1').textContent='TikReader';document.title='TikReader — Estudio en vivo';
 const badge=document.getElementById('live-badge');badge.setAttribute('aria-label','Transmisión en vivo');
 badge.innerHTML='<svg class="live-emblem" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect class="live-frame" x="2" y="2" width="28" height="28" rx="10" stroke="currentColor" stroke-width="1.25"/><path class="live-wave wave-one" d="M10 13v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path class="live-wave wave-two" d="M16 9v14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><path class="live-wave wave-three" d="M22 13v6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg><span>EN VIVO</span>';

 // Motion is explicitly requested for this indicator; clicking it pauses only its animation.
 let badgeMotion=true;try{badgeMotion=localStorage.getItem('tikreader.liveBadgeMotion')!=='off';}catch(_){}
 function setBadgeMotion(){badge.dataset.motion=badgeMotion?'on':'off';badge.setAttribute('aria-pressed',String(badgeMotion));badge.setAttribute('aria-label',badgeMotion?'En vivo: pausar animación':'En vivo: activar animación');badge.title=badgeMotion?'Pausar animación':'Activar animación';}
 badge.setAttribute('role','button');badge.tabIndex=0;setBadgeMotion();
 badge.onclick=()=>{badgeMotion=!badgeMotion;setBadgeMotion();try{localStorage.setItem('tikreader.liveBadgeMotion',badgeMotion?'on':'off');}catch(_){}};
 badge.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();badge.click();}};
 const nav=document.createElement('nav');sidebar.append(nav);
 const config=document.createElement('main');config.className='config-content';config.hidden=true;app.append(config);
 const views=new Map();
 function add(key,node){node.hidden=true;node.classList.add('settings-view');config.append(node);views.set(key,node);return node;}
 function registerView(key,node){
  if(!key||!node)return null;
  const previous=views.get(key);if(previous&&previous!==node)previous.remove();
  add(key,node);
  if(pendingRoute?.viewKey===key)show(pendingRoute.key,{history:'none',focus:pendingRoute.focus});
  else if(currentRoute?.viewKey===key)show(currentRoute.key,{history:'none',focus:false});
  return node;
 }
 const panes={};for(const pane of document.querySelectorAll('[data-pane]'))panes[pane.dataset.pane]=pane;
 document.querySelector('.studio-tabs').remove();
 // Split existing groups rather than duplicating controls or their event handlers.
 function cutAt(source,text){const start=[...source.querySelectorAll('h2')].find(h=>h.textContent.includes(text));const out=document.createElement('section');out.className='studio-pane';if(start){let n=start;while(n){const next=n.nextSibling;out.append(n);n=next;}}return out;}
 const obs=cutAt(panes.workspace,'Ventanas para programas de streaming');
 const alerts=cutAt(panes.tools,'Aviso local de regalos');const filters=cutAt(panes.tools,'Filtros locales');
 const extras=document.getElementById('voice-extras').content.cloneNode(true);panes.tools.append(extras);
 // Regalos already live beside the chat. Keep the optional ranking with them instead
 // of sending users to a separate page that looked like a second gift screen.
 const giftRanking=document.createElement('details');giftRanking.className='gift-ranking';
 const giftRankingSummary=document.createElement('summary');giftRankingSummary.textContent='Ver top de regaladores de esta sesión';
 panes.ranking.hidden=false;giftRanking.append(giftRankingSummary,panes.ranking);document.querySelector('.gifts-column').append(giftRanking);
 // Keep the visual editor as the page root so its preview follows page visibility.
 const alertStudio=document.querySelector('[data-section="animation-studio"]');
 if(alertStudio){
  alerts.className='alerts-local-section';alerts.id='alerts-local';
  const oldHeading=alerts.querySelector('h2'),localHeading=document.createElement('h3');
  localHeading.id='alerts-local-title';localHeading.textContent='Avisos en esta computadora';oldHeading.replaceWith(localHeading);
  alerts.setAttribute('aria-labelledby',localHeading.id);
  alertStudio.querySelector('.alerts-page-header, .alerts-destinations').after(alerts);alerts.hidden=true;
  alertStudio.classList.add('alerts-workspace');
 }
 add('voice',panes.tools);add('filters',filters);add('alerts',alertStudio||alerts);add('history',panes.history);add('workspace',panes.workspace);add('diagnostics',panes.diagnostics);add('obs',obs);
 for(const node of document.querySelectorAll('[data-section]')){if(node===alertStudio)continue;add(node.dataset.section,node);}
 const links=[['Simulador','simulation'],['Chatbot','chatbot'],['Escenas','obs-direct'],['Eventos','event-diagnostics'],['Spotify','spotify'],['Encuestas','chat-poll'],['Streamer.bot','streamerbot'],['Sonidos','sound-library'],['Videos','video-library'],['Reglas','interactive'],['En vivo','live'],['Preguntas','questions'],['Atajos','game-hotkeys'],['Minecraft','minecraft'],['Puntos','points'],['Centro de control','control-center'],['Lectura','voice'],['Personaje','custom-voice'],['Filtros','filters'],['Emisión','production'],['Alertas','alerts'],['Overlays','overlay-gallery'],['Fuentes','obs'],['Sesiones','history'],['Moderación','moderator'],['Revisión','preflight'],['Conexión','diagnostics'],['Configuración','workspace'],['Acerca de','about']];
 // Each category contains destinations directly: no duplicated parent link.
 const groups=[
  [
    "Directo",
    [
      [
        "En vivo",
        "live"
      ],
      [
        "Preparar",
        "creator-suite"
      ],
      [
        "Lectura",
        "voice"
      ],
      [
        "Subtítulos",
        "microphone-captions"
      ],
      [
        "Overlays",
        "overlay-gallery",
        [
          [
            "Favoritos",
            "overlay-favorites"
          ],
          [
            "Mis overlays",
            "overlay-custom"
          ],
          [
            "Animaciones",
            "overlay-animations"
          ],
          [
            "Efectos",
            "overlay-effects"
          ],
          [
            "Herramientas",
            "overlay-tools"
          ],
          [
            "Metas",
            "overlay-goals"
          ],
          [
            "Mis animaciones",
            "overlay-my-animations"
          ]
        ]
      ],
      [
        "Alertas",
        "alerts"
      ]
    ]
  ],
  [
    "Chat",
    [
      [
        "Preguntas",
        "questions"
      ],
      [
        "Filtros",
        "filters"
      ],
      [
        "Moderación",
        "moderator"
      ],
      [
        "Encuestas",
        "chat-poll"
      ],
      [
        "Chatbot",
        "chatbot"
      ]
    ]
  ],
  [
    "Producción",
    [
      [
        "Fuentes",
        "obs"
      ],
      [
        "Escenas",
        "obs-direct"
      ],
      [
        "Emisión",
        "production"
      ]
    ]
  ],
  [
    "Multimedia",
    [
      [
        "Personaje",
        "custom-voice"
      ],
      [
        "Spotify",
        "spotify"
      ],
      [
        "Sonidos",
        "sound-library"
      ],
      [
        "Videos",
        "video-library"
      ]
    ]
  ],
  [
    "Juegos",
    [
      [
        "Atajos",
        "game-hotkeys"
      ],
      [
        "Minecraft",
        "minecraft"
      ],
      [
        "Puntos",
        "points"
      ]
    ]
  ],
  [
    "Interactividad",
    [
      [
        "Centro de control",
        "control-center"
      ],
      [
        "Reglas",
        "interactive"
      ],
      [
        "Streamer.bot",
        "streamerbot"
      ]
    ]
  ],
  [
    "Diagnóstico",
    [
      [
        "Simulador",
        "simulation"
      ],
      [
        "Revisión",
        "preflight"
      ],
      [
        "Conexión",
        "diagnostics"
      ],
      [
        "Eventos",
        "event-diagnostics"
      ]
    ]
  ]
];
 const trailingItems=[["Sesiones","history"],["Acerca de","about"]];
 const utilityItems=[["Configuración","workspace"]];
 const destinationLabels=new Map([...groups.flatMap(([,items])=>items.flatMap(([label,key,children])=>[[key,label],...(children||[]).map(([childLabel,childKey])=>[childKey,childLabel])])),...trailingItems.map(([label,key])=>[key,label]),...utilityItems.map(([label,key])=>[key,label])]);
 for(const [section,items] of groups){
  const sectionLabel=document.createElement('span');sectionLabel.className='nav-section-label';sectionLabel.textContent=section;nav.append(sectionLabel);
  for(const [label,key,children] of items){
   const group=document.createElement('div');group.className='nav-group';
   if(children){
    const disclosure=document.createElement('details'),summary=document.createElement('summary'),submenu=document.createElement('div');summary.textContent=label;submenu.className='nav-submenu';disclosure.dataset.sectionGroup=key;
    for(const [childLabel,childKey] of children){const child=document.createElement('button');child.type='button';child.textContent=childLabel;child.dataset.sectionNav=childKey;child.onclick=()=>show(childKey);submenu.append(child);}
    disclosure.append(summary,submenu);
    group.append(disclosure);nav.append(group);continue;
   }
   const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.sectionNav=key;button.onclick=()=>show(key);
   group.append(button);nav.append(group);
  }
  }
 for(const [label,key] of trailingItems){const group=document.createElement('div');group.className='nav-group nav-tail-item';const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.sectionNav=key;button.onclick=()=>show(key);group.append(button);nav.append(group);}
 const utilityDock=document.createElement('div');utilityDock.className='sidebar-utility';utilityDock.setAttribute('role','navigation');utilityDock.setAttribute('aria-label','Accesos rápidos');
 for(const [label,key] of utilityItems){const button=document.createElement('button');button.type='button';button.textContent=label;button.dataset.sectionNav=key;button.onclick=()=>show(key);utilityDock.append(button);}
 sidebar.append(utilityDock);
 const safety=document.createElement('div');safety.className='broadcast-safety';
  const panic=document.createElement('button');panic.id='emergency-button';panic.type='button';panic.className='panic-button';panic.textContent='Pausar voz y efectos';panic.setAttribute('aria-label','Pausar voz y efectos');panic.setAttribute('aria-pressed','false');panic.title='Pausa la voz y las acciones y oculta los overlays.';
 const status=document.createElement('p');status.id='emergency-status';status.setAttribute('role','status');
 safety.append(panic,status);document.querySelector('.app > header').append(safety);document.body.prepend(sidebar);
 const toggle=document.createElement('button');toggle.id='menu-toggle';toggle.textContent='Menú';toggle.setAttribute('aria-expanded','false');toggle.onclick=()=>{const open=document.body.classList.toggle('menu-open');toggle.setAttribute('aria-expanded',String(open));};document.querySelector('header').prepend(toggle);
 const heading=document.createElement('span');heading.id='section-title';document.querySelector('header').append(heading);
 heading.setAttribute('role','heading');heading.setAttribute('aria-level','2');heading.setAttribute('tabindex','-1');
 const overlaySections=new Set(['favorites','animations','effects','tools','goals']);
 const creatorTabs=new Set(['scenes','community','battles','calendar','profiles','library','games']);
 let currentRoute=null,pendingRoute=null,navigationSerial=0;
 function menuMotionAllowed(){return !document.body.classList.contains('menu-motion-reduced')&&!matchMedia('(prefers-reduced-motion: reduce)').matches;}
 function resolveRoute(key){
  let activeKey=key,viewKey=key,overlaySection='',creatorTab='',game='';
  if(key==='fortune-wheel'||key==='point-drop'){game=key;activeKey='overlay-tools';viewKey='overlay-gallery';overlaySection='tools';}
  else if(key==='overlay-gallery'){activeKey='overlay-favorites';viewKey='overlay-gallery';overlaySection='favorites';}
  else if(key==='overlay-my-animations'||key==='animation-studio'){activeKey='overlay-my-animations';viewKey='alerts';}
  else if(key==='overlay-custom')viewKey='custom-overlays';
  else if(overlaySections.has(key.slice(8))&&key.startsWith('overlay-')){viewKey='overlay-gallery';overlaySection=key.slice(8);}
  else if(key==='creator-suite'||(key.startsWith('creator-')&&creatorTabs.has(key.slice(8)))){
   activeKey='creator-suite';viewKey='creator-suite';creatorTab=key==='creator-suite'?'scenes':key.slice(8);
  }
  else if(key!=='live'&&!views.has(key)&&!destinationLabels.has(key))return null;
  return {key,activeKey,viewKey,overlaySection,creatorTab,game};
 }
 function focusDestination(viewKey){
  const root=viewKey==='live'?live:views.get(viewKey);
  const target=[...(root?.querySelectorAll('h1,h2,h3')||[])].find(node=>node.getClientRects().length)||heading;
  target.setAttribute('tabindex','-1');target.focus();
 }
 function show(key,{history:historyMode='push',focus=true}={}){
  const requested=resolveRoute(typeof key==='string'?key:'');
  const route=requested||resolveRoute('live');
  const hash='#'+route.key;
  if(location.hash!==hash){
   const replace=!requested||historyMode!=='push';
   const method=replace?'replaceState':'pushState';
   history[method](null,'',location.pathname+location.search+hash);
  }
  currentRoute=route;
  pendingRoute=route.viewKey!=='live'&&!views.has(route.viewKey)?{...route,focus}:null;
  // Declared async destinations keep their URL and show Live until registration completes.
  const {activeKey,viewKey,overlaySection,creatorTab,game}=pendingRoute?resolveRoute('live'):route;
  const serial=++navigationSerial;
  if(creatorTab)window.CreatorBridge?.open(creatorTab);
  const isLive=viewKey==='live';document.body.classList.toggle('config-view',!isLive);config.hidden=isLive;live.hidden=!isLive;for(const [name,node] of views)node.hidden=name!==viewKey;
  if(viewKey==='alerts'&&alertStudio){const custom=activeKey==='overlay-my-animations',title=alertStudio.querySelector('.alerts-page-header h2, :scope > h2'),intro=alertStudio.querySelector('.alerts-page-intro');if(title)title.textContent=custom?'Mis animaciones':'Alertas';if(intro)intro.textContent=custom?'Crea, prueba y activa tus animaciones personalizadas para regalos.':'Diseña, prueba y activa los avisos de tu LIVE.';}
  for(const b of sidebar.querySelectorAll('[data-section-nav]')){b.classList.toggle('active',b.dataset.sectionNav===activeKey);if(b.dataset.sectionNav===activeKey)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');}
  const activeButton=sidebar.querySelector(`[data-section-nav="${activeKey}"]`);if(activeButton)activeButton.closest('details')?.setAttribute('open','');
  heading.textContent=destinationLabels.get(activeKey)||links.find(x=>x[1]===viewKey)?.[0]||'';document.body.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false');
  requestAnimationFrame(()=>{
   if(serial!==navigationSerial)return;
   activeButton?.scrollIntoView({block:'nearest',inline:'nearest',behavior:menuMotionAllowed()?'smooth':'auto'});
   window.dispatchEvent(new CustomEvent('tikreader:navigation-change',{detail:{key:activeKey,label:heading.textContent}}));
   if(overlaySection)window.dispatchEvent(new CustomEvent('tikreader:open-overlay-section',{detail:{section:overlaySection}}));
   if(game)window.dispatchEvent(new CustomEvent('tikreader:open-overlay',{detail:{key:game}}));
   if(focus)focusDestination(viewKey);
  });
  if(viewKey==='history')document.getElementById('history-refresh').click();if(viewKey==='questions')document.getElementById('questions-refresh')?.click();
 }
 function restoreRoute(){
  const key=location.hash.slice(1)||'live';
  // Browsers can emit both events for one history traversal.
  if(currentRoute?.key===key&&location.hash==='#'+key)return;
  show(key,{history:'none',focus:true});
 }
 window.addEventListener('popstate',restoreRoute);window.addEventListener('hashchange',restoreRoute);
 show(location.hash.slice(1)||'live',{history:'replace',focus:false});
 const api={show,registerView};window.dispatchEvent(new CustomEvent('tikreader:shell-ready',{detail:api}));window.OperatorBoot?.shellReady();return api;
})();
