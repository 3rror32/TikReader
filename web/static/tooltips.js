/* Contextual help stays private to the control panel; no changes to LIVE data. */
(()=>{
 if(window.TikReaderHelp)return;window.TikReaderHelp=true;
 const tips={
 'Hotkeys de juegos':'Asocia regalos con combinaciones personalizadas. Solo actúan tras autorización y cuando la ventana permitida está al frente.',
 'Organización del menú':'Básico oculta accesos avanzados; no desactiva reglas, audio ni integraciones que ya estén trabajando.',
 'Borradores, límites y deshacer':'Prepara cambios sin afectar el LIVE. Publicar requiere confirmación y rechaza cambios de otra pestaña. Guarda diez versiones para deshacer.',
 'Registro de activaciones':'Consulta los últimos quinientos resultados: evento, regla, paso y motivo de ejecución u omisión. No se abre automáticamente.',
 'Ensayo privado de una sesión':'Analiza hasta quinientos registros con reloj virtual. No envía acciones ni modifica datos del LIVE.',
 'Vista previa del diagnóstico de soporte':'Prepara un JSON sin nombres ni mensajes. Puedes editarlo antes de descargarlo; no se envía a terceros.',
 'Diagnóstico de voz (opcional)':'Revisa bloqueos cuando lo solicites. La reproducción y la confirmación de sonido requieren tus botones.',

 'Centro de estado del LIVE':'Resume conexión, voz, reglas y antigüedad del último dato recibido. Esa antigüedad no mide la latencia de TikTok.',
 'Prueba guiada del LIVE':'Registra eventos observados desde el inicio y comprobaciones que tú confirmas. No genera comentarios ni regalos.',
 'Plantillas de reglas':'Añade configuraciones iniciales desactivadas. Revisa cada regla antes de activarla.',
 'Control de saturación':'Encola, reemplaza u omite efectos. Cada cola tiene hasta diez pendientes y descarta esperas mayores a treinta segundos.',
 'Gestor de archivos':'Pon nombres reconocibles, revisa espacio y previsualiza medios. Los archivos referenciados por reglas están protegidos.',
 'Atajos configurables':'Combinaciones Alt+Shift+letra para esta página. No funcionan mientras escribes ni como atajos globales de Windows.',
 'Lectura por voz':'Lee los comentarios nuevos con las voces del navegador. Requiere activar la lectura y restaurar la emisión si está silenciada.',
 'Leer comentarios nuevos':'Activa la lectura automática de comentarios nuevos que pasen los filtros. No vuelve a leer el historial.',
 'Elegir quién se lee en voz alta':'Restringe la lectura a seguidores confirmados, usuarios elegidos o selección manual. No oculta a los demás del chat.',
 'Leer solamente':'Elige la audiencia de la lectura. Si TikTok no confirma que alguien es seguidor, se omite en ese modo.',
 'Usuarios permitidos':'Escribe los nombres de usuario separados por comas. Se usa solo cuando eliges usuarios específicos.',
 'Voz':'Selecciona una voz instalada o disponible en este navegador.',
 'Velocidad':'Ajusta la rapidez de la voz, sin cambiar el contenido del comentario.',
 'Volumen':'Controla el volumen de lectura del navegador, no el volumen general del equipo.',
 'Prioridad':'Decide qué comentarios pendientes se leen primero. No interrumpe la frase que ya se está leyendo.',
 'Usuarios prioritarios':'Estos usuarios se adelantan cuando seleccionas la prioridad por usuarios.',
 'Espera máxima (s)':'Omite lecturas que lleven demasiado tiempo esperando. El comentario permanece en pantalla.',
 'Palabras bloqueadas':'Separa las palabras por comas. Es un filtro local de pantalla y voz; no bloquea usuarios en TikTok.',
 'Ocultar repetidos del mismo usuario (10 s)':'Filtra comentarios iguales del mismo usuario durante diez segundos.',
 'No leer emojis':'Quita emojis de la lectura por voz; no los elimina de los comentarios originales.',
 'Filtros locales':'Afectan al chat de TikReader y a su lectura, no moderan tu cuenta de TikTok.',
 'Alertas de regalos':'Muestra avisos y sonidos cuando llegan regalos que cumplen tus filtros.',
 'Sonido y animación (máximo una cada 5 s)':'Activa las alertas básicas de regalos, limitadas a una cada cinco segundos.',
 'Sonido':'Selecciona el tono de la alerta básica de regalo.',
 'Solo regalos que contengan':'Filtra por una parte del nombre del regalo. Déjalo vacío para incluir todos.',
 'Cantidad mínima':'Cantidad de regalos que debe alcanzar el envío para activar la alerta.',
 'Lectura actual y cola editable':'Consulta qué se está leyendo y adelanta, retira o guarda lecturas pendientes.',
 'Pausar cuando hablas':'Usa el micrófono para pausar la voz sintética mientras hablas. Requiere permiso y se analiza localmente.',
 'Sensibilidad (umbral)':'Un umbral menor detecta sonidos más suaves. Usa auriculares para evitar que la voz sintética active la pausa.',
 'Límite de lecturas pendientes':'Limita la cola de voz para no acumular comentarios atrasados. No elimina mensajes del chat.',
 'Traducción local':'Traduce con la capacidad disponible en el navegador. Puede requerir descargar un modelo.',
 'Idioma original':'Idioma desde el que se traducirán los comentarios al español.',
 'Leer traducción en lugar del original':'Usa el texto traducido cuando la traducción está disponible y preparada.',
 'Nombre de regla':'Nombre para reconocer esta regla en la lista, la botonera y el diagnóstico.',
 'Evento':'El evento de TikTok que puede activar la regla. La recepción depende de los datos que TikTok envíe.',
 'Acción':'Lo que se ejecutará al cumplirse la regla: texto, voz, sonido, video, temporizador o una acción externa autorizada.',
 'Contiene este texto o nombre de regalo (vacío = cualquiera)':'Busca una parte del comentario o nombre del regalo, sin distinguir mayúsculas. Vacío acepta cualquier texto del evento elegido.',
 'Texto, archivo WAV o ID de acción Streamer.bot':'Escribe el contenido según la acción: texto, nombre de archivo subido o GUID de una acción de Streamer.bot. Para WAV aleatorio, separa los archivos por comas.',
 'Intervalo mínimo entre activaciones (segundos)':'Tiempo mínimo entre activaciones de la misma regla, aunque participen usuarios distintos.',
 'Segundos añadidos por activación':'Tiempo que añade la acción de temporizador cada vez que se activa.',
 'Activaciones máximas por usuario y sesión':'Evita que una persona monopolice esta regla. Usuarios sin identidad comparten un límite.',
 'Activaciones máximas de la regla por sesión':'Presupuesto total de activaciones de esta regla durante la sesión. No representa dinero ni diamantes.',
 'Secuencia visual':'Agrega hasta cinco pasos después de la acción principal y define sus esperas.',
 'Valor':'Texto, archivo o identificador que utilizará este paso de la secuencia.',
 'Espera antes de este paso (0–60 s)':'Espera fija respecto al paso anterior. No detecta cuándo termina un sonido o programa externo.',
 'Segundos a añadir si es temporizador':'Solo se usa si la acción de este paso añade tiempo al temporizador.',
 'Simulación segura':'Evalúa reglas guardadas sin emitir efectos, consumir límites ni ejecutar programas externos.',
 'Texto o nombre de regalo para simular':'Contenido de prueba que se compara con los filtros de las reglas guardadas.',
 'Usuario para simular':'Identidad de prueba usada para comprobar los límites por usuario. No envía mensajes a TikTok.',
 'Importar y exportar reglas':'Guarda o carga reglas en JSON. Las importadas se añaden desactivadas y no incluyen los archivos de audio.',
 'Archivo JSON de reglas':'Selecciona un archivo de reglas exportado por TikReader; no se reemplazan las reglas existentes.',
 'Biblioteca de sonidos':'Sube WAV para tus reglas. Los sonidos referenciados por reglas no se pueden eliminar hasta retirar esas referencias.',
 'Subir WAV, máximo 5 MB':'Acepta archivos WAV de hasta 5 MB. La biblioteca tiene un límite total de 50 MB.',
 'Duración inicial en segundos':'Define el tiempo restante. Establecer duración no inicia automáticamente la cuenta regresiva.',
 'Temporizador ampliable':'Cuenta regresiva que puede recibir tiempo mediante reglas. Al reiniciar vuelve pausada desde el último guardado.',
 'Video MP4 (máximo 20 MB)':'Carga un video MP4 para una regla. Se reproduce sin audio y con un límite de visualización de treinta segundos.',
 'Encuesta del chat':'El chat vota escribiendo el número exacto de una opción. Se acepta un voto por usuario identificado.',
 'Pregunta de la encuesta':'Texto que verán los espectadores en el panel de la encuesta.',
 'Opciones (una por línea)':'Escribe entre dos y seis opciones, cada una en una línea distinta.',
 'Escribe AUTORIZAR STREAMERBOT':'Autoriza acciones configuradas en Streamer.bot local. No lo instala ni verifica que las acciones existan.',
 'Client ID de tu aplicación Spotify':'Identificador público de tu aplicación Spotify. No introduzcas tu contraseña ni un Client Secret.',
 'Peticiones de Spotify':'El chat solicita una pista con !song y su enlace. Tú apruebas antes de enviarla a Spotify. Requiere autenticación y Premium.',
 'Revisión antes de transmitir':'Comprueba disponibilidad, voz, archivos y posibles conflictos. No reproduce audio ni prueba fuentes del programa de streaming.',
 'Conflictos y omisiones':'Muestra posibles coincidencias entre reglas y contadores de causas por las que se omitieron activaciones.',
 'Botonera y vista previa privada':'La vista previa no publica efectos. Ejecutar una regla sí puede afectar la emisión y requiere confirmación.',
 'Escena':'Cambia las vistas de TikReader. Fuera de Charla se suspende la lectura; no controla las escenas nativas del programa de streaming.',
 'Ocultar nombres':'Oculta nombres en las vistas públicas. El historial y el panel privado conservan el original.',
 'Ocultar fotos':'Oculta fotos en las vistas públicas sin borrar los datos guardados.',
 'Ocultar enlaces, correos y números detectados':'Oculta patrones sensibles en las vistas y lectura configuradas. La detección es aproximada.',
 'Respuestas en pantalla':'Publica un texto en los paneles de TikReader; no envía un comentario a TikTok.',
 'Preguntas agrupadas':'Agrupa preguntas similares por texto normalizado para facilitar su seguimiento.',
 'Moderador remoto':'Permite acceso limitado mediante una clave temporal. Usa una red privada de confianza.',
 'Perfil':'Selecciona una configuración guardada de voz, disposición, reglas y privacidad.',
 'Ancho del chat':'Ajusta el reparto de ancho entre comentarios y regalos.',
 'Accesibilidad':'Ajusta tamaño de letra, contraste y controles. Se guarda en este navegador.',
 'Tamaño de letra del chat':'Cambia el tamaño de los comentarios sin modificar el contenido del LIVE.',
 'Contraste alto':'Aumenta el contraste de textos y bordes del estudio.',
 'Controles grandes':'Amplía controles para facilitar su uso con pantallas táctiles.',
 'Sesión':'Selecciona una transmisión guardada para consultar, resumir o exportar sus datos.',
 'Historial local':'Datos recibidos y guardados en este equipo. Los respaldos pueden contener nombres y comentarios.',
 'Recuperación y espacio del historial':'Recupera registros faltantes desde un respaldo sin sobrescribir los existentes ni la sesión actual.',
 'Conservación del historial':'La limpieza es manual y requiere confirmación. Los respaldos no se eliminan automáticamente.',
 'Resumen final y exportación anónima':'Exporta totales observados sin nombres, comentarios ni identificadores de participantes.',
 'Meta de likes':'Objetivo visual de likes. No añade likes ni modifica TikTok.',
 'Meta de regalos':'Objetivo visual de unidades de regalos recibidas. No representa necesariamente dinero.',
 'Diagnóstico de likes':'Distingue el total informado por la sala de los eventos observados desde tu conexión.'
 };
 const ids={
 'tts-pause':'Pausa o continúa la lectura por voz sin desconectar el LIVE.',
 'tts-skip':'Interrumpe la lectura actual y pasa a la siguiente pendiente.',
 'tts-test':'Lee una frase de prueba para comprobar el audio del navegador.',
 'profile-save':'Guarda los ajustes actuales en este navegador, incluidas reglas y privacidad.',
 'profile-load':'Carga el perfil. Las reglas quedan desactivadas y la emisión silenciada para revisarlas antes de continuar.',
 'profile-delete':'Elimina solo el perfil seleccionado, no el historial ni los comentarios.',
 'mic-start':'Solicita permiso para analizar el micrófono localmente. No graba ni envía tu audio.',
 'pair-create':'Genera una clave de acceso temporal para el moderador. Compártela solo con personas de confianza.',
 'pair-revoke':'Invalida el acceso del moderador que usa la clave actual.',
 'preflight-run':'Ejecuta comprobaciones locales sin añadir eventos, reproducir audio ni abrir fuentes del programa de streaming.'
 };
 const bubble=document.createElement('div');bubble.className='info-tooltip';bubble.id='tikreader-info-tooltip';bubble.setAttribute('role','tooltip');bubble.hidden=true;document.body.append(bubble);
 let active=null,closeTimer;const bound=new WeakMap();const icons=new Set();
 function position(){if(!active)return;const r=active.getBoundingClientRect(),b=bubble.getBoundingClientRect();const x=Math.max(8,Math.min(innerWidth-b.width-8,r.left+r.width/2-b.width/2));const y=r.bottom+b.height+12<innerHeight?r.bottom+8:Math.max(8,r.top-b.height-8);bubble.style.left=x+'px';bubble.style.top=y+'px';}
 function unlink(target){if(!target)return;const ids=(target.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==bubble.id);if(ids.length)target.setAttribute('aria-describedby',ids.join(' '));else target.removeAttribute('aria-describedby');}
 function hide(){clearTimeout(closeTimer);unlink(active);active=null;bubble.hidden=true;}
 function show(icon){clearTimeout(closeTimer);if(active&&active!==icon)unlink(active);active=icon;const text=icon.dataset.help||icon.getAttribute('aria-label')||icon.title;bubble.textContent=window.I18n?.t(text)??text;bubble.hidden=false;const ids=new Set((icon.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean));ids.add(bubble.id);icon.setAttribute('aria-describedby',[...ids].join(' '));position();}
 function later(){clearTimeout(closeTimer);closeTimer=setTimeout(()=>{if(document.activeElement!==active&&!bubble.matches(':hover')&&!active?.matches(':hover'))hide();},180);}
 bubble.addEventListener('mouseenter',()=>clearTimeout(closeTimer));bubble.addEventListener('mouseleave',later);
 // Delegate to include new comments and controls without adding more focus stops.
 const liveControl=target=>target?.closest?.('.live-columns [data-live-icon]');
 document.addEventListener('pointerover',e=>{const control=liveControl(e.target);if(control&&!control.contains(e.relatedTarget))show(control);});
 document.addEventListener('pointerout',e=>{const control=liveControl(e.target);if(control&&!control.contains(e.relatedTarget))later();});
 document.addEventListener('focusin',e=>{const control=liveControl(e.target);if(control)show(control);});
 document.addEventListener('focusout',e=>{if(liveControl(e.target))later();});
 document.addEventListener('click',e=>{if(liveControl(e.target))hide();});
 document.addEventListener('tikreader:localechange',()=>{if(active)show(active);});
 function attach(target,text,label,inside){if(bound.has(target))return;if(target.tagName==='LABEL'){for(const control of target.querySelectorAll('input,select,textarea'))if(!control.hasAttribute('aria-label')&&!control.hasAttribute('aria-labelledby'))control.setAttribute('aria-label',label);}else if(inside&&!target.hasAttribute('aria-label'))target.setAttribute('aria-label',label);const icon=document.createElement('span');icon.className='info-icon';icon.tabIndex=0;icon.setAttribute('role','button');icon.setAttribute('aria-label','Información: '+label);icon.dataset.help=text;const glyph=document.createElement('span');glyph.textContent='i';glyph.setAttribute('aria-hidden','true');icon.append(glyph);
 icon.addEventListener('mouseenter',()=>show(icon));icon.addEventListener('mouseleave',later);icon.addEventListener('focus',()=>show(icon));icon.addEventListener('blur',later);
 icon.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();show(icon);});icon.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();show(icon);}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();hide();}});
 if(inside)target.append(icon);else {
   target.after(icon);
   // A sibling tooltip must follow its control's visibility (including Restore).
   const syncVisibility=()=>{icon.hidden=target.hidden;if(icon.hidden&&active===icon)hide();};
   syncVisibility();
   const visibilityObserver=new MutationObserver(syncVisibility);
   visibilityObserver.observe(target,{attributes:true,attributeFilter:['hidden']});
   icons.add({target,icon,visibilityObserver});
 }
 bound.set(target,icon);if(inside)icons.add({target,icon});}
 function labelText(node){const read=n=>{if(n.nodeType===3)return window.I18n?.sourceText(n)??n.nodeValue;if(n.matches?.('input,select,textarea,.info-icon'))return '';return Array.from(n.childNodes||[],read).join('');};return read(node).replace(/\s+/g,' ').trim();}
 function scan(){for(const item of icons)if(!item.target.isConnected){if(active===item.icon)hide();item.visibilityObserver?.disconnect();item.icon.remove();icons.delete(item);}for(const target of document.querySelectorAll('.studio-pane label,.studio-pane h2,.studio-pane h3,.studio-pane summary,.live-center h3')){const label=labelText(target);if(tips[label])attach(target,tips[label],label,true);}for(const [id,text] of Object.entries(ids)){const target=document.getElementById(id);if(target)attach(target,text,(window.I18n?.sourceText(target)??target.textContent).trim(),false);}}
 scan();let queued=false;new MutationObserver(records=>{if(!records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&!n.classList?.contains('info-icon')&&n!==bubble)))return;if(!queued){queued=true;requestAnimationFrame(()=>{queued=false;scan();});}}).observe(document.querySelector('.app'),{childList:true,subtree:true});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});document.addEventListener('pointerdown',e=>{if(active&&!active.contains(e.target)&&!bubble.contains(e.target))hide();});document.addEventListener('scroll',hide,true);window.addEventListener('resize',hide);
})();
