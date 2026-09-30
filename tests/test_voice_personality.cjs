process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const context={window:{}};
vm.runInNewContext(fs.readFileSync('web/static/voice_personality.js','utf8'),context);
const personality=context.window.VoicePersonality;
test('each character offers three distinct interpretations',()=>{
  for(const id of ['padre','heroe','villano','anciano','robot']){
    const styles=personality.options({id});assert.equal(styles.length,3);
    assert.equal(new Set(styles.map(s=>`${s.pitch}:${s.rate}`)).size,3);
    for(const style of styles){const character={id,variation:style.id,pitch:style.pitch,rate:style.rate};const u={text:'Hola.'};personality.apply(u,character,character.rate,()=>.5);assert.equal(u.pitch,style.pitch);assert.equal(u.rate,style.rate);}
  }
});
test('expressive voices respond to punctuation and vary between readings without rewriting text',()=>{
  const c={id:'heroe',pitch:1.42,rate:1.22};
  const plain={text:'Hola.'},excited={text:'¡Hola!'},other={text:'Hola.'};
  personality.apply(plain,c,c.rate,()=>.5);personality.apply(excited,c,c.rate,()=>.5);personality.apply(other,c,c.rate,()=>1);
  assert.ok(excited.pitch>plain.pitch);assert.ok(excited.rate>plain.rate);assert.notEqual(other.pitch,plain.pitch);assert.equal(excited.text,'¡Hola!');
});
test('robot stays uniform and custom characters inherit expression',()=>{
  for(const text of ['Hola.','¡Hola!','¿Hola?']){const u={text};personality.apply(u,{id:'robot',pitch:.9},1.3,()=>1);assert.equal(u.pitch,.9);assert.equal(u.rate,1.3);}
  const u={text:'¡Hola!'};personality.apply(u,{id:'custom-1',personality:'padre',variation:'comic',pitch:.8},.9,()=>.5);assert.ok(u.pitch>.8);
});
test('legacy profiles and invalid values remain usable, global rate is respected',()=>{
  const u={text:'Hola.'};personality.apply(u,{id:'padre',pitch:.72},1.5,()=>.5);assert.equal(u.pitch,.72);assert.equal(u.rate,1.5);
  personality.apply(u,null,1,()=>.5);assert.equal(u.pitch,1);assert.equal(u.rate,1);
  personality.apply(u,{pitch:'bad'},NaN);assert.equal(u.pitch,1);assert.equal(u.rate,1);
});
test('preview and live reader both apply the shared personality',()=>{
  for(const file of ['web/static/custom_voice.js','web/static/studio.js'])assert.match(fs.readFileSync(file,'utf8'),/VoicePersonality\.apply\(/);
  const html=fs.readFileSync('web/templates/index.html','utf8');assert.ok(html.indexOf('/static/voice_personality.js')<html.indexOf('/static/studio.js'));
});
