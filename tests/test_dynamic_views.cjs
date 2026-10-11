process.chdir(require('node:path').resolve(__dirname, '..'));
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');

test('late screens register inside the content area and start hidden',()=>{
  const shell=fs.readFileSync('web/static/shell.js','utf8');
  const center=fs.readFileSync('frontend/entries/control-center.ts','utf8');
  assert.match(shell,/function registerView\(key,node\)/);
  assert.match(shell,/config\.append\(node\)/);
  assert.match(center,/pane\.hidden = true/);
  assert.match(center,/Shell\.registerView\("control-center", pane\)/);
  assert.doesNotMatch(center,/querySelector\(`?"?\.app/);
});

test('static view ownership is declared by stable mount markers, not visible heading copy',()=>{
  const template=fs.readFileSync('web/templates/index.html','utf8');
  const shell=fs.readFileSync('web/static/shell.js','utf8');
  for(const key of ['voice','filters','alerts-local','history','workspace','diagnostics','obs','dynamic-integrations']){
    assert.match(template,new RegExp('data-view-mount="'+key+'"'),key+' has an explicit template mount');
    assert.equal([...template.matchAll(new RegExp('data-view-mount="'+key+'"','g'))].length,1,key+' has one mount');
  }
  assert.doesNotMatch(shell,/function cutAt\(|cutAt\(panes\./,'section ownership must not depend on heading text');
  assert.match(shell,/document\.querySelector\('\[data-view-mount="'\+key\+'"\]'\)/,'mount lookup uses stable attributes');
});

test('dynamic view producers register stable keys through the boot-safe registry',()=>{
  const template=fs.readFileSync('web/templates/index.html','utf8');
  const shell=fs.readFileSync('web/static/shell.js','utf8');
  assert.match(template,/OperatorViewRegistry/,'the registry is available before feature scripts');
  assert.match(shell,/OperatorViewRegistry\?\.connect\(\(key,node\)=>views\.get\(key\)===node\?node:registerView\(key,node\)\)/,'shell drains registrations without remounting an identical static root');
  for(const file of ['animation_studio.js','creator_bridge.js','game_hotkeys.js','interactivity.js','live_games.js','live_integrations.js','microphone_captions.js','minecraft.js','points.js']){
    const source=fs.readFileSync('web/static/'+file,'utf8');
    assert.match(source,/OperatorViewRegistry\.register\(/,file+' registers its long-lived view explicitly');
  }
});

test('registry preserves late registration order and deduplicates pending keys before shell startup',()=>{
  const template=fs.readFileSync('web/templates/index.html','utf8');
  const source=template.match(/<script id="operator-view-registry">([\s\S]*?)<\/script>/)?.[1];
  assert.ok(source,'registry is a small independently testable boot surface');
  const window={};
  vm.runInNewContext(source,{window,document:{getElementById:()=>({append(){}})}});
  const first={},replacement={},late={};
  window.OperatorViewRegistry.register('creator-suite',first);
  window.OperatorViewRegistry.register('creator-suite',replacement);
  const mounted=[];
  const register=(key,node)=>{mounted.push([key,node]);return node;};
  window.OperatorViewRegistry.connect(register);
  window.OperatorViewRegistry.connect(register);
  window.OperatorViewRegistry.register('microphone-captions',late);
  assert.deepEqual(mounted,[['creator-suite',replacement],['microphone-captions',late]]);
  assert.equal(mounted.some(([,node])=>node===first),false,'superseded initialization cannot mount stale content');
});
