import test from 'node:test';import assert from 'node:assert/strict';
import {counterStyle,ensureCounterAppearance} from '../src/counter-appearance.mjs';
import {replyContent} from '../src/reply-content.mjs';
test('migrate the visible counter and docking choice once, then native page changes leave them intact',()=>{
 for(const style of ['default','folio'])for(const enabled of [false,true]){
  const s={barStyle:style,barTheme:enabled,theme:'auto',splash:{colors:{light:{bg:'#ffffff'}}}};const colors=s.splash.colors;
  ensureCounterAppearance(s);assert.equal(counterStyle(s),style);assert.equal(s.counterDock,enabled);
  s.barStyle=style==='default'?'folio':'default';s.barTheme=!enabled;ensureCounterAppearance(s);
  assert.equal(counterStyle(s),style);assert.equal(s.counterDock,enabled);assert.equal(s.splash.colors,colors);assert.equal(s.theme,'auto');
  assert.equal(replyContent({},s).calendar,style==='default');
 }
});
test('changing the counter style does not change native page styling or the shared palette',()=>{
 const s={barStyle:'folio',barTheme:false,counterStyle:'default',counterDock:true,theme:'dark'};ensureCounterAppearance(s);
 s.counterStyle='folio';assert.equal(s.barStyle,'folio');assert.equal(s.barTheme,false);assert.equal(s.theme,'dark');
});
