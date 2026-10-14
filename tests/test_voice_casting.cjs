process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
const source=fs.readFileSync('web/static/custom_voice.js','utf8');
function setup(){
  const spoken=[],timers=[],status={textContent:''},sample={value:'Esta es mi frase personalizada.'};
  const voice={voiceURI:'test-es',lang:'es-MX',localService:true};
  const window={speechSynthesis:{getVoices:()=>[voice],cancel(){},resume(){this.paused=false;},speak(u){assert.equal(this.paused,false);spoken.push(u);}}};
  vm.runInNewContext(fs.readFileSync('web/static/voice_personality.js','utf8'),{window,Math:{random:()=>.5,min:Math.min,max:Math.max}});
  const context=vm.createContext({window,status,select:{value:'test-es'},SpeechSynthesisUtterance:function(text){this.text=text;},$:id=>id==='custom-voice-sample'?sample:{value:'.7'},source:()=> 'browser',current:()=>({id:'browser',name:'Voz de este equipo',pitch:1,rate:1}),setTimeout:fn=>timers.push(fn),document:{addEventListener(){}},URL:{revokeObjectURL(){}}});
  const handler=source.split('\n').find(line=>line.includes("$('custom-voice-test').onclick="));
  const stop=source.split('\n').find(line=>line.includes('function stopPreview('));
  vm.runInContext('let previewGeneration=0,previewController=null,previewUrl=null,previewAudio=null,previewUtterance=null;'+stop+'\nvar run='+handler.slice(handler.indexOf('async()=>')),context);
  return {context,spoken,timers,status,window,sample};
}
test('browser preview uses the edited text and standard local voice settings',async()=>{
  const p=setup();await p.context.run();p.timers.shift()();
  assert.equal(p.spoken[0].text,p.sample.value);assert.equal(p.spoken[0].pitch,1);assert.equal(p.spoken[0].rate,1);
});
test('repeated preview cancels the queued previous reading',async()=>{
  const p=setup();await p.context.run();p.sample.value='Nueva frase';await p.context.run();p.timers.forEach(fn=>fn());assert.equal(p.spoken.length,1);assert.equal(p.spoken[0].text,'Nueva frase');
});
test('empty text and emergency mute do not play a preview',async()=>{
  const p=setup();p.sample.value=' ';await p.context.run();assert.equal(p.timers.length,0);
  p.sample.value='Hola';await p.context.run();p.window.tikreaderAudioMuted=true;p.context.stopPreview();p.timers.forEach(fn=>fn());assert.equal(p.spoken.length,0);
});

test('browser preview refuses a remote voice instead of sending text online',async()=>{
  const p=setup();p.window.speechSynthesis.getVoices=()=>[{voiceURI:'test-es',lang:'es-MX',localService:false}];
  await p.context.run();assert.equal(p.timers.length,0);assert.equal(p.spoken.length,0);
  assert.match(p.status.textContent,/local seleccionada/);
});

test('preview resumes the shared engine and releases control after completion',async()=>{
  const p=setup(),events=[];
  p.window.speechSynthesis.paused=true;
  p.window.Studio={beginVoicePreview(){events.push('begin');return true;},endVoicePreview(){events.push('end');}};
  await p.context.run();p.timers.shift()();
  assert.equal(p.spoken.length,1);assert.equal(events.at(-1),'begin');
  p.spoken[0].onend();assert.equal(events.at(-1),'end');
});

test('preview releases control when the Windows engine fails to start',async()=>{
  const p=setup();let released=false;
  p.window.Studio={beginVoicePreview(){released=false;return true;},endVoicePreview(){released=true;}};
  p.window.speechSynthesis.speak=()=>{throw Error('audio-busy');};
  await p.context.run();p.timers.shift()();
  assert.equal(released,true);assert.match(p.status.textContent,/audio-busy/);
});
