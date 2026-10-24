// DESCRIPTION: Checks repeat geometry, endless camera travel and stable résumé addresses.
// INPUTS: Camera fixtures, repeat coordinates and reordered CMS station data.
// OUTPUTS: Assertions over camera and continuum public interfaces.
// DEPENDENCIES: Node assertions, continuum, camera and journey modules.
import assert from 'node:assert/strict';
import { boardPoint, boardProjection, boardTile, repeatedDestination } from '../src/lib/cosmos/continuum.js';
import { createCamera } from '../src/lib/cosmos/camera.js';
import { journeySections } from '../src/lib/cosmos/journey.js';
const world = { w:12000,h:7600 };
assert.deepEqual(boardPoint(-1,7601,world), {x:11999,y:1});
const cam = {x:150,y:-230,w:10000}, view = {w:390,h:844};
const a = boardProjection(cam,view,world);
const b = boardProjection({...cam,x:cam.x+world.w,y:cam.y-world.h},view,world);
for (const key of Object.keys(a)) assert.ok(Math.abs(a[key]-b[key])<1e-8, key);
const model = {regions:[{kind:'module',rect:{x:0,y:0,w:12000,h:7600}, module:{id:'gallery',title:'Art < & work'}, leaves:[{x:20,y:20,w:9000,h:6500,fill:'#eeeeea',role:'content'}]}]};
const svg=boardTile(model,world);
assert.ok(svg.includes('Art &lt; &amp; work'));
assert.ok(svg.includes('<use href="#painting" transform='));
assert.equal(repeatedDestination(model,-1,-1,world),'gallery');
assert.equal(repeatedDestination(model,50,50,world),null);
const viewport={clientWidth:390,clientHeight:844,classList:{toggle(){}}};
const plane={style:{setProperty(){}}};
const camera=createCamera(viewport,plane,{world,getConfig:()=>({}),isReduced:()=>true});
camera.dragStart(); camera.dragBy(1000,1000,16); camera.tick(16);
assert.ok(camera.state.x<0 && camera.state.y<0, 'Pan must cross the original board edge');
const p=camera.toWorld(195,422);
assert.deepEqual(p,[camera.state.x,camera.state.y]);
camera.dragEnd();
await camera.flyTo(camera.overview(),{immediate:true});
assert.equal(camera.state.x,world.w/2);
const sections=[{id:'career',heading:'Experience',entries:[{id:'first-role',title:'Role A'},{id:'second-role',title:'Role B'}]}];
const initial=journeySections({sections})[0];
sections[0].heading='Professional journey'; sections[0].entries.reverse();
const reordered=journeySections({sections})[0];
assert.equal(initial.id,reordered.id);
assert.equal(initial.stations[0].id,reordered.stations[1].id);
const collisions=journeySections({sections:[{id:'career'},{id:'career'},{id:'career-2'}]});
assert.equal(new Set(collisions.map(s=>s.id)).size,3);
console.log('ok seamless repeats, recursive echoes, negative-coordinate picking, unbounded panning and persistent station IDs');
