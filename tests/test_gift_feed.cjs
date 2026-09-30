process.chdir(require('node:path').resolve(__dirname, '..'));
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('gift feed jumps only on new gifts or increased streaks and keeps gift art when avatars are hidden',()=>{
 function node(){return {children:[],className:'',classList:{values:[],add(v){this.values.push(v)}},append(...ns){this.children.push(...ns)},replaceChildren(...ns){this.children=ns}};}
 const window={};vm.runInNewContext(fs.readFileSync('web/static/gift_feed.js','utf8'),{window,document:{createElement:node},URL});
 const s={show_avatar:false,show_name:true,animation:'fade'},g={id:'a',user:'Luna',gift:'Rosa',count:1,image_url:'https://example.com/rose.png'};
 function draw(gifts){const root=node();window.GiftFeed.render(root,gifts,s,'session',false);return root.children;}
 assert.deepEqual(draw([g])[0].classList.values,[]);
 assert.deepEqual(draw([g])[0].classList.values,[]);
 const updated=draw([{...g,count:3}])[0];assert.ok(updated.classList.values.includes('gift-feed-new'));
 assert.equal(updated.children.at(-1).children.at(-1).children[0].src,g.image_url);
 assert.ok(draw([{...g,id:'b'}])[0].classList.values.includes('gift-feed-new'));
 assert.equal(draw([{id:'rank:luna',user:'Luna',gift:'Aportes anteriores del LIVE',count:1,diamonds:25,summary:true}]).length,0);
});
