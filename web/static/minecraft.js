(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const pane=el('section');pane.className='studio-pane';pane.dataset.section='minecraft';const notice=el('p');notice.setAttribute('role','status');
 const stylesheet=el('link');stylesheet.rel='stylesheet';stylesheet.href='/static/minecraft.css';document.head.append(stylesheet);
 async function api(path,data){const operation=operationSerial,mode=currentEdition;const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});const d=await r.json();if(data&&(operation!==operationSerial||mode!==currentEdition))throw Error('La operación ya no corresponde a esta edición.');if(!r.ok)throw Error(d.error||'Error');return d}
 const edited=new Set();
 function field(label,type='text',parent=pane){const l=el('label',label),n=el(type==='textarea'?'textarea':'input');if(type!=='textarea')n.type=type;n.addEventListener('input',()=>edited.add(n));l.append(n);parent.append(l);return n}
 function disclosure(title){const node=el('details');node.append(el('summary',title));return node;}
 let busy=false,uncertain=false,operationSerial=0,actionPicker,actionSearch,actionOptionList,actionSearchStatus,addActionButton,actionPickerOpen=false,activeActionOption=-1,activeActionId='';const actionButtons=[],extraControls=[];
 function syncControls(){for(const input of extraControls)input.disabled=busy||uncertain||!backendReady;for(const b of actionButtons)b.disabled=busy||uncertain||(b.needsBackend&&!backendReady);edition.disabled=busy||uncertain||!backendReady;for(const row of presetRows.values()){row.gift.disabled=busy||uncertain||!backendReady;row.giftButton.disabled=busy||uncertain||!backendReady;if(row.quantity)row.quantity.disabled=busy||uncertain||!backendReady;if(row.enabled.tagName==='input'&&row.enabled.type==='checkbox')row.enabled.disabled=busy||uncertain||!backendReady||!row.gift.value;}if(actionPicker)actionPicker.disabled=busy||uncertain||!backendReady||!selectedActionsByEdition.has(currentEdition);if(actionSearch)actionSearch.disabled=busy||uncertain||!backendReady||!selectedActionsByEdition.has(currentEdition);if(addActionButton)addActionButton.disabled=busy||uncertain||!backendReady||!selectedActionsByEdition.has(currentEdition)||!actionPicker?.value||selectedActionsByEdition.get(currentEdition)?.includes(actionPicker.value);}
 async function operate(fn){
  if(busy||uncertain)return;
  busy=true;operationSerial++;epoch++;clearTimeout(timer);syncControls();
  try{await fn();}catch(e){notice.textContent=e.message;}
  finally{busy=false;epoch++;syncControls();void refresh();}
 }
 const button=(text,fn,needsBackend=true)=>{const b=el('button',text);b.type='button';b.needsBackend=needsBackend;b.onclick=()=>{if(needsBackend&&!backendReady)return;return operate(fn);};actionButtons.push(b);return b};
 let backendReady=false,authorizationReady=false,confirmedAuthorized=false,savedConfig={commands:{}};
 const header=el('div');header.className='minecraft-header';const heading=el('h2','Minecraft');header.append(heading);pane.append(header);
 const statusStrip=el('div');statusStrip.className='minecraft-status-strip';statusStrip.setAttribute('aria-label','Estado y conexión de Minecraft');pane.append(statusStrip);
 const editionLabel=el('label','Edición'),edition=el('select');
 for(const [value,text] of [['java','Java (RCON)'],['bedrock','Bedrock (mundo local)']]){const option=el('option',text);option.value=value;edition.append(option);}
 edition.value='java';editionLabel.append(edition);statusStrip.append(editionLabel);
 const permissionArea=el('div');permissionArea.className='minecraft-permission';pane.append(permissionArea);
 const connectionNotice=el('p');connectionNotice.setAttribute('role','status');connectionNotice.hidden=true;permissionArea.append(connectionNotice);
 const connection=disclosure('Conexión Java');connection.className='minecraft-connection';const connectionFields=el('div');connectionFields.className='minecraft-connection-fields';connection.append(connectionFields);pane.append(connection);
 const quickActions=el('section');quickActions.className='minecraft-quick-actions';pane.append(quickActions);
 const host=field('Dirección privada','text',connectionFields),port=field('Puerto RCON','number',connectionFields),password=field('Contraseña RCON','password',connectionFields);
 host.value='127.0.0.1';port.value=25575;
 const advanced=disclosure('Ritmo y cola');
 advanced.append(el('p','Define cuántos objetos pueden salir en un periodo. Cada objeto se ejecuta por separado, con una pausa entre acciones.'));
 const nameFormatLabel=el('label','Nombres de mobs en Java'),nameFormat=el('select');for(const [id,text] of [['modern','Java 1.21.5 o posterior'],['legacy','Java 1.13 a 1.21.4']]){const option=el('option',text);option.value=id;nameFormat.append(option);}nameFormat.value='modern';nameFormatLabel.append(nameFormat);advanced.append(nameFormatLabel,el('small','El formato se guarda con Guardar ritmo.'));nameFormat.addEventListener('change',()=>edited.add(nameFormat));
 const commands=field('Comandos autorizados: un alias = comando por línea','textarea',advanced);commands.rows=4;
 const status=el('p','Sin conectar'),log=el('div');status.className='minecraft-connection-status';status.setAttribute('role','status');statusStrip.append(status);
 const localInstructions=el('div'),connectCommand=el('input'),commandRow=el('div'),requirements=el('small');
 localInstructions.className='minecraft-bedrock-setup';connectCommand.className='minecraft-connect-command';commandRow.className='minecraft-command-row';commandRow.hidden=true;
 requirements.className='minecraft-bedrock-requirement';requirements.append(el('span','*'),document.createTextNode(' Mundo local de Windows · Trucos activados · Require Encrypted Websockets desactivado.'));
 connectCommand.className='minecraft-connect-command';connectCommand.dataset.bedrockCommand='true';connectCommand.type='text';connectCommand.setAttribute('aria-label','Comando para conectar Minecraft');connectCommand.readOnly=true;connectCommand.hidden=true;
 commandRow.append(connectCommand);
 localInstructions.append(el('p','Prepara la conexión. TikReader comprobará si tu mundo responde.'),el('p','Abre el chat de tu mundo, pega el comando y presiona Enter.'),requirements);
 permissionArea.append(localInstructions);
 let currentEdition='java';const drafts=new Map();
 const quantityDrafts=new Map();let quantityRecovery=null;
 function rowDrafts(){if(!quantityDrafts.has(currentEdition))quantityDrafts.set(currentEdition,{});return quantityDrafts.get(currentEdition);}
 const presetRows=new Map(),selectedActionsByEdition=new Map(),pendingPresetEnabled=new Map();let presetValues={},presetDirty=false,presetRecovery=false,giftCatalog=[],giftCatalogSignature='',giftOptionData=[];
 const defaultActions=[
  {
    "id": "tnt_rain",
    "name": "Lluvia de TNT",
    "description": "TNT",
    "category": "actions",
    "quantity": 5,
    "section": "environment"
  },
  {
    "id": "zombie",
    "name": "Zombi",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "rain",
    "name": "Lluvia",
    "description": "Clima",
    "category": "actions",
    "section": "environment"
  },
  {
    "id": "thunder",
    "name": "Tormenta",
    "description": "Clima",
    "category": "actions",
    "section": "environment"
  },
  {
    "id": "night",
    "name": "Noche",
    "description": "Hora",
    "category": "actions",
    "section": "environment"
  },
  {
    "id": "diamonds",
    "name": "Diamantes",
    "description": "5 diamantes",
    "category": "actions",
    "section": "items"
  },
  {
    "id": "speed",
    "name": "Velocidad II",
    "description": "20 s",
    "category": "actions",
    "section": "abilities"
  },
  {
    "id": "jump",
    "name": "Salto II",
    "description": "20 s",
    "category": "actions",
    "section": "abilities"
  },
  {
    "id": "heal",
    "name": "Curación II",
    "description": "Instantánea",
    "category": "actions",
    "section": "abilities"
  },
  {
    "id": "pig",
    "name": "Cerdo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "cow",
    "name": "Vaca",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "sheep",
    "name": "Oveja",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "chicken",
    "name": "Gallina",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "bee",
    "name": "Abeja",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "armadillo",
    "name": "Armadillo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "horse",
    "name": "Caballo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "donkey",
    "name": "Burro",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "mule",
    "name": "Mula",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "camel",
    "name": "Camello",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "rabbit",
    "name": "Conejo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "cat",
    "name": "Gato",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "wolf",
    "name": "Lobo",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "fox",
    "name": "Zorro",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "ocelot",
    "name": "Ocelote",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "panda",
    "name": "Panda",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "polar_bear",
    "name": "Oso polar",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "goat",
    "name": "Cabra",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "llama",
    "name": "Llama",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "trader_llama",
    "name": "Llama del comerciante",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "mooshroom",
    "name": "Champiñaca",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "parrot",
    "name": "Loro",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "bat",
    "name": "Murciélago",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "sniffer",
    "name": "Rastreador",
    "description": "Mob",
    "category": "animals",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "axolotl",
    "name": "Ajolote",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "frog",
    "name": "Rana",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "tadpole",
    "name": "Renacuajo",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "turtle",
    "name": "Tortuga",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "dolphin",
    "name": "Delfín",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "squid",
    "name": "Calamar",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "glow_squid",
    "name": "Calamar brillante",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "cod",
    "name": "Bacalao",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "salmon",
    "name": "Salmón",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "tropical_fish",
    "name": "Pez tropical",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "pufferfish",
    "name": "Pez globo",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "nautilus",
    "name": "Nautilo",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "guardian",
    "name": "Guardián",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "elder_guardian",
    "name": "Guardián anciano",
    "description": "Mob",
    "category": "aquatic",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "villager",
    "name": "Aldeano",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "wandering_trader",
    "name": "Comerciante ambulante",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "allay",
    "name": "Allay",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "iron_golem",
    "name": "Gólem de hierro",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "snow_golem",
    "name": "Gólem de nieve",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "copper_golem",
    "name": "Gólem de cobre",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "happy_ghast",
    "name": "Ghast feliz",
    "description": "Mob",
    "category": "helpers",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "skeleton",
    "name": "Esqueleto",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "drowned",
    "name": "Ahogado",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "husk",
    "name": "Zombi momificado",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "zombie_villager",
    "name": "Aldeano zombi",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "zombie_horse",
    "name": "Caballo zombi",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "camel_husk",
    "name": "Camello momificado",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "zombie_nautilus",
    "name": "Nautilo zombi",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "stray",
    "name": "Esqueleto glacial",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "bogged",
    "name": "Esqueleto pantanoso",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "parched",
    "name": "Esqueleto reseco",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "skeleton_horse",
    "name": "Caballo esqueleto",
    "description": "Mob",
    "category": "undead",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "creeper",
    "name": "Creeper",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "spider",
    "name": "Araña",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "cave_spider",
    "name": "Araña de cueva",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "slime",
    "name": "Slime",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "silverfish",
    "name": "Lepisma",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "phantom",
    "name": "Fantasma",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "witch",
    "name": "Bruja",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "pillager",
    "name": "Saqueador",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "vindicator",
    "name": "Vindicador",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "evoker",
    "name": "Invocador",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "vex",
    "name": "Vex",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "ravager",
    "name": "Devastador",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "breeze",
    "name": "Breeze",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "creaking",
    "name": "Crujidor",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "sulfur_cube",
    "name": "Cubo de azufre",
    "description": "Mob",
    "category": "hostile",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "blaze",
    "name": "Blaze",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "ghast",
    "name": "Ghast",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "magma_cube",
    "name": "Cubo de magma",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "hoglin",
    "name": "Hoglin",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "zoglin",
    "name": "Zoglin",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "piglin",
    "name": "Piglin",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "piglin_brute",
    "name": "Piglin bruto",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "zombified_piglin",
    "name": "Piglin zombificado",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "wither_skeleton",
    "name": "Esqueleto wither",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "strider",
    "name": "Lavagante",
    "description": "Mob",
    "category": "nether",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "enderman",
    "name": "Enderman",
    "description": "Mob",
    "category": "end",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "endermite",
    "name": "Endermite",
    "description": "Mob",
    "category": "end",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "shulker",
    "name": "Shulker",
    "description": "Mob",
    "category": "end",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "warden",
    "name": "Warden",
    "description": "Mob",
    "category": "bosses",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "wither",
    "name": "Wither",
    "description": "Mob",
    "category": "bosses",
    "quantity": 1,
    "section": "mobs"
  },
  {
    "id": "ender_dragon",
    "name": "Dragón del End",
    "description": "Mob",
    "category": "bosses",
    "quantity": 1,
    "note": "La visibilidad del nombre depende de Minecraft.",
    "section": "mobs"
  }
];
 const compatibility=el('p','Conectando con TikReader…');compatibility.className='minecraft-compatibility';
 const catalogNotice=el('p'),actionList=el('div');catalogNotice.setAttribute('role','status');actionList.id='minecraft-actions-list';actionList.className='minecraft-actions-list';actionList.dataset.actionsList='true';
 const sectionOptions=[['environment','Ambiente'],['abilities','Habilidades'],['items','Objetos'],['mobs','Mobs']];
 const categoryOptions=[['animals','Animales'],['aquatic','Acuáticos'],['helpers','Ayudantes'],['undead','No-muertos'],['hostile','Hostiles'],['nether','Nether'],['end','End'],['bosses','Jefes']];
 const categoryGroupStarts=new Map([['animals','Superficie'],['nether','Dimensiones'],['bosses','Encuentros']]);
 const actionSearchAliases={tnt_rain:['TNT','lluvia de explosivos'],diamonds:['dar diamantes','dar objetos','dar objeto','entregar diamantes']};
 const actionSearchLimit=8;
 const actionFilterOptions=[['all','Todos'],...sectionOptions],actionFilterButtons=new Map();
 let currentActionFilter='all',currentMobCategory='all',mobCategorySignature='';
 const actionFilterToolbar=el('div');actionFilterToolbar.className='minecraft-action-filters';actionFilterToolbar.setAttribute('role','toolbar');actionFilterToolbar.setAttribute('aria-label','Filtrar acciones por sección');actionFilterToolbar.setAttribute('aria-orientation','horizontal');
 const actionCategoryLabel=el('label');actionCategoryLabel.className='minecraft-action-category-filter';actionCategoryLabel.append(el('span','Categoría de mob'));
 const actionCategoryFilter=el('select');actionCategoryFilter.role='combobox';actionCategoryFilter.dataset.actionCategoryFilter='true';actionCategoryFilter.setAttribute('aria-label','Filtrar mobs por categoría');actionCategoryFilter.hidden=true;actionCategoryLabel.append(actionCategoryFilter);actionCategoryLabel.hidden=true;
 const actionEmptyState=el('p','No hay acciones añadidas. Usa “Agregar acción” para elegir una.');actionEmptyState.className='minecraft-empty-actions';actionEmptyState.dataset.actionEmpty='true';
 const actionStorageKey=edition=>`tikreader.minecraft.actions.v1.${edition}`;
 const actionById=new Map(defaultActions.map(action=>[action.id,action]));
 function persistSelectedActions(edition){try{localStorage.setItem(actionStorageKey(edition),JSON.stringify(selectedActionsByEdition.get(edition)||[]));return true;}catch(_){return false;}}
 function selectedActions(edition,confirmed=false,values={}){
  if(!selectedActionsByEdition.has(edition)){
   if(!confirmed)return [];
   let selected=[],explicit=false;
   try{
    const raw=localStorage.getItem(actionStorageKey(edition));
    if(raw!==null){
     const saved=JSON.parse(raw);
     if(Array.isArray(saved)){
      const allowed=saved.filter(id=>typeof id==='string'&&actionById.has(id));
      if(saved.length===0||allowed.length){explicit=true;selected=[...new Set(allowed)];}
     }
    }
   }catch(_){}
   if(!explicit&&confirmed)selected=defaultActions.filter(action=>values[action.id]?.enabled||values[action.id]?.gift_id).map(action=>action.id);
   selectedActionsByEdition.set(edition,selected);
   if(confirmed&&!explicit)persistSelectedActions(edition);
  }
  const selected=selectedActionsByEdition.get(edition);
  if(confirmed){
   let changed=false;
   for(const action of defaultActions)if(values[action.id]?.enabled&&!selected.includes(action.id)){selected.push(action.id);changed=true;}
   if(changed)persistSelectedActions(edition);
  }
  return selected;
 }
 for(const [id,name] of actionFilterOptions){
  const filter=el('button',`${name} · 0`);filter.type='button';filter.onclick=()=>setActionFilter(id);filter.dataset.actionFilter=id;filter.setAttribute('aria-pressed',String(id==='all'));filter.setAttribute('aria-controls',actionList.id);filter.tabIndex=id==='all'?0:-1;
  filter.addEventListener('keydown',event=>navigateActionFilters(event,id));actionFilterButtons.set(id,filter);actionFilterToolbar.append(filter);
 }
 function navigateActionFilters(event,id){
  const index=actionFilterOptions.findIndex(([key])=>key===id);let next;
  if(event.key==='ArrowRight')next=(index+1)%actionFilterOptions.length;
  else if(event.key==='ArrowLeft')next=(index+actionFilterOptions.length-1)%actionFilterOptions.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=actionFilterOptions.length-1;
  if(next===undefined)return;
  event.preventDefault();event.stopPropagation?.();const target=actionFilterButtons.get(actionFilterOptions[next][0]);target.focus();setActionFilter(actionFilterOptions[next][0]);
 }
 function setActionFilter(id){
  if(!actionFilterButtons.has(id))return;
  currentActionFilter=id;updateActionViews(selectedActionsByEdition.get(currentEdition)||[]);
 }
 function updateMobCategoryOptions(selected){
  const counts=new Map();for(const id of selected){const preset=actionById.get(id);if(preset?.section==='mobs')counts.set(preset.category,(counts.get(preset.category)||0)+1);}
  if(currentMobCategory!=='all'&&!counts.has(currentMobCategory))currentMobCategory='all';
  const signature=JSON.stringify([...counts]);if(signature===mobCategorySignature){actionCategoryFilter.value=currentMobCategory;return;}mobCategorySignature=signature;
  const all=el('option','Todas las categorías');all.value='all';actionCategoryFilter.replaceChildren(all);
  let group;
  const flushGroup=()=>{if(group?.children.length)actionCategoryFilter.append(group);group=null;};
  for(const [id,name] of categoryOptions){
   if(categoryGroupStarts.has(id)){flushGroup();group=el('optgroup');group.label=categoryGroupStarts.get(id);}
   if(!counts.has(id))continue;
   const option=el('option',`${name} · ${counts.get(id)}`);option.value=id;(group||actionCategoryFilter).append(option);
  }
  flushGroup();actionCategoryFilter.value=currentMobCategory;
 }
 function updateActionViews(selected){
  const selectedSet=new Set(selected),visibleRows=[];
  for(const [id,name] of actionFilterOptions){
   const count=id==='all'?selected.length:selected.filter(actionId=>actionById.get(actionId)?.section===id).length,filter=actionFilterButtons.get(id);
   filter.textContent=`${name} · ${count}`;filter.setAttribute('aria-label',`${name}, ${count} ${count===1?'acción añadida':'acciones añadidas'}`);filter.setAttribute('aria-pressed',String(currentActionFilter===id));filter.tabIndex=currentActionFilter===id?0:-1;
  }
  updateMobCategoryOptions(selected);actionCategoryLabel.hidden=currentActionFilter!=='mobs';actionCategoryFilter.hidden=currentActionFilter!=='mobs';
  for(const row of presetRows.values()){
   const preset=actionById.get(row.id),inSection=currentActionFilter==='all'||preset?.section===currentActionFilter,inCategory=currentActionFilter!=='mobs'||currentMobCategory==='all'||preset?.category===currentMobCategory;
   row.node.hidden=!(selectedSet.has(row.id)&&inSection&&inCategory);if(!row.node.hidden)visibleRows.push(row);
  }
  actionEmptyState.hidden=visibleRows.length>0;
  if(currentActionFilter==='all')actionEmptyState.textContent='No hay acciones añadidas. Usa “Agregar acción” para elegir una.';
  else if(currentActionFilter==='mobs')actionEmptyState.textContent='No hay mobs en esta categoría. Agrega un mob o elige otra categoría.';
  else actionEmptyState.textContent='No hay acciones en esta sección. Usa “Todos” o “Agregar acción” para elegir una.';
 }
 function updatePresetState(row,preset,active){
  if(!row.gift.value){
   if(row.enabled.tagName!=='span'){
    const prompt=el('span','Selecciona un regalo');prompt.className='minecraft-action-state-empty';prompt.dataset.presetEnabled=row.id;
    row.enabledLabel.replaceChildren(prompt);row.enabled=prompt;
   }else row.enabled.textContent='Selecciona un regalo';
   return;
  }
  if(row.enabled.tagName!=='input'||row.enabled.type!=='checkbox'){
   const toggle=el('input');toggle.type='checkbox';toggle.className='minecraft-action-state';toggle.dataset.presetEnabled=row.id;
   toggle.addEventListener('change',()=>togglePreset(row.id));
   row.enabledLabel.replaceChildren(toggle);row.enabled=toggle;
  }
  active=!!active;row.enabled.checked=active;
  row.enabled.setAttribute('aria-label',`${preset.name}: ${active?'Activa. Pausar acción':'Pausada. Activar acción'}`);
  row.enabled.setAttribute('title',`${preset.name}: ${active?'Pausar acción':'Activar acción'}`);
 }
 async function togglePreset(id){
  const row=presetRows.get(id),preset=actionById.get(id);
  if(!row||!preset||!row.gift.value||busy||uncertain||!backendReady)return;
  const active=!!row.enabled.checked;let pending=pendingPresetEnabled.get(currentEdition);if(!pending){pending=new Map();pendingPresetEnabled.set(currentEdition,pending);}pending.set(id,active);updatePresetState(row,preset,active);
  return savePreset(id);
 }
 function fillGiftOptions(row,value){
  const signature=`${giftCatalogSignature}|${value.gift_id}|${value.gift_name}`;
  if(row.signature!==signature){
   const options=[{id:'',name:'Selecciona un regalo',label:'Selecciona un regalo'},...giftOptionData];
   if(value.gift_id&&!giftOptionData.some(item=>item.id===value.gift_id))options.push({id:value.gift_id,name:value.gift_name||value.gift_id,label:`${value.gift_name||value.gift_id} · guardado`});
   row.gift.replaceChildren(...options.map(item=>{const option=el('option',item.label);option.value=item.id;return option;}));
   row.giftOptions=options;
   row.signature=signature;
  }
  if(row.gift.value!==value.gift_id)row.gift.value=value.gift_id;
  renderGiftOptionList(row);
  const selected=row.giftOptions.find(item=>item.id===row.gift.value);
  row.giftButton.replaceChildren(giftImage(selected||{name:'Selecciona un regalo'}),el('span',selected?.label||'Selecciona un regalo'));
  row.giftButton.title=selected?.name||'Selecciona un regalo';
  row.giftButton.setAttribute('aria-expanded',String(!row.giftPicker.hidden));
  for(const option of row.giftListbox.children)option.setAttribute('aria-selected',String(option.dataset.giftId===row.gift.value));
  updatePresetState(row,actionById.get(row.id),value.enabled);
  if(row.quantity&&document.activeElement!==row.quantity)row.quantity.value=rowDrafts()[row.id]??value.quantity??row.defaultQuantity;
 }
 function renderGiftOptionList(row){
  const query=String(row.giftSearch.value||'').trim().toLocaleLowerCase();
  const options=row.giftOptions.filter(item=>!query||!!item.id&&String(item.name||'').toLocaleLowerCase().includes(query));
  row.giftListbox.replaceChildren(...options.map(item=>{
    const option=el('div');option.className='minecraft-gift-option';option.setAttribute('role','option');option.tabIndex=-1;option.dataset.giftId=item.id;option.setAttribute('aria-selected','false');option.title=item.name;
    const image=giftImage(item);option.append(image,el('span',item.label));
    option.addEventListener('click',()=>chooseGift(row,item.id));
    option.addEventListener('keydown',event=>giftOptionKeydown(event,row,option));
    return option;
  }));
  const empty=!!query&&!options.length;
  row.giftResults.hidden=!empty;
  row.giftResults.textContent=empty?'No hay regalos que coincidan. Prueba con otro nombre.':'';
 }
 function giftImage(item){
  const image=document.createElement('img');image.className='minecraft-gift-image';image.alt='';image.setAttribute('aria-hidden','true');image.referrerPolicy='no-referrer';
  let url;try{url=new URL(item?.image_url||'');}catch(_){}
  if(url?.protocol==='https:'){image.src=url.href;image.title=item?.name||'';image.onerror=()=>{const fallback=el('span','◆');fallback.className='minecraft-gift-fallback';fallback.setAttribute('aria-hidden','true');image.replaceWith(fallback);};return image;}
  const fallback=el('span','◆');fallback.className='minecraft-gift-fallback';fallback.setAttribute('aria-hidden','true');return fallback;
 }
 function closeGiftPicker(row,restoreFocus=false){row.giftPicker.hidden=true;row.giftButton.setAttribute('aria-expanded','false');if(restoreFocus)row.giftButton.focus();}
 function openGiftPicker(row,edge='selected'){
  if(row.giftButton.disabled)return;
  row.giftPicker.hidden=false;row.giftButton.setAttribute('aria-expanded','true');
  const options=[...row.giftListbox.children];
  if(edge==='first')options[0]?.focus();else if(edge==='last')options.at(-1)?.focus();else row.giftSearch.focus();
 }
 function giftOptionKeydown(event,row,option){
  const options=[...row.giftListbox.children],index=options.indexOf(option);let next;
  if(event.key==='ArrowDown')next=(index+1)%options.length;
  else if(event.key==='ArrowUp'){if(index===0){event.preventDefault();row.giftSearch.focus();return;}next=index-1;}
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=options.length-1;
  else if(event.key==='Escape'){event.preventDefault();closeGiftPicker(row,true);return;}
  else if(event.key==='Enter'||event.key===' '){event.preventDefault();void chooseGift(row,option.dataset.giftId);return;}
  else return;
  event.preventDefault();options[next]?.focus();
 }
 function chooseGift(row,id){
  row.gift.value=id;closeGiftPicker(row,true);
  fillGiftOptions(row,{...presetValues[row.id],gift_id:id,gift_name:giftCatalog.find(g=>String(g.id)===id)?.name||presetValues[row.id]?.gift_name||''});
  return savePreset(row.id);
 }
 function actionIcon(kind){
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','18');svg.setAttribute('height','18');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');
  path.setAttribute('d',kind==='test'?'M8 5v14l11-7z':kind==='remove'?'M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3':'');if(kind==='test')path.setAttribute('fill','currentColor');svg.append(path);return svg;
 }
 function createPresetRow(preset){
  const node=el('div');node.className='minecraft-action-row';node.dataset.quickAction=preset.id;
  const title=el('div');title.className='minecraft-action-title';
  const context=preset.section==='mobs'?`Mobs · ${categoryOptions.find(([id])=>id===preset.category)?.[1]||'Mobs'}`:sectionOptions.find(([id])=>id===preset.section)?.[1]||preset.section;
  const contextLabel=el('small',context);contextLabel.className='minecraft-action-context';title.append(el('strong',preset.name),el('small',preset.description),contextLabel);
  if(preset.note){const note=el('small',preset.note);note.className='minecraft-action-note';title.append(note);}
  const gift=el('select');gift.hidden=true;gift.dataset.presetGift=preset.id;gift.setAttribute('aria-label','Regalo para '+preset.name);
  const giftControl=el('div');giftControl.className='minecraft-gift-picker';
  const giftButton=el('button','Selecciona un regalo');giftButton.type='button';giftButton.className='minecraft-gift-trigger';giftButton.setAttribute('aria-label','Regalo para '+preset.name);giftButton.setAttribute('aria-haspopup','listbox');giftButton.setAttribute('aria-expanded','false');giftButton.onclick=()=>row.giftPicker.hidden?openGiftPicker(row):closeGiftPicker(row);
 giftButton.addEventListener('keydown',event=>{if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();openGiftPicker(row,event.key==='ArrowUp'?'last':'selected');}});
  const giftPicker=el('div');giftPicker.className='minecraft-gift-options';giftPicker.hidden=true;
  const giftSearch=el('input');giftSearch.type='search';giftSearch.className='minecraft-gift-search';giftSearch.dataset.giftSearch=preset.id;giftSearch.placeholder='Buscar regalo';giftSearch.setAttribute('aria-label','Buscar regalos para '+preset.name);giftSearch.setAttribute('autocomplete','off');
  const giftListbox=el('div');giftListbox.className='minecraft-gift-listbox';giftListbox.setAttribute('role','listbox');giftListbox.setAttribute('aria-label','Regalos para '+preset.name);
  const giftResults=el('div');giftResults.className='minecraft-gift-results';giftResults.dataset.giftResults=preset.id;giftResults.setAttribute('role','status');giftResults.setAttribute('aria-live','polite');giftResults.hidden=true;
  giftPicker.append(giftSearch,giftListbox,giftResults);
  giftSearch.addEventListener('input',()=>renderGiftOptionList(row));
  giftSearch.addEventListener('keydown',event=>{
   if(event.key==='Escape'){event.preventDefault();closeGiftPicker(row,true);}
   else if(event.key==='ArrowDown'&&row.giftListbox.children.length){event.preventDefault();row.giftListbox.children[0].focus();}
   else if(event.key==='ArrowUp'&&row.giftListbox.children.length){event.preventDefault();row.giftListbox.children.at(-1).focus();}
  });
  giftControl.append(giftButton,giftPicker,gift);
  const enabled=el('span','Selecciona un regalo');enabled.className='minecraft-action-state-empty';enabled.dataset.presetEnabled=preset.id;
  const enabledLabel=el('div');enabledLabel.className='minecraft-action-enabled';enabledLabel.append(enabled);
  const quantityLabel=el(preset.quantity?'label':'span');quantityLabel.className='minecraft-action-quantity';let quantity;
  if(preset.quantity){quantity=el('input');quantity.type='number';quantity.min=1;quantity.max=20;quantity.step=1;quantity.value=preset.quantity;quantity.dataset.presetQuantity=preset.id;quantity.setAttribute('aria-label','Cantidad de '+preset.name);quantityLabel.append(el('span','Cantidad'),quantity);quantity.addEventListener('input',()=>{rowDrafts()[preset.id]=quantity.value;});quantity.addEventListener('change',()=>savePreset(preset.id));}
  const test=button('',async()=>{await api('/minecraft/presets/test',{edition:currentEdition,id:preset.id});notice.textContent='Prueba en cola. Revisa el registro.';});test.append(actionIcon('test'));test.setAttribute('aria-label','Probar acción: '+preset.name);test.setAttribute('title','Probar acción: '+preset.name);test.className='minecraft-action-test';
  const remove=button('',async()=>removePreset(preset.id));remove.append(actionIcon('remove'));remove.dataset.removeAction=preset.id;remove.setAttribute('aria-label','Quitar acción: '+preset.name);remove.setAttribute('title','Quitar acción: '+preset.name);remove.className='minecraft-action-remove';
  node.append(title,giftControl,quantityLabel,enabledLabel,test,remove);const row={node,gift,giftButton,giftPicker,giftSearch,giftListbox,giftResults,enabled,enabledLabel,quantity,id:preset.id,defaultQuantity:preset.quantity,signature:''};presetRows.set(preset.id,row);
  gift.addEventListener('change',()=>savePreset(preset.id));
  return row;
 }
 function renderPresets(d,force=false){
  if(force||!presetDirty)presetValues=structuredClone(d.presets||d.config?.presets||{});
  for(const [id,enabled] of pendingPresetEnabled.get(currentEdition)||[]){
   if(presetValues[id]?.enabled===enabled)pendingPresetEnabled.get(currentEdition)?.delete(id);
   else presetValues={...presetValues,[id]:{...presetValues[id],enabled}};
  }
  const confirmed=d.authorization_mode==='automatic',selected=selectedActions(currentEdition,confirmed,presetValues),selectedSet=new Set(selected);
  for(const [id,row] of presetRows)if(!selectedSet.has(id)&&row.node.isConnected)row.node.remove();
  for(const id of selected){
   const preset=actionById.get(id);if(!preset)continue;
   const row=presetRows.get(id)||createPresetRow(preset);
   if(row.node.parentElement!==actionList||!row.node.isConnected)actionList.append(row.node);
   fillGiftOptions(row,presetValues[id]||{gift_id:'',gift_name:'',enabled:false,quantity:preset.quantity});
  }
  updateActionViews(selected);updateActionPicker();syncControls();
 }
 function updateActionPicker(){
  if(!actionPicker)return;
  const selected=new Set(selectedActionsByEdition.get(currentEdition)||[]);
  for(const option of actionPicker.children)if(option.value)option.disabled=selected.has(option.value);
  if(actionPicker.value&&selected.has(actionPicker.value))actionPicker.value='';
  if(!selectedActionsByEdition.has(currentEdition))actionPicker.disabled=true;
  if(actionSearch)actionSearch.disabled=actionPicker.disabled||busy||uncertain;
  if(addActionButton)addActionButton.disabled=busy||uncertain||!actionPicker.value||selected.has(actionPicker.value);
  if(actionPickerOpen&&actionSearch&&actionOptionList)renderActionOptions(actionSearch.value);
 }
 function normalizeActionSearch(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es-MX').trim();}
 function actionSectionLabel(preset){return preset.section==='mobs'?categoryOptions.find(([id])=>id===preset.category)?.[1]||'Mobs':sectionOptions.find(([id])=>id===preset.section)?.[1]||preset.section;}
 function actionSearchText(preset){return normalizeActionSearch([preset.name,preset.description,preset.id,actionSectionLabel(preset),preset.category,...(actionSearchAliases[preset.id]||[])].join(' '));}
 function renderActionOptions(query=''){
  if(!actionOptionList)return;
  const selected=new Set(selectedActionsByEdition.get(currentEdition)||[]),needle=normalizeActionSearch(query),previousActiveId=activeActionId;
  const matches=defaultActions.filter(preset=>!selected.has(preset.id)&&(!needle||actionSearchText(preset).includes(needle))).slice(0,actionSearchLimit);
  actionOptionList.replaceChildren();activeActionOption=-1;activeActionId='';
  for(const preset of matches){
   const option=el('div');option.id='minecraft-action-option-'+preset.id;option.dataset.actionOption=preset.id;option.setAttribute('role','option');option.setAttribute('aria-selected',String(actionPicker.value===preset.id));option.tabIndex=-1;
   option.textContent=`${preset.name} · ${actionSectionLabel(preset)} · ${preset.description}`;option.setAttribute('aria-label',option.textContent);
   option.addEventListener('pointerdown',event=>event.preventDefault());option.addEventListener('click',()=>chooseActionOption(preset.id));actionOptionList.append(option);
  }
  activeActionOption=matches.findIndex(preset=>preset.id===previousActiveId);
  if(activeActionOption>=0){activeActionId=previousActiveId;const option=actionOptionList.children[activeActionOption];option.dataset.activeOption='true';option.setAttribute('aria-selected','true');}
  actionSearchStatus.textContent=matches.length?`${matches.length} ${matches.length===1?'acción disponible':'acciones disponibles'}`:'No hay acciones que coincidan.';
  actionOptionList.hidden=!actionPickerOpen;
  actionSearch.setAttribute('aria-expanded',String(actionPickerOpen));
  actionSearch.setAttribute('aria-activedescendant',activeActionOption>=0?actionOptionList.children[activeActionOption].id:'');
 }
 function openActionPicker(){actionPickerOpen=true;renderActionOptions(actionSearch.value);}
 function closeActionPicker(){actionPickerOpen=false;activeActionOption=-1;activeActionId='';actionOptionList.hidden=true;actionSearch.setAttribute('aria-expanded','false');actionSearch.setAttribute('aria-activedescendant','');for(const option of actionOptionList.children)option.dataset.activeOption='false';}
 function chooseActionOption(id){
  const preset=actionById.get(id);if(!preset)return;
  actionPicker.value=id;actionSearch.value=preset.name;closeActionPicker();updateActionPicker();
 }
 function onActionSearchKeydown(event){
  const options=actionOptionList.children;
  if(event.key==='ArrowDown'||event.key==='ArrowUp'){
   event.preventDefault();if(!actionPickerOpen)openActionPicker();
   if(options.length){for(const option of options){option.dataset.activeOption='false';option.setAttribute('aria-selected','false');}activeActionOption=activeActionOption<0?(event.key==='ArrowDown'?0:options.length-1):(activeActionOption+(event.key==='ArrowDown'?1:-1)+options.length)%options.length;activeActionId=options[activeActionOption].dataset.actionOption;options[activeActionOption].dataset.activeOption='true';options[activeActionOption].setAttribute('aria-selected','true');options[activeActionOption].scrollIntoView?.({block:'nearest'});actionSearch.setAttribute('aria-activedescendant',options[activeActionOption].id);}
  }else if(event.key==='Enter'&&actionPickerOpen){
   event.preventDefault();const option=options[activeActionOption>=0?activeActionOption:0];if(option)chooseActionOption(option.dataset.actionOption);
  }else if(event.key==='Escape'&&actionPickerOpen){event.preventDefault();closeActionPicker();}
 }
 async function removePreset(id){
  const edition=currentEdition,selected=selectedActionsByEdition.get(edition)||[],row=presetRows.get(id),saved=presetValues[id];
  if(!row||!selected.includes(id)||uncertain)return;
  if(saved?.enabled){
   if(!backendReady){notice.textContent='No se puede quitar una acción activa hasta conectar con TikReader.';return;}
   try{
    const updated=structuredClone(presetValues);updated[id]={...saved,enabled:false};
    const d=await api('/minecraft/presets',{edition,presets:updated});
    if(currentEdition!==edition)return;
    presetValues=structuredClone(d.presets||d.config?.presets||updated);
   }catch(_){
    if(currentEdition===edition){uncertain=true;presetRecovery=true;notice.textContent='No se pudo confirmar que la acción quedara desactivada. Se conserva en la lista.';syncControls();}
    return;
   }
  }
  if(currentEdition!==edition)return;
  pendingPresetEnabled.get(edition)?.delete(id);
  selectedActionsByEdition.set(edition,selected.filter(actionId=>actionId!==id));persistSelectedActions(edition);
  renderPresets({authorization_mode:'automatic',presets:presetValues},true);
  notice.textContent='Acción quitada. Puedes volver a agregarla cuando quieras.';actionSearch.focus();
 }
 async function savePreset(id){
  if(busy||uncertain||!backendReady){renderPresets({presets:presetValues},true);return;}
  return operate(async()=>{
   const row=presetRows.get(id),giftId=row.gift.value;
   const name=giftCatalog.find(g=>String(g.id)===giftId)?.name||presetValues[id]?.gift_name||'';
   const enabled=row.enabled.tagName==='input'&&row.enabled.type==='checkbox'?!!row.enabled.checked:!!presetValues[id]?.enabled;
   presetValues={...presetValues,[id]:{gift_id:giftId,gift_name:name,enabled,...(row.quantity?{quantity:Number(row.quantity.value)}:{})}};presetDirty=true;
   try{
    const d=await api('/minecraft/presets',{edition:currentEdition,presets:presetValues});
    delete rowDrafts()[id];presetDirty=false;renderPresets(d,true);notice.textContent='Acciones rápidas guardadas.';
   }catch(e){
    pendingPresetEnabled.get(currentEdition)?.delete(id);
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
  try{const d=await api('/gift-catalog');setGiftCatalog(Array.isArray(d.gifts)?d.gifts:[]);catalogNotice.textContent=giftCatalog.length?'':'Conecta tu LIVE y actualiza los regalos.';}
  catch(_){catalogNotice.textContent='Regalos no disponibles. Puedes actualizar de nuevo.';}
  renderPresets({presets:presetValues,authorization_mode:authorizationReady?'automatic':undefined},true);
 }
 function setGiftCatalog(value){
  const next=Array.isArray(value)?value:[],signature=JSON.stringify(next.map(g=>[String(g.id),String(g.name||''),Number(g.diamonds)||0,String(g.image_url||'')]));
  giftCatalog=next;if(signature===giftCatalogSignature)return;
  giftCatalogSignature=signature;giftOptionData=next.map(g=>({id:String(g.id),name:String(g.name||g.id),label:g.diamonds?`${g.name||g.id} \u00b7 ${g.diamonds} diamantes`:String(g.name||g.id),image_url:g.image_url||''}));
 }
 const actionHeading=el('div');actionHeading.className='minecraft-actions-heading';
 const actionPickerLabel=el('label');actionPickerLabel.className='minecraft-action-picker';actionPickerLabel.append(el('span','Acción para agregar'));
 const actionPickerControl=el('div');actionPickerControl.className='minecraft-action-picker-control';
 actionSearch=el('input');actionSearch.type='search';actionSearch.className='minecraft-action-picker-select';actionSearch.dataset.actionSearch='true';actionSearch.setAttribute('role','combobox');actionSearch.setAttribute('aria-label','Acción para agregar');actionSearch.setAttribute('aria-haspopup','listbox');actionSearch.setAttribute('aria-autocomplete','list');actionSearch.setAttribute('aria-controls','minecraft-action-options');actionSearch.setAttribute('aria-expanded','false');actionSearch.placeholder='Buscar por nombre, tipo o efecto';
 actionOptionList=el('div');actionOptionList.id='minecraft-action-options';actionOptionList.className='minecraft-action-picker-results';actionOptionList.setAttribute('role','listbox');actionOptionList.setAttribute('aria-label','Acciones disponibles');actionOptionList.hidden=true;
 actionSearchStatus=el('span');actionSearchStatus.className='minecraft-action-picker-status';actionSearchStatus.setAttribute('role','status');actionSearchStatus.setAttribute('aria-live','polite');
 actionPicker=el('select');actionPicker.hidden=true;actionPicker.setAttribute('aria-hidden','true');actionPicker.dataset.actionPicker='true';
 const actionPlaceholder=el('option','Selecciona una acción');actionPlaceholder.value='';actionPicker.append(actionPlaceholder);
 for(const preset of defaultActions){const option=el('option',preset.name);option.value=preset.id;actionPicker.append(option);}
 actionPickerControl.append(actionSearch,actionOptionList,actionSearchStatus);actionPickerLabel.append(actionPickerControl,actionPicker);
 actionSearch.addEventListener('focus',openActionPicker);actionSearch.addEventListener('blur',()=>{if(actionPickerOpen)closeActionPicker();});actionSearch.addEventListener('click',()=>{if(!actionPickerOpen)openActionPicker();});actionSearch.addEventListener('input',()=>{actionPicker.value='';activeActionOption=-1;activeActionId='';updateActionPicker();openActionPicker();});actionSearch.addEventListener('keydown',onActionSearchKeydown);
 document.addEventListener('pointerdown',event=>{if(!actionPickerControl.contains(event.target))closeActionPicker();});actionPicker.addEventListener('change',()=>syncControls());
 addActionButton=button('Agregar acción',async()=>{const id=actionPicker.value,selected=selectedActionsByEdition.get(currentEdition),preset=actionById.get(id);if(!backendReady||!preset||!selected||selected.includes(id))return;const defaultEnabled=!presetValues[id]?.gift_id;if(defaultEnabled)presetValues={...presetValues,[id]:{...presetValues[id],enabled:true}};selected.push(id);persistSelectedActions(currentEdition);currentActionFilter='all';currentMobCategory='all';actionPicker.value='';actionSearch.value='';closeActionPicker();renderPresets({authorization_mode:'automatic',presets:presetValues},true);if(defaultEnabled){let pending=pendingPresetEnabled.get(currentEdition);if(!pending){pending=new Map();pendingPresetEnabled.set(currentEdition,pending);}pending.set(id,true);}notice.textContent='Acción agregada.';});addActionButton.dataset.addAction='true';
 actionHeading.append(el('h3','Acciones predeterminadas'),actionPickerLabel,addActionButton,button('Actualizar regalos',loadGiftCatalog,false));
 function makeColumns(){const columns=el('div');columns.className='minecraft-action-columns';columns.setAttribute('aria-hidden','true');for(const text of ['Acción','Regalo','Cantidad','Habilitar','Probar',''])columns.append(el('span',text));return columns;}
 const actionViewControls=el('div');actionViewControls.className='minecraft-action-view-controls';actionViewControls.append(actionFilterToolbar,actionCategoryLabel);
 actionCategoryFilter.addEventListener('change',()=>{currentMobCategory=actionCategoryFilter.value||'all';updateActionViews(selectedActionsByEdition.get(currentEdition)||[]);});
 actionList.append(makeColumns(),actionEmptyState);
 quickActions.append(actionHeading,el('p','Agrega acciones una vez y usa estos filtros para revisar la lista sin cambiar la configuración. Cantidad por regalo. Las rachas multiplican mobs y TNT; el exceso espera su turno.'),compatibility,catalogNotice,actionViewControls,actionList);
 const safetyFields=el('div');safetyFields.className='minecraft-tool-fields';
 const objects=field('Objetos por periodo','number',safetyFields),period=field('Periodo (segundos)','number',safetyFields),ratePreview=el('p');ratePreview.className='minecraft-rate-preview';
 objects.min=1;objects.max=120;objects.step=1;objects.value=20;period.min=20;period.max=600;period.step=1;period.value=30;
 function updateRatePreview(effectiveInterval=null){const count=Number(objects.value),seconds=Number(period.value),interval=effectiveInterval??(count>0&&seconds>0?seconds/count:0);objects.max=Math.min(120,seconds||120);period.min=Math.max(20,count||1);ratePreview.textContent=`${Number(interval.toFixed(2))} segundos por efecto`}
 objects.addEventListener('input',()=>{edited.add(objects);updateRatePreview()});period.addEventListener('input',()=>{edited.add(period);updateRatePreview()});updateRatePreview();
 async function saveSafety(){
  try{
   const d=await api('/minecraft/presets/settings',{
    edition:currentEdition,
    limits:{objects:Number(objects.value),period_seconds:Number(period.value)},
    name_format:nameFormat.value
   });
   for(const input of [objects,period,nameFormat])edited.delete(input);
   applySafety(d,true);notice.textContent='Ritmo guardado.';
  }catch(e){
   try{
    const d=await api('/minecraft');
    if(d.edition!==currentEdition)selectProfile(d);
    applySafety(d,true);notice.textContent=e.message+' Se muestra el ritmo confirmado.';
   }catch(_){
    uncertain=true;notice.textContent='No se pudo confirmar el guardado. Reintentando…';
   }
  }
 }
 safetyFields.append(ratePreview,button('Guardar ritmo',saveSafety));
 advanced.append(safetyFields,el('small','La cola conserva el trabajo mientras esperas, pausas o reconectas. No se libera todo junto.'));
 extraControls.push(objects,period,nameFormat);
 function applySafety(d,force=false){
  const values=d.limits||d.config?.limits||{objects:20,period_seconds:30};
  const count=values.objects??values.per_minute??20,seconds=values.period_seconds??60;
  for(const [input,value] of [[objects,count],[period,seconds],
                             [nameFormat,d.name_format||d.config?.name_format||'modern']]){
   if(force||!edited.has(input))input.value=value;
  }
  updateRatePreview(!('objects' in values)?d.effect_queue?.interval_seconds:null);
 }
 function captureDraft(){return {host:host.value,port:port.value,commands:commands.value,objects:objects.value,period:period.value,nameFormat:nameFormat.value};}
 function selectProfile(d){
  currentEdition=d.edition||currentEdition;edited.clear();hydratePending=false;
  password.value='';confirmedAuthorized=false;connectCommand.value='';connectCommand.hidden=true;commandRow.hidden=true;showEdition();
  const draft=drafts.get(currentEdition);
  host.value=draft?.host||d.config.host||'127.0.0.1';port.value=draft?.port||d.config.port||25575;
  commands.value=draft?draft.commands:Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n');
  presetDirty=false;renderPresets(d,true);applySafety(d,true);
  if(draft){for(const [input,value] of [[objects,draft.objects],[period,draft.period],[nameFormat,draft.nameFormat]])if(value!==undefined){input.value=value;edited.add(input);}updateRatePreview();}
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
  authorizationReady=d.authorization_mode==='automatic';
  backendReady=authorizationReady&&Array.isArray(d.preset_catalog)&&Array.isArray(d.preset_sections)&&sectionOptions.every(([id])=>d.preset_sections.some(section=>section.id===id))&&Array.isArray(d.preset_categories)&&categoryOptions.every(([id])=>d.preset_categories.some(c=>c.id===id))&&defaultActions.every(p=>d.preset_catalog.some(s=>s.id===p.id&&s.category===p.category&&s.section===p.section&&(!p.quantity||(s.quantity_max===20&&s.quantity_min===1))));
  compatibility.textContent=backendReady?'':'Reinicia TikReader para cargar estas acciones.';compatibility.hidden=backendReady;
  savedConfig=d.config||savedConfig;applySafety(d);
  const queue=d.effect_queue||{},remaining=Math.max(0,Number(queue.wave_seconds_remaining??queue.next_object_in_seconds??30));
  waveCountdown.textContent=`${Math.ceil(remaining)} s`;
  const pressure={normal:'normal',accumulating:'acumulando',saturated:'saturada · en espera, sin rechazar regalos'}[queue.pressure]||'normal';
  queueStatus.textContent=queue.paused?'Cola pausada. El trabajo pendiente se conserva.':queue.pending_count?`Cola ${pressure}: ${queue.remaining_objects??queue.pending_count} objetos pendientes.`:`Cola ${pressure}: sin objetos pendientes.`;
  queueControl.textContent=queue.paused?'Reanudar cola':'Pausar cola';
  function describeEffect(effect,empty){
   if(!effect)return empty;
   const preset=actionById.get(effect.preset_id),action=effect.action||preset?.name||effect.preset_id||'Acción';
   const donor=effect.donor||'Donante desconocido',gift=effect.gift||effect.gift_name||'Regalo desconocido';
   const amount=effect.remaining??0,progress=effect.step&&effect.total?` · paso ${effect.step} de ${effect.total}`:'';
   return `${donor} · ${gift} · ${action} · ${amount} restantes${progress}`;
  }
  nowCard.children[1].textContent=describeEffect(queue.current,'Sin efecto en ejecución.');
  nextCard.children[1].textContent=describeEffect(queue.next,'Sin objetos pendientes.');
  queueMetrics.replaceChildren(
   el('p',`Donaciones en cola: ${queue.pending_count||0}`),
   el('p',`Objetos pendientes: ${queue.remaining_objects??queue.pending_count??0}`),
   el('p',`Fallos: ${queue.failure_count||0}`),
   el('p',`Espera estimada: ${Math.ceil(Number(queue.estimated_wait_seconds||0))} s`),
   el('p',`Ritmo: ${Number(Number(queue.interval_seconds??(Number(period.value)/Number(objects.value))).toFixed(2))} s por efecto`),
   el('p',`Estado: ${pressure}`)
  );
  if(uncertain&&!busy){if(quantityRecovery){delete rowDrafts()[quantityRecovery];quantityRecovery=null;}selectProfile(d);uncertain=false;presetRecovery=false;presetDirty=false;syncControls();hydrate=false;}
  if(hydrate){currentEdition=d.edition||'java';showEdition();for(const [input,value] of [[host,d.config.host||'127.0.0.1'],[port,d.config.port||25575],[commands,Object.entries(d.config.commands).map(([a,c])=>a+' = '+c).join('\n')]])if(!edited.has(input))input.value=value;}
  const bedrock=currentEdition==='bedrock';
  if(!presetRecovery)renderPresets(d);
  confirmedAuthorized=authorizationReady&&d.authorized===true;
  status.textContent=(confirmedAuthorized?'Conectado':bedrock&&d.connection_check==='checking'?'Comprobando conexión…':bedrock&&d.bedrock?.connected?'Conexión sin comprobar':bedrock&&d.bedrock?.prepared?'Esperando tu mundo':'Sin conectar')+(d.queued?` · ${d.queued} en cola`:'');
  connectionNotice.hidden=!(bedrock&&d.connection_check==='failed');
  connectionNotice.textContent=connectionNotice.hidden?'':'No se pudo comprobar Bedrock. Desconecta, prepara otra conexión y pega el nuevo comando.';
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
   }catch(_){if(active()&&generation===epoch){backendReady=false;authorizationReady=false;confirmedAuthorized=false;compatibility.hidden=false;compatibility.textContent='No se pudo conectar con TikReader. Reintentando…';status.textContent='Sin conexión';syncControls();}}
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
 const prepareButton=button('Preparar conexión',async()=>{if(currentEdition!=='bedrock')return;confirmedAuthorized=false;connectCommand.value='';connectCommand.hidden=true;commandRow.hidden=true;const d=await api('/minecraft/bedrock/prepare',{});connectCommand.value=d.command;connectCommand.hidden=false;commandRow.hidden=false;notice.textContent='Comando listo para pegar en el chat de tu mundo.';},false);prepareButton.setAttribute('aria-label','Preparar conexión de Bedrock');
 const copyButton=button('',async()=>{if(!connectCommand.value){notice.textContent='Prepara la conexión primero.';return;}try{await navigator.clipboard.writeText(connectCommand.value);notice.textContent='Comando copiado.';}catch(_){connectCommand.focus();connectCommand.select();notice.textContent='Selecciona el comando y usa copiar para llevarlo al chat.';}} ,false);
 copyButton.setAttribute('aria-label','Copiar comando de conexión');
 copyButton.title='Copiar el comando de conexión';
 const copyIcon=document.createElementNS('http://www.w3.org/2000/svg','svg');copyIcon.setAttribute('viewBox','0 0 24 24');copyIcon.setAttribute('width','18');copyIcon.setAttribute('height','18');copyIcon.setAttribute('fill','none');copyIcon.setAttribute('stroke','currentColor');copyIcon.setAttribute('stroke-width','1.8');copyIcon.setAttribute('stroke-linecap','round');copyIcon.setAttribute('stroke-linejoin','round');copyIcon.setAttribute('aria-hidden','true');copyIcon.setAttribute('focusable','false');
 const copyIconPath=document.createElementNS('http://www.w3.org/2000/svg','path');copyIconPath.setAttribute('d','M8 8V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-3M5 8h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z');copyIcon.append(copyIconPath);copyButton.append(copyIcon);
 commandRow.append(copyButton);localInstructions.append(prepareButton,commandRow);
 async function saveConnection(includeAliases=false){
  confirmedAuthorized=false;connectCommand.value='';connectCommand.hidden=true;commandRow.hidden=true;
  const data={edition:currentEdition,commands:includeAliases?parse():savedConfig.commands||{}};
  if(currentEdition==='java')Object.assign(data,{host:host.value,port:Number(port.value),...(password.value?{password:password.value}:{})});
  const d=await api('/minecraft',data);password.value='';edited.delete(host);edited.delete(port);render(d,false);
 }
 connectionFields.append(button('Guardar y conectar',async()=>{
   confirmedAuthorized=false;
   try{
    if(currentEdition!=='java')return;
    await saveConnection();
    await api('/minecraft/authorize',{edition:'java',enabled:true});
    const d=await api('/minecraft');render(d,false);notice.textContent='Minecraft conectado.';
   }catch(e){
    connection.open=true;confirmedAuthorized=false;
    try{const d=await api('/minecraft');if(d.edition&&d.edition!==currentEdition)selectProfile(d);render(d,false);notice.textContent=e.message;}
    catch(_){drafts.set(currentEdition,captureDraft());uncertain=true;notice.textContent='No se pudo confirmar la conexión. Reintentando…';}
   }
 }));
const disconnectButton=button('Desconectar',async()=>{confirmedAuthorized=false;connectCommand.value='';connectCommand.hidden=true;commandRow.hidden=true;await change('/minecraft/disconnect',{});notice.textContent='Minecraft desconectado.';},false);
const checkConnection=button('Comprobar conexión',async()=>{const d=await api('/minecraft/check',{});notice.textContent=d.detail;});checkConnection.setAttribute('aria-label','Comprobar conexión sin ejecutar un alias');statusStrip.append(checkConnection,disconnectButton);
 advanced.append(button('Guardar conexión y comandos',async()=>{await saveConnection(true);notice.textContent='Comandos guardados. Vuelve a conectar Minecraft.';}));
 edition.addEventListener('change',()=>{
  if(busy||uncertain){edition.value=currentEdition;return;}
  const next=edition.value,previous=currentEdition;if(next===previous)return;
  return operate(async()=>{
  drafts.set(previous,captureDraft());
  password.value='';confirmedAuthorized=false;connectCommand.value='';connectCommand.hidden=true;commandRow.hidden=true;
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
 const testAlias=field('Alias para prueba','text',advanced);advanced.append(button('Ejecutar alias de prueba',async()=>{if(!testAlias.value)throw Error('Escribe un alias guardado');await change('/minecraft/run',{alias:testAlias.value});notice.textContent='Comando enviado a la cola.';}),el('p','Un alias es un nombre corto para un comando. Guárdalo en Interactividad y ejecútalo aquí. Variables: {user}, {gift}, {count}.'),(()=>{const example=el('p','Ejemplo: '),code=el('code','saludo = say Hola {user}');example.append(code);return example;})());
 const activity=el('section');activity.className='minecraft-activity';activity.append(el('h3','Actividad y cola'));
 const queueBoard=el('div');queueBoard.className='minecraft-queue-board';
 const waveLane=el('section');waveLane.className='minecraft-wave-lane';waveLane.append(el('p','Espera la siguiente oleada de regalos'));
 const waveCountdown=el('strong','30 s');waveCountdown.setAttribute('aria-live','off');waveLane.append(waveCountdown,el('small','Cada efecto se ejecuta por separado a su propio ritmo.'));
 const queueStatus=el('p','La cola está lista.');queueStatus.className='minecraft-queue-status';queueStatus.setAttribute('role','status');queueStatus.setAttribute('aria-live','polite');
 const nowCard=el('article');nowCard.className='minecraft-queue-card';nowCard.append(el('h4','En ejecución'),el('p','Sin efecto en ejecución.'));
 const nextCard=el('article');nextCard.className='minecraft-queue-card minecraft-next-card';nextCard.append(el('h4','Siguiente'),el('p','Sin objetos pendientes.'));
 const queueMetrics=el('div');queueMetrics.className='minecraft-queue-metrics';
 const queueControl=button('Pausar cola',async()=>{const paused=queueControl.textContent==='Reanudar cola';await api(paused?'/minecraft/presets/resume':'/minecraft/presets/stop',{edition:currentEdition});notice.textContent=paused?'Cola reanudada.':'Cola pausada. El trabajo pendiente se conserva.';});
 queueBoard.append(waveLane,queueStatus,nowCard,nextCard,queueMetrics,queueControl);
 const activityLog=el('div');activityLog.className='minecraft-activity-log';activityLog.append(el('h4','Resultados confirmados y recepción'),log);
 activity.append(queueBoard,activityLog);pane.append(advanced,activity);
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
