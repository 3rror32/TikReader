const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');

function node(tag,text='') {return {tag,textContent:text,children:[],dataset:{},classList:{toggle(){}},append(...children){this.children.push(...children);},replaceChildren(...children){this.children=children;},set innerHTML(_){throw Error('Unsafe HTML insertion');}};}
function load(file,name,context) {
  const source=fs.readFileSync(path.join(__dirname,'..','web','static',file),'utf8');
  const start=source.indexOf(` function ${name}(`);
  assert.notEqual(start,-1,`${name} renderer exists`);
  const end=source.indexOf('\n }',start)+3;
  return vm.runInNewContext(`${source.slice(start,end)};${name}`,context);
}
test('passive native poll panel renders observed totals and untrusted text safely',()=>{
  const nativePoll=node('section');
  const render=load('interactivity.js','renderNativePoll',{nativePoll,el:node});
  render({title:'<img src=x>',status:'active',total_votes:0,options:[{index:0,text:'<script>',votes:0}]});
  const text=nativePoll.children.map(child=>child.textContent).join(' ');
  assert.match(text,/Encuesta de TikTok/);assert.match(text,/<img src=x>/);assert.match(text,/<script>/);assert.match(text,/0/);
  assert.equal(nativePoll.children.some(child=>child.tag==='button'),false);
  render(null);
  assert.match(nativePoll.children.map(child=>child.textContent).join(' '),/Sin encuesta de TikTok/);
});
test('native question panel identifies source and preserves escaped text',()=>{
  const render=load('production.js','questionRow',{document:{createElement:node},api(){},questions(){}});
  const row=render({id:'native:1',source:'tiktok',text:'<script>',users:['@a'],count:1,answered:false});
  assert.match(row.children[0].textContent,/Preguntas de TikTok/);
  assert.match(row.children[0].textContent,/<script>/);
  assert.equal(row.children[1].textContent,'Marcar respondida');
});
