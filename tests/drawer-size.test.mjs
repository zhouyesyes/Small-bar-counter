import test from 'node:test';
import assert from 'node:assert/strict';
import {drawerWidth,drawerLimits,setDrawerWidth} from '../src/drawer-size.mjs';
test('pixel widths stay within usable space and keep device preferences separate',()=>{
 const s={};assert.equal(setDrawerWidth(s,300,390),300);assert.equal(setDrawerWidth(s,460,1024),460);
 assert.equal(drawerWidth(s,390),300);assert.equal(drawerWidth(s,1024),460);
 assert.equal(drawerWidth(s,768),408);assert.equal(drawerWidth(s,1024),460);
 assert.equal(setDrawerWidth(s,5000,390),342);assert.equal(setDrawerWidth(s,50,390),240);
 assert.equal(setDrawerWidth(s,5000,1024),540);
 assert.equal(drawerLimits(320).max,272);
});
test('legacy phone percentages do not override tablet sizing',()=>{
 const s={splash:{pageWidth:100}};assert.equal(drawerWidth(s,390),342);assert.equal(drawerWidth(s,1024),287);
 assert.equal(setDrawerWidth(s,310,390),310);assert.equal(drawerWidth(s,390),310);
});
test('visible viewport clamps the edge without switching or overwriting tablet preference',()=>{
 const oldWidth=globalThis.innerWidth,oldWindow=globalThis.window;
 try{
  globalThis.innerWidth=840;globalThis.window={visualViewport:{width:560}};
  const s={splash:{drawerWidths:{tablet:460,phone:300}}};
  assert.equal(drawerLimits().key,'tablet');assert.equal(drawerWidth(s),200);
  assert.equal(s.splash.drawerWidths.tablet,460);
  window.visualViewport.width=840;assert.equal(drawerWidth(s),460);
 }finally{
  if(oldWidth===undefined)delete globalThis.innerWidth;else globalThis.innerWidth=oldWidth;
  if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;
 }
});
