process.chdir(require('node:path').resolve(__dirname, '..'));
const test=require('node:test');const assert=require('node:assert/strict');const EffectQueue=require('../web/static/effect_queue.js');
const flush=()=>new Promise(r=>setImmediate(r));
test('effect queue preserves pending and wait for completion',async()=>{const q=new EffectQueue();let finish;const seen=[];q.submit(()=>{seen.push(1);return {done:new Promise(r=>finish=r)};});q.submit(()=>{seen.push(2);return {done:Promise.resolve()};});assert.deepEqual(seen,[1]);finish();await flush();assert.deepEqual(seen,[1,2]);assert.equal(q.stats().pending,0);});
test('skip and bounded queues do not execute extra effects',()=>{const q=new EffectQueue({mode:'skip'});q.submit(()=>({done:new Promise(()=>{})}));assert.equal(q.submit(()=>assert.fail()),false);assert.equal(q.skipped,1);const b=new EffectQueue({limit:1});b.submit(()=>({done:new Promise(()=>{})}));assert.equal(b.submit(()=>({})),true);assert.equal(b.submit(()=>assert.fail()),false);});
test('replacement cancels current and old completion cannot resume stale queue',async()=>{const q=new EffectQueue({mode:'replace'});let canceled=false,finish;let newDone;q.submit(()=>({cancel:()=>{canceled=true;},done:new Promise(r=>finish=r)}));q.submit(()=>({done:new Promise(r=>newDone=r)}));assert.equal(canceled,true);finish();await flush();assert.equal(q.stats().active,true);newDone();await flush();assert.equal(q.stats().active,false);});
test('expired pending effects skipped and clear drops queued work',async()=>{let now=0;const q=new EffectQueue({clock:()=>now,maxAge:30});let finish;q.submit(()=>({done:new Promise(r=>finish=r)}));q.submit(()=>assert.fail('expired'));now=40;finish();await flush();assert.equal(q.skipped,1);q.submit(()=>({done:new Promise(()=>{})}));q.submit(()=>assert.fail('cleared'));q.clear();assert.equal(q.stats().pending,0);assert.equal(q.stats().active,false);});

test('pausing or removing pending work never cancels the active rose',async()=>{
 const q=new EffectQueue();let finish,canceled=false,second=false;
 q.submit(()=>({done:new Promise(r=>finish=r),cancel:()=>canceled=true}));
 q.submit(()=>{second=true;return {};});q.pause();finish();await flush();
 assert.equal(canceled,false);assert.equal(second,false);assert.equal(q.stats().pending,1);
 q.resume();await flush();assert.equal(second,true);
 q.submit(()=>({done:new Promise(()=>{}),cancel:()=>canceled=true}));q.submit(()=>assert.fail('discarded'));
 q.clearPending();assert.equal(q.stats().active,true);assert.equal(canceled,false);
});
