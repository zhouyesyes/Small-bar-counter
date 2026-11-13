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
