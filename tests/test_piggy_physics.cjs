const {test}=require('node:test');
const assert=require('node:assert/strict');
const {step}=require('../web/static/piggy_physics.js');
const body=(x,y,vx=0)=>({x,y,vx,vy:0,r:12,angle:0,spin:40});
test('gifts bounce and come to rest inside the curved bank',()=>{
 const world={width:240,height:180,bodies:[body(80,10,70)]};let bounced=false;
 for(let i=0;i<1200;i++){step(world,1/120);if(world.bodies[0].vy<0)bounced=true;}
 const b=world.bodies[0];assert.ok(bounced);assert.ok(b.x>=b.r&&b.x<=240-b.r);assert.ok(b.y<=180-b.r);assert.ok(Math.abs(b.vy)<1);
});
test('successive gifts form a supported pile without passing through each other',()=>{
 const world={width:240,height:180,bodies:[]};
 for(let n=0;n<18;n++){world.bodies.push(body(110+n%3*3,12,n%2?45:-40));for(let i=0;i<70;i++)step(world,1/120);}
 for(let i=0;i<1200;i++)step(world,1/120);
 for(const b of world.bodies){assert.ok(Number.isFinite(b.x+b.y));assert.ok(b.x>=12&&b.x<=228);assert.ok(b.y<180);}
 for(let i=0;i<world.bodies.length;i++)for(let j=i+1;j<world.bodies.length;j++){
  const a=world.bodies[i],b=world.bodies[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>22);
 }
 assert.ok(Math.max(...world.bodies.map(b=>b.y))-Math.min(...world.bodies.map(b=>b.y))>24);
});
const shapes=require('../web/static/bank_shapes.js');
const physics=require('../web/static/piggy_physics.js');
test('every animal fills its upper cavity while retaining gifts inside its contour',()=>{
 const slots={cochito:[44,16],cochita:[40,23],pato:[46,40],oso:[54,41],perro:[53,41],gato:[55,41]};
 for(const [key,shape]of Object.entries(shapes)){
  const world={width:400,height:400,bodies:[],contour:shape.map(([x,y])=>[x*4,y*4])};
  const r=9,capacity=Math.floor(physics.polygonArea(world.contour)*.76/(Math.PI*r*r));
  for(let n=0;n<capacity;n++){
   world.bodies.push({...body(slots[key][0]*4,slots[key][1]*4+r,(n%5-2)*12),r});
   for(let i=0;i<45;i++)physics.step(world,1/120);
  }
  for(let i=0;i<480;i++)physics.step(world,1/120);
  for(const b of world.bodies){const c=physics.contact(world,b);assert.ok(c.inside,key+' escaped');assert.ok(c.distance>=r-.2,key+' crossed wall');}
  const top=Math.min(...world.bodies.map(b=>b.y))/400;
  assert.ok(top<.28,key+' did not fill the head: '+top);
 }
});
