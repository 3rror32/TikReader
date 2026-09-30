process.chdir(require('node:path').resolve(__dirname, '..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');

const shell=fs.readFileSync('web/static/shell.js','utf8');
const presence=fs.readFileSync('web/static/live_presence.js','utf8');

test('personal tools live under one configuration disclosure',()=>{
  const personal=shell.slice(shell.indexOf('"TU ESPACIO"'),shell.indexOf('const destinationLabels'));
  assert.match(personal,/"Configuración"[\s\S]*"Historial"[\s\S]*"Apariencia"[\s\S]*"Perfiles del creador"[\s\S]*"Calendario"[\s\S]*"Recursos del creador"/);
  assert.doesNotMatch(personal,/"Acerca de"/);
});

test('about is a versioned footer and safety control joins live actions',()=>{
  assert.match(shell,/aboutFooter\.className='sidebar-about'/);
  assert.match(shell,/document\.body\.dataset\.appVersion/);
  assert.match(shell,/panic\.setAttribute\('aria-label','Pausa de seguridad'\)/);
  assert.match(presence,/headerActions\.append\(persistent\)[\s\S]*headerActions\.append\(safety\)[\s\S]*headerActions\.append\(donate\)/);
});
