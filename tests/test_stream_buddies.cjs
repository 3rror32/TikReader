process.chdir(require('node:path').resolve(__dirname, '..'));
const fs=require('node:fs'),vm=require('node:vm'),test=require('node:test'),assert=require('node:assert/strict');
function setup(){
 let now=0,frame,message;const nodes=[];
 function node(){const n={style:{},dataset:{},children:[],hidden:false,offsetWidth:200,append(...xs){this.children.push(...xs)},remove(){this.removed=true},getAttribute(k){return this[k]}};nodes.push(n);return n;}
 const stage=node();stage.clientWidth=640;stage.clientHeight=360;
 const settings={theme:'todos',font:'Verdana',font_size:20,line_spacing:120,letter_spacing:0,max_friends:3,base_size:100,max_size:250,bubbles:true,speech_duration:4,speed:150,show_names:true};
 const config={textContent:JSON.stringify({settings,characters:[{id:'cat',theme:'mascotas'}]})};const parent={};
 vm.runInNewContext(fs.readFileSync('web/static/stream_buddies.js','utf8'),{document:{getElementById:id=>id==='buddies'?stage:config,createElement:node},location:{search:'?preview=1',origin:'http://local'},URLSearchParams,performance:{now:()=>now},requestAnimationFrame:fn=>frame=fn,setInterval(){},addEventListener:(type,fn)=>message=fn,parent});
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
