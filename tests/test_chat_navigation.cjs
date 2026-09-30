process.chdir(require('node:path').resolve(__dirname, '..'));
const fs = require('node:fs');
const vm = require('node:vm');
const test = require('node:test');
const assert = require('node:assert/strict');

function setup() {
  const element = () => ({style:{},setAttribute(){},textContent:'',hidden:false});
  const auto = element(); let badge, scroll, following;
  auto.before = button => {badge = button;};
  const feed = {scrollTop:0, children:[],getBoundingClientRect:()=>({top:0}),addEventListener:(_,fn)=>{scroll=fn;}};
  function card(index) { return {isConnected:true,index,getBoundingClientRect(){return {top:this.index*40-feed.scrollTop,bottom:(this.index+1)*40-feed.scrollTop};}}; }
  feed.children = Array.from({length:20},(_,i)=>card(i));
  const context = vm.createContext({window:{}, document:{getElementById:id=>id==='comment-feed'?feed:auto,createElement:element},requestAnimationFrame:fn=>fn()});
  vm.runInContext(fs.readFileSync(`${__dirname}/../web/static/chat_navigation.js`,'utf8'),context);
  const navigation = context.window.ChatNavigation;
  navigation.attach(value=>{following=value;});
  const insert = live => {
    const position=navigation.capture();
    for(const child of feed.children) child.index++;
    feed.children.unshift(card(0));
    navigation.inserted(position,live);
  };
  return {feed,badge,navigation,insert,scroll:()=>scroll(),following:()=>following};
}

test('reading position survives arriving comments and badge returns to latest',()=>{
  const page=setup();page.feed.scrollTop=200;page.scroll();
  assert.equal(page.following(),false);
  const anchor=page.feed.children[5];
  page.insert(true);page.insert(true);
  assert.equal(anchor.getBoundingClientRect().top,0);
  assert.equal(page.badge.textContent,'↑ 2 nuevos');
  assert.equal(page.badge.hidden,false);
  page.badge.onclick();
  assert.equal(page.feed.scrollTop,0);
  assert.equal(page.following(),true);
  assert.equal(page.badge.hidden,true);
});

test('restored history does not count as unread and reset clears unread',()=>{
  const page=setup();page.feed.scrollTop=120;page.scroll();
  page.insert(false);
  assert.equal(page.badge.hidden,true);
  assert.equal(page.feed.scrollTop,160);
  page.insert(true);page.navigation.reset();
  assert.equal(page.badge.hidden,true);
  assert.equal(page.following(),true);
});

test('auto follow stays at latest and manual toggle preserves its state',()=>{
  const page=setup();page.insert(true);
  assert.equal(page.feed.scrollTop,0);
  assert.equal(page.badge.hidden,true);
  page.navigation.follow(false);page.insert(true);
  assert.equal(page.following(),false);
  assert.equal(page.feed.scrollTop,40);
  page.feed.scrollTop=0;page.scroll();
  assert.equal(page.following(),true);
  assert.equal(page.badge.hidden,true);
});
