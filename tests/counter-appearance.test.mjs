import test from 'node:test';import assert from 'node:assert/strict';
import {counterStyle,ensureCounterAppearance} from '../src/counter-appearance.mjs';
import {replyContent} from '../src/reply-content.mjs';
test('era alone selects the counter presentation; legacy styles and native page changes cannot override it',()=>{
 const s={barStyle:'folio',counterStyle:'folio',barTheme:true,theme:'auto',splash:{colors:{light:{bg:'#ffffff'}}}};const colors=s.splash.colors;
 ensureCounterAppearance(s);assert.equal(s.counterDock,true);
 for(const era of ['modern','minguo','ancient'])for(const nativeStyle of ['default','folio']){
  s.barStyle=nativeStyle;s.barTheme=!s.barTheme;ensureCounterAppearance(s);
  assert.equal(counterStyle(era),era==='modern'?'default':'folio');assert.equal(replyContent({},s,era).calendar,era==='modern');assert.equal(s.counterDock,true);
 }
 assert.equal(s.counterStyle,'folio','old preference remains an inert backup');assert.equal(s.splash.colors,colors);assert.equal(s.theme,'auto');
});
test('initializing docking no longer creates a second counter style setting',()=>{
 const s={barStyle:'default',barTheme:false};ensureCounterAppearance(s);assert.equal(s.counterDock,false);assert(!Object.hasOwn(s,'counterStyle'));
});
