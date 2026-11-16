import test from 'node:test';import assert from 'node:assert/strict';
import {replyContent,phoneSideStatus} from '../src/reply-content.mjs';
import {buildInjection,mustWrite} from '../src/prompt.mjs';
import {cocktailProtocol} from '../src/cocktail-state.mjs';
import {calendarOnlyProtocol} from '../src/calendar-state.mjs';
test('legacy choices migrate by interpretation without enabling previously disabled content',()=>{
 const c={noAutoStatus:true},s={saveMode:true};assert.deepEqual(replyContent(c,s),{status:false,calendar:false,music:true,phone:false});assert.deepEqual(c,{noAutoStatus:true});
 assert.deepEqual(replyContent({},s),{status:true,calendar:false,music:true,phone:false});
 assert.equal(replyContent({},{barStyle:'default'}).calendar,true);assert.equal(replyContent({},{barStyle:'folio'}).calendar,false);
 assert.deepEqual(replyContent({autoStatus:false,autoCalendar:true,autoMusicPick:false,autoPhone:true,noAutoStatus:true},s),{status:false,calendar:true,music:false,phone:true});
});
test('all combinations build only enabled content instructions',()=>{
 for(let bits=0;bits<16;bits++){
  const autoStatus=!!(bits&1),autoPhone=!!(bits&2),autoPick=!!(bits&4),calendar=!!(bits&8);
  const s=buildInjection({autoStatus,autoPhone,autoPick})+mustWrite({autoStatus,autoPhone,autoPick});
  assert.equal(s.includes('心声: 心里想的一句话'),autoStatus);assert.equal(s.includes('动态: 正文'),autoPhone);assert.equal(s.includes('选曲: 歌名'),autoPick);
  const protocol=cocktailProtocol('default',{calendar:{events:[],history:[{text:'私存旧记录'}]}},{calendar});
  assert.equal(protocol.includes('【剧情月历 · 增量更新】'),calendar);assert(!protocol.includes('私存旧记录'));
 }
});
test('calendar works alone, and phone side updates obey its independent switch',()=>{
 const p=calendarOnlyProtocol({calendar:{events:[]}},'adaptive');assert(p.includes('mode:"adaptive"'));assert(!p.includes('酒杯状态面板'));
 assert.equal(phoneSideStatus({autoPhone:false},{}),'');assert.match(phoneSideStatus({autoPhone:true,autoStatus:false},{}),/不写时间、在哪、心声/);
 assert(buildInjection({autoStatus:false,autoPhone:false,autoPick:false,waiting:'我发的待回复消息'}).includes('我发的待回复消息'));
});
