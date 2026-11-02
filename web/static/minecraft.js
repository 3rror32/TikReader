(()=>{
 const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n};
 const pane=el('section');pane.className='studio-pane';pane.dataset.section='minecraft';const notice=el('p');notice.setAttribute('role','status');
 const stylesheet=el('link');stylesheet.rel='stylesheet';stylesheet.href='/static/minecraft.css';document.head.append(stylesheet);
 async function api(path,data){const operation=operationSerial,mode=currentEdition;const r=await fetch(path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined,signal:AbortSignal.timeout(5000)});const d=await r.json();if(data&&(operation!==operationSerial||mode!==currentEdition))throw Error('La operación ya no corresponde a esta edición.');if(!r.ok)throw Error(d.error||'Error');return d}
 const edited=new Set();
 function field(label,type='text',parent=pane){const l=el('label',label),n=el(type==='textarea'?'textarea':'input');if(type!=='textarea')n.type=type;n.addEventListener('input',()=>edited.add(n));l.append(n);parent.append(l);return n}
 function disclosure(title){const node=el('details');node.append(el('summary',title));return node;}
 let busy=false,uncertain=false,operationSerial=0,actionPicker,addActionButton;const actionButtons=[],extraControls=[];
 function syncControls(){for(const input of extraControls)input.disabled=busy||uncertain||!backendReady;for(const b of actionButtons)b.disabled=busy||uncertain||(b.needsBackend&&!backendReady);edition.disabled=busy||uncertain||!backendReady;for(const row of presetRows.values()){row.gift.disabled=busy||uncertain||!backendReady;row.giftButton.disabled=busy||uncertain||!backendReady;if(row.quantity)row.quantity.disabled=busy||uncertain||!backendReady;if(row.enabled.tagName==='input'&&row.enabled.type==='checkbox')row.enabled.disabled=busy||uncertain||!backendReady||!row.gift.value;}if(actionPicker)actionPicker.disabled=busy||uncertain||!backendReady||!selectedActionsByEdition.has(currentEdition);if(addActionButton)addActionButton.disabled=busy||uncertain||!backendReady||!selectedActionsByEdition.has(currentEdition)||!actionPicker?.value||selectedActionsByEdition.get(currentEdition)?.includes(actionPicker.value);}
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
 const advanced=disclosure('Opciones avanzadas'),help=disclosure('Ayuda');
 help.append(
  el('p','Los mobs disponibles dependen de la versi\u00f3n instalada de Minecraft. El juego puede rechazar los m\u00e1s recientes; no se reintenta una invocaci\u00f3n.'),
  el('p','Java necesita un servidor con RCON habilitado. En server.properties: enable-rcon=true, rcon.password y rcon.port. Un mundo individual sin RCON no es compatible.'),
  el('p','Bedrock: activa trucos y permisos de administrador; habilita Enable WebSockets si aparece y desactiva Require Encrypted Websockets para esta conexi\u00f3n local. Solo se admite este equipo.'),
  el('p','Si Bedrock no conecta, revisa los permisos de loopback de Minecraft en Windows. TikReader no cambia opciones de Windows ni del juego.'),
  el('p','Desconecta antes de cambiar de mundo: el juego puede conservar la conexi\u00f3n al salir. TikReader no verifica continuamente qu\u00e9 mundo est\u00e1 abierto.'),
  el('p','Las acciones se aplican a @p: el jugador m\u00e1s cercano al origen del comando, no al espectador que envi\u00f3 el regalo. Java usa el origen del servidor; Bedrock, el contexto del jugador conectado.'),
  el('p','Las rachas finalizadas multiplican la cantidad configurada de mobs y TNT. Los dem\u00e1s efectos se aplican una vez. Detener cancela pasos pendientes, pero no deshace lo que ya cambi\u00f3 en el mundo. Sin confirmar significa que la respuesta no permite asegurar el resultado.')
 );
 advanced.append(el('p','Controla el intervalo y el límite de efectos, el formato de nombres de mobs en Java y los comandos guardados para esta conexión.'));
 const nameFormatLabel=el('label','Nombres de mobs en Java'),nameFormat=el('select');for(const [id,text] of [['modern','Java 1.21.5 o posterior'],['legacy','Java 1.13 a 1.21.4']]){const option=el('option',text);option.value=id;nameFormat.append(option);}nameFormat.value='modern';nameFormatLabel.append(nameFormat);advanced.append(nameFormatLabel,el('small','El formato se guarda con Guardar límites.'));nameFormat.addEventListener('change',()=>edited.add(nameFormat));
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
 const catalogNotice=el('p'),actionList=el('div');catalogNotice.setAttribute('role','status');
 const sectionOptions=[['environment','Ambiente'],['abilities','Habilidades'],['items','Objetos'],['mobs','Mobs']];
 const categoryOptions=[['animals','Animales'],['aquatic','Acuáticos'],['helpers','Ayudantes'],['undead','No-muertos'],['hostile','Hostiles'],['nether','Nether'],['end','End'],['bosses','Jefes']];
 const categoryGroupStarts=new Map([['animals','Superficie'],['nether','Dimensiones'],['bosses','Encuentros']]);
 const navigationSelections=new Map(),sectionTabs=new Map(),sectionPanels=new Map(),categoryTabs=new Map(),categoryPanels=new Map(),emptyStates=new Map();
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
 let confirmedPresetValues={},navigationEditionConfirmed=false,pendingInitialSelection=null;
 const mainTabList=el('div');mainTabList.className='minecraft-primary-tabs';mainTabList.setAttribute('role','tablist');mainTabList.setAttribute('aria-label','Secciones de Minecraft');
 const tabList=el('div');tabList.className='minecraft-category-tabs';tabList.setAttribute('role','tablist');tabList.setAttribute('aria-label','Categorías de mobs');
 function navigation(){return navigationSelections.get(currentEdition)||pendingInitialSelection||{section:'environment',mobCategory:'animals'};}
 function rememberNavigation(selection){
  if(navigationEditionConfirmed)navigationSelections.set(currentEdition,selection);
  else pendingInitialSelection=selection;
 }
 function navigateKey(event,id,options,tabs,select){
  const index=options.findIndex(([key])=>key===id);let next;
  if(event.key==='ArrowRight')next=(index+1)%options.length;
  if(event.key==='ArrowLeft')next=(index+options.length-1)%options.length;
  if(event.key==='Home')next=0;
  if(event.key==='End')next=options.length-1;
  if(next===undefined)return;
  event.preventDefault();event.stopPropagation?.();
  const key=options[next][0];select(key,true);tabs.get(key).focus();
  tabs.get(key).scrollIntoView?.({block:'nearest',inline:'nearest'});
 }
 for(const [id,name] of sectionOptions){
  const tab=el('button',name);tab.type='button';tab.dataset.primarySection=id;tab.id='minecraft-section-tab-'+id;
  tab.setAttribute('role','tab');tab.setAttribute('aria-controls','minecraft-section-panel-'+id);
  tab.onclick=()=>selectSection(id,true);
  tab.addEventListener('keydown',event=>navigateKey(event,id,sectionOptions,sectionTabs,selectSection));
  const panel=el('div');panel.id='minecraft-section-panel-'+id;panel.dataset.primaryPanel=id;
  panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);
  if(id==='mobs')panel.append(el('h4','Categorías de mobs'),tabList);
  panel.append(makeColumns());const empty=el('p','No hay acciones en esta sección. Usa “Agregar acción” para elegir una.');empty.className='minecraft-empty-actions';panel.append(empty);emptyStates.set(id,empty);panel.dataset.emptyState=id;sectionTabs.set(id,tab);sectionPanels.set(id,panel);mainTabList.append(tab);actionList.append(panel);
 }
 for(const [id,name] of categoryOptions){
  if(categoryGroupStarts.has(id)){const group=el('span',categoryGroupStarts.get(id));group.className='minecraft-category-group-label';group.setAttribute('aria-hidden','true');tabList.append(group);}
  const tab=el('button',name);tab.type='button';tab.dataset.category=id;tab.id='minecraft-tab-'+id;
  tab.setAttribute('role','tab');tab.setAttribute('aria-controls','minecraft-panel-'+id);
  tab.onclick=()=>selectCategory(id,true);
  tab.addEventListener('keydown',event=>navigateKey(event,id,categoryOptions,categoryTabs,selectCategory));
  const panel=el('div');panel.id='minecraft-panel-'+id;panel.dataset.categoryPanel=id;
  panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',tab.id);
  const empty=el('p','No hay acciones en esta categoría. Usa “Agregar acción” para elegir una.');empty.className='minecraft-empty-actions';panel.append(empty);emptyStates.set(id,empty);panel.dataset.emptyState=id;
  categoryTabs.set(id,tab);categoryPanels.set(id,panel);tabList.append(tab);sectionPanels.get('mobs').append(panel);
 }
 function showNavigation(selection){
  for(const [id,tab] of sectionTabs){
   const selected=id===selection.section;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
   sectionPanels.get(id).hidden=!selected;
  }
  tabList.hidden=selection.section!=='mobs';
  for(const [id,tab] of categoryTabs){
   const selected=id===selection.mobCategory;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;
   categoryPanels.get(id).hidden=selection.section!=='mobs'||!selected;
  }
 }
 function selectSection(id,remember=false){
  const selection={...navigation(),section:id};if(remember)rememberNavigation(selection);showNavigation(selection);
 }
 function selectCategory(id,remember=false){
  const selection={section:'mobs',mobCategory:id};if(remember)rememberNavigation(selection);showNavigation(selection);
 }
 function updateCategories(confirmed){
  if(confirmed){
   if(!navigationEditionConfirmed){
    navigationEditionConfirmed=true;
    if(pendingInitialSelection!==null){navigationSelections.set(currentEdition,pendingInitialSelection);pendingInitialSelection=null;}
   }
   confirmedPresetValues=structuredClone(confirmed);
   if(!navigationSelections.has(currentEdition)){
    const active=row=>confirmed[row.id]?.enabled&&confirmed[row.id]?.gift_id;
    const firstSection=sectionOptions.find(([id])=>defaultActions.some(row=>row.section===id&&active(row)));
    const firstMob=categoryOptions.find(([id])=>defaultActions.some(row=>row.section==='mobs'&&row.category===id&&active(row)));
    navigationSelections.set(currentEdition,{section:firstSection?.[0]||'environment',mobCategory:firstMob?.[0]||'animals'});
   }
  }
  for(const [options,tabs,field] of [[sectionOptions,sectionTabs,'section'],[categoryOptions,categoryTabs,'category']]){
   for(const [id,name] of options){
    const count=defaultActions.filter(row=>row[field]===id&&confirmedPresetValues[row.id]?.enabled&&confirmedPresetValues[row.id]?.gift_id).length;
    const tab=tabs.get(id);tab.textContent=name+(count?' · '+count:'');tab.setAttribute('aria-label',name+(count?`, ${count} activas`:''));
   }
  }
  showNavigation(navigation());
 }
 showNavigation(navigation());
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
  const title=el('div');title.className='minecraft-action-title';title.append(el('strong',preset.name),el('small',preset.description));
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
  const counts=new Map();
  for(const id of selected){
   const preset=actionById.get(id);if(!preset)continue;
   const row=presetRows.get(id)||createPresetRow(preset),parent=preset.section==='mobs'?categoryPanels.get(preset.category):sectionPanels.get(preset.section);
   if(row.node.parentElement!==parent||!row.node.isConnected)parent.append(row.node);
   counts.set(preset.section,(counts.get(preset.section)||0)+1);
   if(preset.section==='mobs')counts.set(preset.category,(counts.get(preset.category)||0)+1);
   fillGiftOptions(row,presetValues[id]||{gift_id:'',gift_name:'',enabled:false,quantity:preset.quantity});
  }
  for(const [id,empty] of emptyStates)empty.hidden=(counts.get(id)||0)>0;
  updateActionPicker();updateCategories(confirmed?presetValues:null);syncControls();
 }
 function updateActionPicker(){
  if(!actionPicker)return;
  const selected=new Set(selectedActionsByEdition.get(currentEdition)||[]);
  for(const option of actionPicker.children)if(option.value)option.disabled=selected.has(option.value);
  if(actionPicker.value&&selected.has(actionPicker.value))actionPicker.value='';
  if(!selectedActionsByEdition.has(currentEdition))actionPicker.disabled=true;
  if(addActionButton)addActionButton.disabled=busy||uncertain||!actionPicker.value||selected.has(actionPicker.value);
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
  notice.textContent='Acción quitada. Puedes volver a agregarla cuando quieras.';actionPicker.focus();
 }
 async function savePreset(id){
  if(busy||uncertain||!backendReady){renderPresets({presets:presetValues},true);return;}
  return operate(async()=>{
   const row=presetRows.get(id),giftId=row.gift.value;
   const name=giftCatalog.find(g=>String(g.id)===giftId)?.name||presetValues[id]?.gift_name||'';
   presetValues={...presetValues,[id]:{gift_id:giftId,gift_name:name,enabled:!!giftId&&row.enabled.tagName==='input'&&row.enabled.type==='checkbox'&&row.enabled.checked,...(row.quantity?{quantity:Number(row.quantity.value)}:{})}};presetDirty=true;
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
 const stopButton=button('Detener acciones pendientes',async()=>{await api('/minecraft/presets/stop',{edition:currentEdition});notice.textContent='Acciones pendientes detenidas.';});stopButton.setAttribute('aria-label','Detener acciones pendientes');
 const actionPickerLabel=el('label','Acción para agregar');actionPickerLabel.className='minecraft-action-picker';actionPicker=el('select');actionPicker.className='minecraft-action-picker-select';actionPicker.dataset.actionPicker='true';
 const actionPlaceholder=el('option','Selecciona una acción');actionPlaceholder.value='';actionPicker.append(actionPlaceholder);
 for(const preset of defaultActions){const option=el('option',`${preset.name} · ${preset.section==='mobs'?categoryOptions.find(([id])=>id===preset.category)?.[1]||'Mobs':sectionOptions.find(([id])=>id===preset.section)?.[1]||preset.section}`);option.value=preset.id;actionPicker.append(option);}
 actionPickerLabel.append(actionPicker);actionPicker.addEventListener('change',()=>syncControls());
 addActionButton=button('Agregar acción',async()=>{const id=actionPicker.value,selected=selectedActionsByEdition.get(currentEdition),preset=actionById.get(id);if(!backendReady||!preset||!selected||selected.includes(id))return;selected.push(id);persistSelectedActions(currentEdition);actionPicker.value='';renderPresets({authorization_mode:'automatic',presets:presetValues},true);if(preset.section==='mobs'){selectSection('mobs',true);selectCategory(preset.category,true);}else selectSection(preset.section,true);notice.textContent='Acción agregada.';});addActionButton.dataset.addAction='true';
 actionHeading.append(el('h3','Acciones predeterminadas'),actionPickerLabel,addActionButton,button('Actualizar regalos',loadGiftCatalog,false),stopButton,el('small','Cancela los pasos pendientes; no deshace los efectos que ya ocurrieron.'));
 function makeColumns(){const columns=el('div');columns.className='minecraft-action-columns';columns.setAttribute('aria-hidden','true');for(const text of ['Acción','Regalo','Cantidad','Habilitar','Probar',''])columns.append(el('span',text));return columns;}
 quickActions.append(actionHeading,el('p','Elige un grupo de acciones; en Mobs, selecciona también una categoría. Cantidad por regalo. Las rachas multiplican mobs y TNT; el exceso se descarta.'),compatibility,catalogNotice,mainTabList,actionList);
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
 advanced.append(safety);
 extraControls.push(interval,perMinute,nameFormat);
 function applySafety(d,force=false){
  const values=d.limits||d.config?.limits||{interval:3,per_minute:20};
  for(const [input,value] of [[interval,values.interval],[perMinute,values.per_minute],
                             [nameFormat,d.name_format||d.config?.name_format||'modern']]){
   if(force||!edited.has(input))input.value=value;
  }
 }
 function captureDraft(){return {host:host.value,port:port.value,commands:commands.value,interval:interval.value,perMinute:perMinute.value,nameFormat:nameFormat.value};}
 function selectProfile(d){
  currentEdition=d.edition||currentEdition;edited.clear();hydratePending=false;
  password.value='';confirmedAuthorized=false;connectCommand.value='';connectCommand.hidden=true;commandRow.hidden=true;showEdition();
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
  authorizationReady=d.authorization_mode==='automatic';
  backendReady=authorizationReady&&Array.isArray(d.preset_catalog)&&Array.isArray(d.preset_sections)&&sectionOptions.every(([id])=>d.preset_sections.some(section=>section.id===id))&&Array.isArray(d.preset_categories)&&categoryOptions.every(([id])=>d.preset_categories.some(c=>c.id===id))&&defaultActions.every(p=>d.preset_catalog.some(s=>s.id===p.id&&s.category===p.category&&s.section===p.section&&(!p.quantity||(s.quantity_max===20&&s.quantity_min===1))));
  compatibility.textContent=backendReady?'':'Reinicia TikReader para cargar estas acciones.';compatibility.hidden=backendReady;
  savedConfig=d.config||savedConfig;applySafety(d);
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
 const activity=disclosure('Registro reciente');activity.className='minecraft-activity';activity.append(log);pane.append(advanced,help,activity);
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
