(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const pane=el('section');pane.className='studio-pane';pane.dataset.section='minecraft';const notice=el('p');notice.setAttribute('role','status');
 const stylesheet=el('link');stylesheet.rel='stylesheet';stylesheet.href='/static/minecraft.css';document.head.append(stylesheet);
 async function api(path,data){const operation=operationSerial,mode=currentEdition;const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});const d=await r.json();if(data&&(operation!==operationSerial||mode!==currentEdition))throw Error('La operación ya no corresponde a esta edición.');if(!r.ok)throw Error(d.error||'Error');return d}
 const edited=new Set();
 function field(label,type='text',parent=pane){const l=el('label',label),n=el(type==='textarea'?'textarea':'input');if(type!=='textarea')n.type=type;n.addEventListener('input',()=>edited.add(n));l.append(n);parent.append(l);return n}
 function disclosure(title){const node=el('details');node.append(el('summary',title));return node;}
 let busy=false,uncertain=false,operationSerial=0;const actionButtons=[],extraControls=[];
 function syncControls(){for(const input of extraControls)input.disabled=busy||uncertain||!backendReady;for(const b of actionButtons)b.disabled=busy||uncertain||(b.needsBackend&&!backendReady);edition.disabled=busy||uncertain||!backendReady;permission.disabled=busy||uncertain||!backendReady;for(const row of presetRows.values()){row.gift.disabled=busy||uncertain||!backendReady;if(row.quantity)row.quantity.disabled=busy||uncertain||!backendReady;row.enabled.disabled=busy||uncertain||!backendReady||!row.gift.value;}}
 async function operate(fn){
  if(busy||uncertain)return;
  busy=true;operationSerial++;epoch++;clearTimeout(timer);syncControls();
  try{await fn();}catch(e){notice.textContent=e.message;}
  finally{busy=false;epoch++;syncControls();void refresh();}
 }
 const button=(text,fn,needsBackend=true)=>{const b=el('button',text);b.type='button';b.needsBackend=needsBackend;b.onclick=()=>{if(needsBackend&&!backendReady)return;return operate(fn);};actionButtons.push(b);return b};
 let backendReady=false,confirmedAuthorized=false,savedConfig={commands:{}};
 const header=el('div');header.className='minecraft-header';const heading=el('h2','Minecraft');header.append(heading);pane.append(header);
 const editionLabel=el('label','Edición'),edition=el('select');
 for(const [value,text] of [['java','Java (RCON)'],['bedrock','Bedrock (mundo local)']]){const option=el('option',text);option.value=value;edition.append(option);}
 edition.value='java';editionLabel.append(edition);header.append(editionLabel);
 const permissionArea=el('div');permissionArea.className='minecraft-permission';pane.append(permissionArea);
 const permission=field('Autorizar Minecraft','checkbox',permissionArea);permission.checked=false;
 const connection=disclosure('Conexión Java');connection.className='minecraft-connection';const connectionFields=el('div');connectionFields.className='minecraft-connection-fields';connection.append(connectionFields);pane.append(connection);
 const quickActions=el('section');quickActions.className='minecraft-quick-actions';pane.append(quickActions);
 const host=field('Dirección privada','text',connectionFields),port=field('Puerto RCON','number',connectionFields),password=field('Contraseña RCON','password',connectionFields);
 host.value='127.0.0.1';port.value=25575;
 const advanced=disclosure('Opciones avanzadas'),help=disclosure('Ayuda');
 const nameFormatLabel=el('label','Nombres de mobs en Java'),nameFormat=el('select');for(const [id,text] of [['modern','Java 1.21.5 o posterior'],['legacy','Java 1.13 a 1.21.4']]){const option=el('option',text);option.value=id;nameFormat.append(option);}nameFormat.value='modern';nameFormatLabel.append(nameFormat);advanced.append(nameFormatLabel,el('small','El formato se guarda con Guardar límites.'));nameFormat.addEventListener('change',()=>edited.add(nameFormat));
 const commands=field('Comandos autorizados: un alias = comando por línea','textarea',advanced);commands.rows=4;
 const status=el('p','Sin conectar'),log=el('div');status.setAttribute('role','status');header.append(status);
 const localInstructions=el('div'),connectCommand=el('p');
 localInstructions.className='minecraft-bedrock-setup';connectCommand.className='minecraft-connect-command';connectCommand.hidden=true;
 localInstructions.append(el('p','1. Prepara la conexión.  2. Pega el comando en el chat de tu mundo.  3. Marca Autorizar Minecraft.'),el('small','Mundo local de Windows · Trucos activados · Require Encrypted Websockets desactivado.'),connectCommand);
 permissionArea.append(localInstructions);
 help.append(el('p','Los mobs disponibles dependen de la versión instalada de Minecraft. El juego puede rechazar los más recientes; no se reintenta una invocación.'),el('p','Java necesita un servidor con RCON habilitado. En server.properties: enable-rcon=true, rcon.password y rcon.port. Un mundo individual sin RCON no es compatible.'),el('p','Bedrock: activa trucos y permisos de administrador; habilita Enable WebSockets si aparece y desactiva Require Encrypted Websockets para esta conexión local. Solo se admite este equipo.'),el('p','Si Bedrock no conecta, revisa los permisos de loopback de Minecraft en Windows. TikReader no cambia opciones de Windows ni del juego.'),el('p','Desconecta antes de cambiar de mundo: el juego puede conservar la conexión al salir. TikReader no verifica continuamente qué mundo está abierto.'),el('p','Las acciones se aplican a @p: el jugador más cercano al origen del comando, no al espectador que envió el regalo. Java usa el origen del servidor; Bedrock, el contexto del jugador conectado.'),el('p','Las rachas finalizadas multiplican la cantidad configurada de mobs y TNT. Los demás efectos se aplican una vez. Detener cancela pasos pendientes, pero no deshace lo que ya cambió en el mundo. Sin confirmar significa que la respuesta no permite asegurar el resultado.'));
 let currentEdition='java';const drafts=new Map();
 const quantityDrafts=new Map();let quantityRecovery=null;
 function rowDrafts(){if(!quantityDrafts.has(currentEdition))quantityDrafts.set(currentEdition,{});return quantityDrafts.get(currentEdition);}
 const presetRows=new Map();let presetValues={},presetDirty=false,presetRecovery=false,giftCatalog=[];
 const defaultActions=[
  {
    "id": "tnt_rain",
    "name": "Lluvia de TNT",
    "description": "TNT",
    "category": "actions",
    "quantity": 5
  },
  {
    "id": "zombie",
    "name": "Zombi",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "rain",
    "name": "Lluvia",
    "description": "Clima",
    "category": "actions"
  },
  {
    "id": "thunder",
    "name": "Tormenta",
    "description": "Clima",
    "category": "actions"
  },
  {
    "id": "night",
    "name": "Noche",
    "description": "Hora",
    "category": "actions"
  },
  {
    "id": "diamonds",
    "name": "Diamantes",
    "description": "5 diamantes",
    "category": "actions"
  },
  {
    "id": "speed",
    "name": "Velocidad II",
    "description": "20 s",
    "category": "actions"
  },
  {
    "id": "jump",
    "name": "Salto II",
    "description": "20 s",
    "category": "actions"
  },
  {
    "id": "heal",
    "name": "Curación II",
    "description": "Instantánea",
    "category": "actions"
  },
  {
    "id": "pig",
    "name": "Cerdo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "cow",
    "name": "Vaca",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "sheep",
    "name": "Oveja",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "chicken",
    "name": "Gallina",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "bee",
    "name": "Abeja",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "armadillo",
    "name": "Armadillo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "horse",
    "name": "Caballo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "donkey",
    "name": "Burro",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "mule",
    "name": "Mula",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "camel",
    "name": "Camello",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "rabbit",
    "name": "Conejo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "cat",
    "name": "Gato",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "wolf",
    "name": "Lobo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "fox",
    "name": "Zorro",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "ocelot",
    "name": "Ocelote",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "panda",
    "name": "Panda",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "polar_bear",
    "name": "Oso polar",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "goat",
    "name": "Cabra",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "llama",
    "name": "Llama",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "trader_llama",
    "name": "Llama del comerciante",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "mooshroom",
    "name": "Champiñaca",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "parrot",
    "name": "Loro",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "bat",
    "name": "Murciélago",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "sniffer",
    "name": "Rastreador",
    "description": "Mob",
    "category": "animals",
    "quantity": 1
  },
  {
    "id": "axolotl",
    "name": "Ajolote",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "frog",
    "name": "Rana",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "tadpole",
    "name": "Renacuajo",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "turtle",
    "name": "Tortuga",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "dolphin",
    "name": "Delfín",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "squid",
    "name": "Calamar",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "glow_squid",
    "name": "Calamar brillante",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "cod",
    "name": "Bacalao",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "salmon",
    "name": "Salmón",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "tropical_fish",
    "name": "Pez tropical",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "pufferfish",
    "name": "Pez globo",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "nautilus",
    "name": "Nautilo",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "guardian",
    "name": "Guardián",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "elder_guardian",
    "name": "Guardián anciano",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1
  },
  {
    "id": "villager",
    "name": "Aldeano",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1
  },
  {
    "id": "wandering_trader",
    "name": "Comerciante ambulante",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1
  },
  {
    "id": "allay",
    "name": "Allay",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1
  },
  {
    "id": "iron_golem",
    "name": "Gólem de hierro",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1
  },
  {
    "id": "snow_golem",
    "name": "Gólem de nieve",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1
  },
  {
    "id": "copper_golem",
    "name": "Gólem de cobre",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1
  },
  {
    "id": "happy_ghast",
    "name": "Ghast feliz",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1
  },
  {
    "id": "skeleton",
    "name": "Esqueleto",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "drowned",
    "name": "Ahogado",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "husk",
    "name": "Zombi momificado",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "zombie_villager",
    "name": "Aldeano zombi",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "zombie_horse",
    "name": "Caballo zombi",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "camel_husk",
    "name": "Camello momificado",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "zombie_nautilus",
    "name": "Nautilo zombi",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "stray",
    "name": "Esqueleto glacial",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "bogged",
    "name": "Esqueleto pantanoso",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "parched",
    "name": "Esqueleto reseco",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "skeleton_horse",
    "name": "Caballo esqueleto",
    "description": "Mob",
    "category": "undead",
    "quantity": 1
  },
  {
    "id": "creeper",
    "name": "Creeper",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "spider",
    "name": "Araña",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "cave_spider",
    "name": "Araña de cueva",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "slime",
    "name": "Slime",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "silverfish",
    "name": "Lepisma",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "phantom",
    "name": "Fantasma",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "witch",
    "name": "Bruja",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "pillager",
    "name": "Saqueador",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "vindicator",
    "name": "Vindicador",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "evoker",
    "name": "Invocador",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "vex",
    "name": "Vex",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "ravager",
    "name": "Devastador",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "breeze",
    "name": "Breeze",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "creaking",
    "name": "Crujidor",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "sulfur_cube",
    "name": "Cubo de azufre",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1
  },
  {
    "id": "blaze",
    "name": "Blaze",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "ghast",
    "name": "Ghast",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "magma_cube",
    "name": "Cubo de magma",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "hoglin",
    "name": "Hoglin",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "zoglin",
    "name": "Zoglin",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "piglin",
    "name": "Piglin",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "piglin_brute",
    "name": "Piglin bruto",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "zombified_piglin",
    "name": "Piglin zombificado",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "wither_skeleton",
    "name": "Esqueleto wither",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "strider",
    "name": "Lavagante",
    "description": "Mob",
    "category": "nether",
    "quantity": 1
  },
  {
    "id": "enderman",
    "name": "Enderman",
    "description": "Mob",
    "category": "end",
    "quantity": 1
  },
  {
    "id": "endermite",
    "name": "Endermite",
    "description": "Mob",
    "category": "end",
    "quantity": 1
  },
  {
    "id": "shulker",
    "name": "Shulker",
    "description": "Mob",
    "category": "end",
    "quantity": 1
  },
  {
    "id": "warden",
    "name": "Warden",
    "description": "Mob",
    "category": "bosses",
    "quantity": 1
  },
  {
    "id": "wither",
    "name": "Wither",
    "description": "Mob",
    "category": "bosses",
    "quantity": 1
  },
  {
    "id": "ender_dragon",
    "name": "Dragón del End",
    "description": "Mob",
    "category": "bosses",
    "quantity": 1,
    "note": "La visibilidad del nombre depende de Minecraft."
  }
];
 const compatibility=el('p','Conectando con TikReader…');compatibility.className='minecraft-compatibility';
 const catalogNotice=el('p'),actionList=el('div');catalogNotice.setAttribute('role','status');
 const categoryOptions=[['actions','Acciones'],['animals','Animales'],['aquatic','Acuáticos'],['helpers','Ayudantes'],['undead','No-muertos'],['hostile','Hostiles'],['nether','Nether'],['end','End'],['bosses','Jefes']];
 const categorySelections=new Map(),categoryTabs=new Map(),categoryPanels=new Map();
 let confirmedPresetValues={},categoryEditionConfirmed=false,pendingInitialCategory=null;
 const tabList=el('div');tabList.className='minecraft-category-tabs';tabList.setAttribute('role','tablist');tabList.setAttribute('aria-label','Categorías de acciones');
 for(const [id,name] of categoryOptions){
  const tab=el('button',name);tab.type='button';tab.dataset.category=id;tab.id='minecraft-tab-'+id;
  tab.setAttribute('role','tab');tab.setAttribute('aria-controls','minecraft-panel-'+id);
  tab.onclick=()=>selectCategory(id,true);
  tab.addEventListener('keydown',event=>{
   const index=categoryOptions.findIndex(([key])=>key===id);
   let next;
   if(event.key==='ArrowRight')next=(index+1)%categoryOptions.length;
   if(event.key==='ArrowLeft')next=(index+categoryOptions.length-1)%categoryOptions.length;
   if(event.key==='Home')next=0;
   if(event.key==='End')next=categoryOptions.length-1;
   if(next===undefined)return;
   event.preventDefault();const key=categoryOptions[next][0];selectCategory(key,true);
   categoryTabs.get(key).focus();categoryTabs.get(key).scrollIntoView?.({block:'nearest',inline:'nearest'});
  });
  const panel=el('div');panel.id='minecraft-panel-'+id;panel.dataset.categoryPanel=id;
  panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);
  categoryTabs.set(id,tab);categoryPanels.set(id,panel);tabList.append(tab);actionList.append(panel);
 }
 function selectCategory(id,remember=false){
  if(remember){
   if(categoryEditionConfirmed)categorySelections.set(currentEdition,id);
   else pendingInitialCategory=id;
  }
  for(const [key,tab] of categoryTabs){
   const selected=key===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
   categoryPanels.get(key).hidden=!selected;
  }
 }
 function updateCategories(confirmed){
  if(confirmed){
   if(!categoryEditionConfirmed){
    categoryEditionConfirmed=true;
    if(pendingInitialCategory!==null){
     categorySelections.set(currentEdition,pendingInitialCategory);pendingInitialCategory=null;
    }
   }
   confirmedPresetValues=structuredClone(confirmed);
   if(!categorySelections.has(currentEdition)){
    const first=categoryOptions.find(([id])=>defaultActions.some(row=>row.category===id&&confirmed[row.id]?.enabled&&confirmed[row.id]?.gift_id));
    categorySelections.set(currentEdition,first?.[0]||'actions');
   }
  }
  for(const [id,name] of categoryOptions){
   const count=defaultActions.filter(row=>row.category===id&&confirmedPresetValues[row.id]?.enabled&&confirmedPresetValues[row.id]?.gift_id).length;
   const tab=categoryTabs.get(id);tab.textContent=name+(count?' · '+count:'');
   tab.setAttribute('aria-label',name+(count?`, ${count} activas`:''));
  }
  selectCategory(categorySelections.get(currentEdition)||pendingInitialCategory||'actions');
 }
 selectCategory('actions');
 function fillGiftOptions(row,value){
  const signature=JSON.stringify([giftCatalog,value.gift_id,value.gift_name]);
  if(row.signature!==signature){
   const options=[['','Selecciona un regalo'],...giftCatalog.map(g=>[String(g.id),g.diamonds?`${g.name} · ${g.diamonds} diamantes`:g.name])];
   if(value.gift_id&&!giftCatalog.some(g=>String(g.id)===value.gift_id))options.push([value.gift_id,`${value.gift_name||value.gift_id} · guardado`]);
   row.gift.replaceChildren(...options.map(([id,name])=>{const option=el('option',name);option.value=id;return option;}));row.signature=signature;
  }
  row.gift.value=value.gift_id;row.enabled.checked=!!value.enabled;
  if(row.quantity)row.quantity.value=rowDrafts()[row.id]??value.quantity??row.defaultQuantity;
 }
 function renderPresets(d,force=false){
  if(force||!presetDirty)presetValues=structuredClone(d.presets||d.config?.presets||{});
  for(const preset of defaultActions){
   if(presetRows.has(preset.id))continue;
   const node=el('div');node.className='minecraft-action-row';node.dataset.quickAction=preset.id;
   const title=el('div');title.className='minecraft-action-title';title.append(el('strong',preset.name),el('small',preset.description));
   if(preset.note){const note=el('small',preset.note);note.className='minecraft-action-note';title.append(note);}
   const gift=el('select');gift.dataset.presetGift=preset.id;gift.setAttribute('aria-label','Regalo para '+preset.name);
   const enabled=el('input');enabled.type='checkbox';enabled.dataset.presetEnabled=preset.id;enabled.setAttribute('aria-label','Activar '+preset.name);
   const enabledLabel=el('label');enabledLabel.className='minecraft-action-enabled';enabledLabel.append(el('span','Activa'),enabled);
   const quantityLabel=el(preset.quantity?'label':'span');quantityLabel.className='minecraft-action-quantity';
   let quantity;
   if(preset.quantity){
    quantity=el('input');quantity.type='number';quantity.min=1;quantity.max=20;quantity.step=1;
    quantity.value=preset.quantity;quantity.dataset.presetQuantity=preset.id;
    quantity.setAttribute('aria-label','Cantidad de '+preset.name);
    quantityLabel.append(el('span','Cantidad'),quantity);
    quantity.addEventListener('input',()=>{rowDrafts()[preset.id]=quantity.value;});
    quantity.addEventListener('change',()=>savePreset(preset.id));
   }
   const test=button('Probar',async()=>{await api('/minecraft/presets/test',{edition:currentEdition,id:preset.id});notice.textContent='Prueba en cola. Revisa el registro.';});test.setAttribute('aria-label','Probar '+preset.name);test.className='minecraft-action-test';
   node.append(title,gift,quantityLabel,enabledLabel,test);categoryPanels.get(preset.category).append(node);presetRows.set(preset.id,{gift,enabled,quantity,id:preset.id,defaultQuantity:preset.quantity});
   for(const control of [gift,enabled])control.addEventListener('change',()=>savePreset(preset.id));
  }
  for(const [id,row] of presetRows)fillGiftOptions(row,presetValues[id]||{gift_id:'',gift_name:'',enabled:false});
  updateCategories(d.authorization_mode?d.presets||d.config?.presets||{}:null);simulationOptions();syncControls();
 }
 async function savePreset(id){
  if(busy||uncertain||!backendReady){renderPresets({presets:presetValues},true);return;}
  return operate(async()=>{
   const row=presetRows.get(id),giftId=row.gift.value;
   const name=giftCatalog.find(g=>String(g.id)===giftId)?.name||presetValues[id]?.gift_name||'';
   presetValues={...presetValues,[id]:{gift_id:giftId,gift_name:name,enabled:!!giftId&&row.enabled.checked,...(row.quantity?{quantity:Number(row.quantity.value)}:{})}};presetDirty=true;
   try{
    const d=await api('/minecraft/presets',{edition:currentEdition,presets:presetValues});
    delete rowDrafts()[id];presetDirty=false;renderPresets(d,true);notice.textContent='Acciones rápidas guardadas.';
   }catch(e){
    try{
     const d=await api('/minecraft');delete rowDrafts()[id];presetDirty=false;
     if(d.edition&&d.edition!==currentEdition){drafts.set(currentEdition,captureDraft());selectProfile(d);}
     renderPresets(d,true);notice.textContent=e.message+' Se muestra la configuración confirmada.';
    }catch(_){
     drafts.set(currentEdition,captureDraft());
     uncertain=true;presetRecovery=true;quantityRecovery=id;notice.textContent='No se pudo confirmar el guardado. Espera a que se recupere la conexión.';
    }
   }
  });
 }
 async function loadGiftCatalog(){
  try{const d=await api('/gift-catalog');giftCatalog=Array.isArray(d.gifts)?d.gifts:[];catalogNotice.textContent=giftCatalog.length?'':'Conecta tu LIVE y actualiza los regalos.';}
  catch(_){catalogNotice.textContent='Regalos no disponibles. Puedes actualizar de nuevo.';}
  renderPresets({presets:presetValues},true);
 }
 const actionHeading=el('div');actionHeading.className='minecraft-actions-heading';
 const stopButton=button('Detener',async()=>{await api('/minecraft/presets/stop',{edition:currentEdition});notice.textContent='Acciones pendientes detenidas.';});stopButton.setAttribute('aria-label','Detener acciones rápidas');
 actionHeading.append(el('h3','Acciones predeterminadas'),button('Actualizar regalos',loadGiftCatalog,false),stopButton);
 const columns=el('div');columns.className='minecraft-action-columns';columns.setAttribute('aria-hidden','true');for(const text of ['Acción','Regalo','Cantidad','Activa',''])columns.append(el('span',text));
 quickActions.append(actionHeading,el('p','Cantidad por regalo. Las rachas multiplican mobs y TNT. Si supera el límite, se descarta el regalo.'),compatibility,catalogNotice,tabList,columns,actionList);
 const simulation=el('section');simulation.className='minecraft-tools';simulation.append(el('h3','Simular regalo'),el('p','Ejecuta los efectos activos en Minecraft. No requiere un directo.'));
 const simulationFields=el('div');simulationFields.className='minecraft-tool-fields';
 const simulationGiftLabel=el('label','Regalo para simular'),simulationGift=el('select');simulationGiftLabel.append(simulationGift);simulationFields.append(simulationGiftLabel);
 const donor=field('Nombre del donante','text',simulationFields);donor.value='Prueba';donor.maxLength=200;
 simulationFields.append(button('Simular regalo',async()=>{if(!simulationGift.value)throw Error('Selecciona un regalo para simular.');const d=await api('/minecraft/presets/simulate',{edition:currentEdition,gift_id:simulationGift.value,user:donor.value});if(typeof d.accepted!=='boolean')throw Error('No se pudo confirmar la simulación. Revisa el registro.');notice.textContent=d.detail||(d.accepted?'Simulación admitida. Revisa el registro.':'No hay acciones activas para este regalo.');}));simulation.append(simulationFields);
 const safety=el('section');safety.className='minecraft-tools';safety.append(el('h3','Límites de seguridad'));
 const safetyFields=el('div');safetyFields.className='minecraft-tool-fields';
 const interval=field('Intervalo mínimo (segundos)','number',safetyFields),perMinute=field('Efectos por minuto','number',safetyFields);
 interval.min=1;interval.max=60;interval.step=1;interval.value=3;perMinute.min=5;perMinute.max=120;perMinute.step=1;perMinute.value=20;
 async function saveSafety(){
  try{
   const d=await api('/minecraft/presets/settings',{
    edition:currentEdition,
    limits:{interval:Number(interval.value),per_minute:Number(perMinute.value)},
    name_format:nameFormat.value
   });
   for(const input of [interval,perMinute,nameFormat])edited.delete(input);
   applySafety(d,true);notice.textContent='Límites guardados.';
  }catch(e){
   try{
    const d=await api('/minecraft');
    if(d.edition!==currentEdition)selectProfile(d);
    applySafety(d,true);notice.textContent=e.message+' Se muestran los límites confirmados.';
   }catch(_){
    uncertain=true;notice.textContent='No se pudo confirmar el guardado. Reintentando…';
   }
  }
 }
 safetyFields.append(button('Guardar límites',saveSafety));
 safety.append(safetyFields,el('small','Cada mob y cada TNT cuenta como un efecto. El exceso se descarta, no se acumula.'));
 pane.append(simulation,safety);
 extraControls.push(simulationGift,donor,interval,perMinute,nameFormat);
 function applySafety(d,force=false){
  const values=d.limits||d.config?.limits||{interval:3,per_minute:20};
  for(const [input,value] of [[interval,values.interval],[perMinute,values.per_minute],
                             [nameFormat,d.name_format||d.config?.name_format||'modern']]){
   if(force||!edited.has(input))input.value=value;
  }
 }
 function simulationOptions(){
  const value=simulationGift.value,options=new Map(giftCatalog.map(g=>[String(g.id),g.name]));
  for(const row of Object.values(presetValues)){
   if(row.gift_id&&!options.has(row.gift_id))options.set(row.gift_id,`${row.gift_name||row.gift_id} · guardado`);
  }
  simulationGift.replaceChildren(...[['','Selecciona un regalo'],...options].map(([id,name])=>{
   const option=el('option',name);option.value=id;return option;
  }));
  simulationGift.value=options.has(value)?value:'';
 }
 function captureDraft(){return {host:host.value,port:port.value,commands:commands.value,interval:interval.value,perMinute:perMinute.value,nameFormat:nameFormat.value};}
 function selectProfile(d){
  currentEdition=d.edition||currentEdition;edited.clear();hydratePending=false;
  password.value='';permission.checked=false;confirmedAuthorized=false;connectCommand.textContent='';connectCommand.hidden=true;showEdition();
  const draft=drafts.get(currentEdition);
  host.value=draft?.host||d.config.host||'127.0.0.1';port.value=draft?.port||d.config.port||25575;
  commands.value=draft?draft.commands:Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n');
  presetDirty=false;renderPresets(d,true);applySafety(d,true);
  if(draft){for(const [input,value] of [[interval,draft.interval],[perMinute,draft.perMinute],[nameFormat,draft.nameFormat]])if(value!==undefined){input.value=value;edited.add(input);}}
 }
 function showEdition(){
  const bedrock=currentEdition==='bedrock';edition.value=currentEdition;
  heading.textContent='Minecraft';connection.hidden=bedrock;
  for(const input of [host,port,password])input.parentElement.hidden=bedrock;
  localInstructions.hidden=!bedrock;prepareButton.hidden=!bedrock;nameFormatLabel.hidden=bedrock;
 }
 const labels={success:'Éxito confirmado',rejected:'Comando rechazado',connection_error:'Error de conexión',unconfirmed:'Sin confirmar',cancelled:'Cancelado'};
 let timer,inFlight=false,refreshPending=false,hydratePending=true,stopped=false,epoch=0;
 const active=()=>pane.isConnected&&!pane.hidden&&!document.hidden&&!stopped;
 function render(d,hydrate){
  backendReady=d.authorization_mode==='checkbox'&&Array.isArray(d.preset_catalog)&&Array.isArray(d.preset_categories)&&categoryOptions.every(([id])=>d.preset_categories.some(c=>c.id===id))&&defaultActions.every(p=>d.preset_catalog.some(s=>s.id===p.id&&s.category===p.category&&(!p.quantity||(s.quantity_max===20&&s.quantity_min===1))));
  compatibility.textContent=backendReady?'':'Reinicia TikReader para cargar estas acciones.';compatibility.hidden=backendReady;
  savedConfig=d.config||savedConfig;applySafety(d);
  if(uncertain&&!busy){if(quantityRecovery){delete rowDrafts()[quantityRecovery];quantityRecovery=null;}selectProfile(d);uncertain=false;presetRecovery=false;presetDirty=false;syncControls();hydrate=false;}
  if(hydrate){currentEdition=d.edition||'java';showEdition();for(const [input,value] of [[host,d.config.host||'127.0.0.1'],[port,d.config.port||25575],[commands,Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n')]])if(!edited.has(input))input.value=value;}
  const bedrock=currentEdition==='bedrock';
  if(!presetRecovery)renderPresets(d);
  confirmedAuthorized=backendReady&&d.authorized===true;permission.checked=confirmedAuthorized;
  status.textContent=(confirmedAuthorized?'Conectado':bedrock&&d.bedrock?.connected?'Mundo conectado':bedrock&&d.bedrock?.prepared?'Esperando tu mundo':'Sin conectar')+(d.queued?` · ${d.queued} en cola`:'');
  syncControls();
  log.replaceChildren(...d.log.slice(0,10).map(x=>{
   const label=labels[x.outcome];
   const detail=label?`${label} · ${x.alias}: ${x.response||x.text}`:x.text;
   return el('p',new Date(x.at*1000).toLocaleTimeString((window.I18n?.locale || 'es-419'))+' · '+detail);
  }));
 }
 async function refresh(){
  clearTimeout(timer);
  if(!active())return;
  if(busy){refreshPending=true;return;}
  if(inFlight){refreshPending=true;return;}
  inFlight=true;const generation=epoch,hydrate=hydratePending;
  try{
   const d=await api('/minecraft');
   if(active()&&generation===epoch){render(d,hydrate);hydratePending=false;}
  }catch(_){if(active()&&generation===epoch){backendReady=false;confirmedAuthorized=false;permission.checked=false;compatibility.hidden=false;compatibility.textContent='No se pudo conectar con TikReader. Reintentando…';status.textContent='Sin conexión';syncControls();}}
  finally{
   inFlight=false;
   if(active()){
    if(refreshPending){refreshPending=false;void refresh();}
    else timer=setTimeout(refresh,1000);
   }
  }
 }
 function sync(){epoch++;clearTimeout(timer);refreshPending=false;if(active())void refresh();}
 async function change(path,data){epoch++;await api(path,data);epoch++;void refresh();}
 function parse(){const out={};for(const line of commands.value.split('\n')){if(!line.trim())continue;const i=line.indexOf('=');if(i<1)throw Error('Usa alias = comando, uno por línea');out[line.slice(0,i).trim()]=line.slice(i+1).trim()}return out}
 const prepareButton=button('Preparar conexión',async()=>{if(currentEdition!=='bedrock')return;confirmedAuthorized=false;permission.checked=false;connectCommand.textContent='';const d=await api('/minecraft/bedrock/prepare',{});connectCommand.textContent=d.command;connectCommand.hidden=false;notice.textContent='Pega el comando en el chat de tu mundo.';});prepareButton.setAttribute('aria-label','Preparar conexión de Bedrock');
 const copyButton=button('Copiar comando',async()=>{if(!connectCommand.textContent){notice.textContent='Prepara la conexión primero.';return;}try{await navigator.clipboard.writeText(connectCommand.textContent);notice.textContent='Comando copiado.';}catch(_){notice.textContent='Selecciona y copia el comando mostrado.';}} ,false);
 localInstructions.append(prepareButton,copyButton);
 async function saveConnection(includeAliases=false){
  confirmedAuthorized=false;permission.checked=false;connectCommand.textContent='';
  const data={edition:currentEdition,commands:includeAliases?parse():savedConfig.commands||{}};
  if(currentEdition==='java')Object.assign(data,{host:host.value,port:Number(port.value),...(password.value?{password:password.value}:{})});
  const d=await api('/minecraft',data);password.value='';edited.delete(host);edited.delete(port);render(d,false);
 }
 connectionFields.append(button('Guardar conexión',async()=>{await saveConnection();notice.textContent='Conexión guardada. Marca Autorizar Minecraft.';}));
 permission.addEventListener('change',()=>{
  const enabled=permission.checked;
  permission.checked=confirmedAuthorized;
  if(busy||uncertain||!backendReady)return;
  return operate(async()=>{
   permission.checked=false;confirmedAuthorized=false;
   try{
    if(enabled&&currentEdition==='java'&&(password.value||host.value!==savedConfig.host||Number(port.value)!==savedConfig.port))await saveConnection();
    await api('/minecraft/authorize',{edition:currentEdition,enabled});
    if(!enabled){connectCommand.textContent='';connectCommand.hidden=true;password.value='';}
    const d=await api('/minecraft');render(d,false);notice.textContent=enabled?'Minecraft conectado.':'Comandos desactivados.';
   }catch(e){
    if(currentEdition==='java'&&enabled)connection.open=true;
    permission.checked=false;confirmedAuthorized=false;
    try{const d=await api('/minecraft');if(d.edition&&d.edition!==currentEdition)selectProfile(d);render(d,false);notice.textContent=e.message;}
    catch(_){drafts.set(currentEdition,captureDraft());uncertain=true;notice.textContent='No se pudo confirmar la autorización. Reintentando…';}
   }
  });
 });
 permissionArea.append(button('Desconectar',async()=>{confirmedAuthorized=false;permission.checked=false;connectCommand.textContent='';connectCommand.hidden=true;await change('/minecraft/disconnect',{});notice.textContent='Minecraft desconectado.';},false),notice);
 advanced.append(button('Guardar conexión y comandos',async()=>{await saveConnection(true);notice.textContent='Comandos guardados. Autoriza de nuevo.';}));
 edition.addEventListener('change',()=>{
  if(busy||uncertain){edition.value=currentEdition;return;}
  const next=edition.value,previous=currentEdition;if(next===previous)return;
  return operate(async()=>{
  drafts.set(previous,captureDraft());
  password.value='';permission.checked=false;confirmedAuthorized=false;connectCommand.textContent='';connectCommand.hidden=true;
  try{
   const d=await api('/minecraft',{edition:next,select_only:true});
   epoch++;
   selectProfile(d);
   render(d,false);notice.textContent='Edición seleccionada.';
  }catch(e){
   try{const d=await api('/minecraft');selectProfile(d);render(d,false);notice.textContent=e.message;}
   catch(_){uncertain=true;edition.value=previous;notice.textContent='No se pudo confirmar la edición. Los controles se reactivarán al recuperar la conexión.';}
  }
  });
 });
 advanced.append(button('Comprobar conexión sin ejecutar un alias',async()=>{const d=await api('/minecraft/check',{});notice.textContent=d.detail;}));
 const testAlias=field('Alias para prueba','text',advanced);advanced.append(button('Ejecutar alias de prueba',async()=>{if(!testAlias.value)throw Error('Escribe un alias guardado');await change('/minecraft/run',{alias:testAlias.value});notice.textContent='Comando enviado a la cola.';}),el('p','Formato: alias = comando. Usa el alias en Interactividad. Variables: {user}, {gift}, {count}.'));
 const activity=disclosure('Registro reciente');activity.className='minecraft-activity';activity.append(log);pane.append(activity,advanced,help);
 window.OperatorViewRegistry.register(pane.dataset.section,pane);
 showEdition();
 renderPresets({});
 new MutationObserver(sync).observe(pane,{attributes:true,attributeFilter:['hidden']});
 // Track both connection edges without refreshing for unrelated DOM changes.
 let connected=pane.isConnected;
 new MutationObserver(()=>{if(connected!==pane.isConnected){connected=pane.isConnected;sync();}}).observe(document.body,{childList:true,subtree:true});
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('pagehide',()=>{stopped=true;sync();});
 window.addEventListener('pageshow',()=>{stopped=false;sync();});
 void refresh();
 void loadGiftCatalog();
})();
