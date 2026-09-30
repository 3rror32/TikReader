/* Bounded, cancellable effect queue. No TikTok or DOM dependencies. */
class EffectQueue {
 constructor({mode='enqueue',limit=10,maxAge=30000,clock=()=>Date.now()}={}){this.mode=mode;this.limit=limit;this.maxAge=maxAge;this.clock=clock;this.items=[];this.current=null;this.skipped=0;this.generation=0;this.paused=false;}
 submit(run){const item={run,at:this.clock()};if(this.current||this.paused){if(this.mode==='skip'){this.skipped++;return false;}if(this.mode==='replace')this.clear();else{if(this.items.length>=this.limit){this.skipped++;return false;}this.items.push(item);return true;}}this.start(item);return true;}
 start(item){if(this.clock()-item.at>this.maxAge){this.skipped++;this.next();return;}const token=++this.generation;this.current={cancel:()=>{}};let task;try{task=item.run()||{};}catch(_){this.skipped++;this.current=null;this.next();return;}this.current=task;Promise.resolve(task.done).catch(()=>{this.skipped++;}).finally(()=>{if(token!==this.generation)return;this.current=null;this.next();});}
 next(){if(this.current||this.paused)return;const item=this.items.shift();if(item)this.start(item);}
 clear(){this.generation++;try{this.current?.cancel?.();}catch(_){}this.current=null;this.items=[];}
 pause(){this.paused=true;}
 resume(){this.paused=false;this.next();}
 clearPending(){this.items=[];}
 stats(){return {active:!!this.current,pending:this.items.length,skipped:this.skipped,mode:this.mode,paused:this.paused};}
}
if(typeof window!=='undefined')window.EffectQueue=EffectQueue;
if(typeof module!=='undefined')module.exports=EffectQueue;
