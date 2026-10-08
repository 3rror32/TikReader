process.chdir(require('node:path').resolve(__dirname, '..'));
const assert=require('node:assert/strict');
const fs=require('node:fs');
const test=require('node:test');

const read=file=>fs.readFileSync(file,'utf8');
const template=read('web/templates/index.html');
const workspace=read('web/static/workspace.js');
const skins=read('web/static/skins.js');
const device=read('web/static/user_settings.js');

test('configuration follows the frequency-of-use order',()=>{
 const labels=['Apariencia e interfaz','Espacio de trabajo','Salidas para streaming','Perfiles de transmisión','Sistema y almacenamiento'];
 let previous=-1;
 for(const label of labels){const position=template.indexOf(label);assert.ok(position>previous,`${label} debe aparecer en orden`);previous=position;}
 assert.doesNotMatch(template,/class="settings-order"/);
});

test('configuration removes controls already covered by an immediate control',()=>{
 assert.doesNotMatch(template,/id="skin-apply"/);
 assert.doesNotMatch(template,/id="settings-save-device"/);
 assert.doesNotMatch(workspace,/Reducir chat|Ampliar chat/);
 assert.doesNotMatch(device,/settings-save-device/);
 assert.match(skins,/select\.addEventListener\('change'/);
 assert.match(workspace,/layout-split-value/);
});

test('streaming outputs expose only preview and copy actions',()=>{
 assert.match(template,/id="widget-links" class="widget-link-list"/);
 assert.match(workspace,/Tamaño recomendado/);
 assert.match(workspace,/Vista previa/);
 assert.match(workspace,/Copiar URL/);
 assert.doesNotMatch(workspace,/link\.textContent='Abrir'|code\.textContent=url/);
 assert.doesNotMatch(template,/widget_customizer\.js/);
});

test('optional and destructive actions communicate their state',()=>{
 assert.match(template,/class="settings-disclosure"/);
 assert.match(template,/id="profile-load" disabled/);
 assert.match(template,/id="profile-delete" disabled/);
 assert.match(workspace,/profileActions/);
 assert.match(workspace,/¿Eliminar el perfil/);
});
