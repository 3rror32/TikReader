process.chdir(require('node:path').resolve(__dirname, '..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('web/static/shell.js','utf8');
const presence=fs.readFileSync('web/static/live_presence.js','utf8');
const template=fs.readFileSync('web/templates/index.html','utf8');
const sidebar=fs.readFileSync('web/static/sidebar.css','utf8');

test('personal destinations are contextual and compact instead of forming a second menu',()=>{
  assert.doesNotMatch(shell,/"TU ESPACIO"/);
  assert.match(shell,/"Preparar"[\s\S]*"creator-suite"/);
  assert.match(shell,/const trailingItems=\[\["Sesiones","history"\],\["Acerca de","about"\]\]/);
  assert.match(shell,/const utilityItems=\[\["Configuración","workspace"\]\]/);
  assert.doesNotMatch(shell,/"Credenciales de canales"[\s\S]*"platform-integrations"/);
  assert.doesNotMatch(shell,/settingsAbout|settings-about-link/);
  assert.match(template,/data-platform-settings="youtube"/);
  assert.match(template,/Usa “Configurar” debajo de cada canal/);
});

test('the menu keeps overlay shortcuts while consolidating other repeated routes',()=>{
 assert.match(shell,/"Overlays"[\s\S]*"Favoritos"[\s\S]*"Animaciones"[\s\S]*"Efectos"[\s\S]*"Herramientas"[\s\S]*"Metas"[\s\S]*"Mis animaciones"/);
  assert.doesNotMatch(shell,/"Editor de escenas"|"Juegos del chat"|"Batallas"|"Comunidad"/);
  assert.match(shell,/"Preguntas"[\s\S]*"questions"/);
  assert.doesNotMatch(shell,/"Temporizador",\s*"timer-control"/);
});

test('navigation keeps the useful Directo label and removes the redundant cabin subtitle',()=>{
  assert.match(shell,/"Directo"/);
  assert.doesNotMatch(shell,/subtitle\.textContent='CABINA DE REALIZACIÓN'/);
  assert.match(shell,/"Lectura"/);
  assert.match(shell,/"Diagnóstico"/);
});

test('menu labels stay concise and use one casing convention',()=>{
  for(const [label,key] of [['Subtítulos','microphone-captions'],['Alertas','alerts'],['Preguntas','questions'],['Filtros','filters'],['Escenas','obs-direct'],['Multimedia','custom-voice'],['Atajos','game-hotkeys'],['Revisión','preflight'],['Eventos','event-diagnostics']]){
    assert.match(shell,new RegExp(`"${label}"[\\s\\S]*"${key}"`));
  }
  assert.doesNotMatch(shell,/"DIRECTO"|Subtítulos del micrófono|Alertas de regalos|Preguntas del chat|Filtros de comentarios|Control de escenas|Pruebas y diagnóstico/);
});

test('about closes both menu modes while only settings stays in quick access',()=>{
  assert.match(shell,/\["Acerca de","about"\]/);
  assert.doesNotMatch(shell,/Acerca de TikReader|settingsAboutVersion|aboutFooter/);
  assert.match(shell,/for\(const \[label,key\] of trailingItems\)[\s\S]*nav\.append\(group\)/);
  assert.doesNotMatch(sidebar,/sidebar-utility \[data-section-nav="about"\]/);
  assert.match(sidebar,/\.sidebar-utility\{[^}]*grid-template-columns:1fr/s);
  assert.match(sidebar,/\.sidebar-utility \[data-section-nav\][^{]*\{[^}]*font-size:14px!important/s);
  assert.match(sidebar,/\.sidebar-utility \.sidebar-label\{[^}]*font-size:inherit!important/s);
  assert.match(sidebar,/\.sidebar-utility \[data-section-nav\][^{]*\{[^}]*min-height:44px/s);
  assert.match(sidebar,/\.menu-open \.app-sidebar\{z-index:10020\}/);
  assert.match(shell,/panic\.setAttribute\('aria-label','Pausar voz y efectos'\)/);
  assert.match(presence,/headerActions\.append\(persistent\)[\s\S]*headerActions\.append\(safety\)[\s\S]*headerActions\.append\(donate\)/);
  assert.match(presence,/document\.querySelector\('\.creator-actions'\)\?\.append\(aboutDonate\)/);
});

test('every theme preserves sentence case in sidebar navigation',()=>{
  assert.match(sidebar,/#app-sidebar :is\([^}]+\)\{text-transform:none!important\}/);
});
