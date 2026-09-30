process.chdir(require('node:path').resolve(__dirname,'..'));
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),test=require('node:test');
const runtime=fs.readFileSync('web/static/overlay_canvas_runtime.js','utf8');
const styles=fs.readFileSync('web/static/overlay_canvas_runtime.css','utf8');

function format(search){
 const document={documentElement:{dataset:{}}};
 vm.runInNewContext(runtime,{document,location:{search},URLSearchParams});
 return document.documentElement.dataset;
}

test('public overlay URL selects a real vertical or horizontal canvas',()=>{
 assert.deepEqual({...format('?canvas_format=vertical')},{canvasFormat:'vertical',canvasWidth:'1080',canvasHeight:'1920'});
 assert.deepEqual({...format('?canvas_format=horizontal')},{canvasFormat:'horizontal',canvasWidth:'1920',canvasHeight:'1080'});
 assert.deepEqual({...format('?canvas_format=invalid')},{});
 assert.match(styles,/data-canvas-format="vertical"[^}]*56\.25vh[^}]*177\.7778vw/);
 assert.match(styles,/data-canvas-format="horizontal"[^}]*177\.7778vh[^}]*56\.25vw/);
});

test('every configurable public overlay loads the canvas runtime',()=>{
 for(const name of ['widget.html','animation_widget.html','stream_buddies.html','seasonal_widget.html','rain_original_widget.html','emoji_widget.html','user_info_widget.html']){
  const html=fs.readFileSync('web/templates/'+name,'utf8');
  assert.match(html,/overlay_canvas_runtime\.css/,name);
  assert.match(html,/overlay_canvas_runtime\.js/,name);
 }
 assert.match(fs.readFileSync('web/static/seasonal_overlay.js','utf8'),/canvas\.getBoundingClientRect\(\)/);
});
