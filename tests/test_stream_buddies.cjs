process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
function setup(options={}){
 let now=0,frame,message;const nodes=[];
 function node(){const n={style:{},dataset:{},children:[],hidden:false,offsetWidth:200,append(...xs){this.children.push(...xs)},remove(){this.removed=true},getAttribute(k){return this[k]}};nodes.push(n);return n;}
 const stage=node();stage.clientWidth=640;stage.clientHeight=360;
 const settings={theme:'todos',font:'Verdana',font_size:20,line_spacing:120,letter_spacing:0,max_friends:3,base_size:100,max_size:250,bubbles:true,speech_duration:4,speed:150,show_names:true};
 const config={textContent:JSON.stringify({settings,characters:options.characters||[{id:'cat',theme:'mascotas'}]})};const parent={};
 vm.runInNewContext(fs.readFileSync('web/static/stream_buddies.js','utf8'),{BUDDY_WALK_METADATA:options.metadata,document:{getElementById:id=>id==='buddies'?stage:config,createElement:node},location:{search:'?preview=1',origin:'http://local'},URLSearchParams,performance:{now:()=>now},requestAnimationFrame:fn=>frame=fn,setInterval(){},addEventListener:(type,fn)=>message=fn,parent});
 return {nodes,stage,step(t){now=t;frame(t)},preview(s){message({origin:'http://local',source:parent,data:{type:'buddies-preview',settings:s}})}};
}
test('sprites travel horizontally, reverse at edges and speech expires',()=>{
 const s=setup(),actors=s.nodes.filter(n=>n.className==='buddy');assert.equal(actors.length,3);
 s.step(0);const initial=actors.map(n=>n.style.transform);
 for(let i=1;i<400;i++)s.step(i*16);
 assert.notDeepEqual(actors.map(n=>n.style.transform),initial);
 for(const a of actors){const x=Number(a.style.transform.match(/translate(?:3d|X)\(([-.\d]+)px/)[1]);assert.ok(x>=0&&x<=640-parseFloat(a.style.width));}
 assert.ok(s.nodes.filter(n=>n.className==='buddy-speech').every(n=>n.hidden));
});

test('authored twelve-frame knight uses its own frame count and idle sprite',()=>{
 const context={};vm.runInNewContext(fs.readFileSync('web/static/buddies_walk_metadata.js','utf8'),context);
 const metadata=context.BUDDY_WALK_METADATA;assert.equal(metadata['chibis-0'].frames,12);assert.equal(metadata['chibis-0'].authored,true);
 const s=setup({characters:[{id:'chibis-0',theme:'chibis'}],metadata});s.preview({max_friends:1});
 const art=s.nodes.find(n=>n.className==='buddy-art'&&!n.removed),img=art.children[0],poses=new Set();
 for(let i=0;i<600;i++){s.step(i*16);const frame=Number(art.dataset.frame);poses.add(frame);assert.ok(frame>=0&&frame<12);assert.equal(img.style.transform,`translate3d(${-frame*100/12}%,0,0)`)}
 assert.equal(poses.size,12);assert.equal(img.style.width,'1200%');
 s.preview({speed:0});s.step(10000);assert.equal(art.dataset.frame,'0');assert.equal(img.style.width,'100%');assert.match(img.src,/chibis-0-idle\.png/);
});
test('Pokemon assets preserve source frame counts and include idle and attribution files',()=>{
 const frames={pikachu:4,eevee:7,charizard:4,bulbasaur:6,squirtle:4,mewtwo:6,gengar:4,snorlax:4};
 const context={};vm.runInNewContext(fs.readFileSync('web/static/buddies_walk_metadata.js','utf8'),context);
 const metadata=context.BUDDY_WALK_METADATA,manifest=JSON.parse(fs.readFileSync('assets/sprites/walk-v3/manifest.json','utf8')),credits=JSON.parse(fs.readFileSync('assets/sprites/walk-v3/pokemon-credits.json','utf8'));
 assert.equal(credits.license,'CC BY-NC');assert.equal(Object.keys(credits.attributions).length,8);
 for(const [name,count]of Object.entries(frames)){
  const id=`pokemon-${name}`,entry=metadata[id];assert.ok(entry,`${id} metadata`);assert.equal(entry.frames,count);assert.equal(manifest[id].frames,count);
  const attribution=credits.attributions[id];assert.equal(attribution.source_species_id,{'bulbasaur':'0001','charizard':'0006','squirtle':'0007','pikachu':'0025','gengar':'0094','eevee':'0133','snorlax':'0143','mewtwo':'0150'}[name]);
  assert.equal(attribution.source_direction_row,2);assert.equal(attribution.variant,'default');assert.ok(attribution.contributors.length>0);
  for(const contributor of attribution.contributors){assert.ok(contributor.contributor);assert.ok(contributor.source_id);assert.ok(!contributor.contributor.startsWith('<@'));}
  for(const [suffix,width]of [['',128*entry.frames],['-idle',128]]){
   const file=`assets/sprites/walk-v3/${id}${suffix}.png`;assert.ok(fs.existsSync(file),file);
   const png=fs.readFileSync(file);assert.equal(png.toString('hex',0,8),'89504e470d0a1a0a');
   assert.equal(png[25],6,`${file} RGBA transparency`);
   assert.equal(png.readUInt32BE(16),width,`${file} width`);assert.equal(png.readUInt32BE(20),128,`${file} height`);
  }
 }
 assert.equal(credits.attributions['pokemon-mewtwo'].contributors.find(x=>x.source_id==='<@!702275233125630042>').contributor,'JFain');
});
test('private preview respects participant limit and zero speed',()=>{
 const s=setup();s.preview({max_friends:1,speed:0});s.step(0);
 const a=s.nodes.filter(n=>n.className==='buddy'&&!n.removed);assert.equal(a.length,1);const x=a[0].style.transform;
 s.step(1000);assert.equal(a[0].style.transform,x);
});

test('walk phase follows distance, not elapsed time, and stops at zero speed',()=>{
 const slow=setup(),fast=setup();slow.preview({max_friends:1,speed:5});fast.preview({max_friends:1,speed:10});
 for(let i=0;i<=20;i++)slow.step(i*16);
 for(let i=0;i<=10;i++)fast.step(i*16);
 const art=s=>s.nodes.find(n=>n.className==='buddy-art'&&!n.removed);
 assert.equal(art(slow).dataset.frame,art(fast).dataset.frame);
 const phases=new Set();for(let i=21;i<621;i++){slow.step(i*16);phases.add(art(slow).dataset.frame)}assert.equal(phases.size,24);
 slow.preview({speed:0});slow.step(2000);assert.equal(art(slow).dataset.frame,'0');
 const transform=art(slow).children[0].style.transform;slow.step(3000);assert.equal(art(slow).children[0].style.transform,transform);
});
