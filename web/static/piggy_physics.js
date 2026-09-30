/* Small fixed-step circle solver for the glass bank. Units are CSS pixels. */
(function(root) {
  function polygonArea(points){return Math.abs(points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0))/2;}
  function contact(world,b){
    const points=world.contour;let inside=false,best=Infinity,cx=0,cy=0;
    for(let i=0,j=points.length-1;i<points.length;j=i++){
      const [ax,ay]=points[j],[bx,by]=points[i];
      if((ay>b.y)!==(by>b.y)&&b.x<(bx-ax)*(b.y-ay)/(by-ay)+ax)inside=!inside;
      const dx=bx-ax,dy=by-ay,t=Math.max(0,Math.min(1,((b.x-ax)*dx+(b.y-ay)*dy)/(dx*dx+dy*dy)));
      const x=ax+t*dx,y=ay+t*dy,d=Math.hypot(b.x-x,b.y-y);
      if(d<best){best=d;cx=x;cy=y;}
    }
    return {inside,distance:best,x:cx,y:cy};
  }
  function contain(world,b){
    for(let pass=0;pass<4;pass++){
      const c=contact(world,b);if(c.inside&&c.distance>=b.r-.01)break;
      if(c.distance<.00001){b.x+=.01;b.y+=.01;continue;}
      const sign=c.inside?1:-1,nx=(b.x-c.x)/c.distance*sign,ny=(b.y-c.y)/c.distance*sign;
      const correction=c.inside?b.r-c.distance:b.r+c.distance;
      b.x+=nx*correction;b.y+=ny*correction;
      const speed=b.vx*nx+b.vy*ny;
      if(speed<0){const restitution=Math.abs(speed)>65?.22:0;b.vx-=(1+restitution)*speed*nx;b.vy-=(1+restitution)*speed*ny;b.vx*=.94;b.spin*=.88;}
    }
  }
  function step(world, dt) {
    const {bodies, width:w, height:h} = world;
    for (const b of bodies) {
      b.vy += 1000 * dt;
      b.x += b.vx * dt; b.y += b.vy * dt;
      b.angle += b.spin * dt;
      b.vx *= Math.exp(-.5 * dt);
    }
    // Repeated contact passes keep a resting pile stable under new gifts.
    for (let pass=0; pass<6; pass++) {
      for (let i=0; i<bodies.length; i++) {
        const a=bodies[i];
        for (let j=i+1; j<bodies.length; j++) {
          const b=bodies[j], dx=b.x-a.x, dy=b.y-a.y;
          const distance=Math.hypot(dx,dy), radius=a.r+b.r;
          if (distance>=radius) continue;
          const nx=distance?dx/distance:1, ny=distance?dy/distance:0;
          const overlap=(radius-distance)*.5;
          a.x-=nx*overlap; a.y-=ny*overlap; b.x+=nx*overlap; b.y+=ny*overlap;
          const approach=(b.vx-a.vx)*nx+(b.vy-a.vy)*ny;
          if (approach<0) {
            const impulse=-approach*(Math.abs(approach)>55?1.25:1)*.5;
            a.vx-=impulse*nx; a.vy-=impulse*ny; b.vx+=impulse*nx; b.vy+=impulse*ny;
            a.vx*=.97; b.vx*=.97; a.spin*=.92; b.spin*=.92;
          }
        }
        if(world.contour){contain(world,a);continue;}
        if(a.x<a.r){a.x=a.r;a.vx=Math.abs(a.vx)*.3;a.spin*=.8;}
        if(a.x>w-a.r){a.x=w-a.r;a.vx=-Math.abs(a.vx)*.3;a.spin*=.8;}
        // Curved bottom encourages the gifts to roll toward the belly.
        const u=(a.x-w/2)/(w/2), floor=h-a.r-h*.22*u*u;
        if(a.y>floor){
          a.y=floor;
          if(a.vy>0) a.vy=a.vy>65?-a.vy*.28:0;
          a.vx+=-u*18*dt; a.vx*=.9; a.spin*=.86;
        }
      }
    }
  }
  const api={step,contact,contain,polygonArea};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PiggyPhysics=api;
})(typeof window==='undefined'?globalThis:window);
