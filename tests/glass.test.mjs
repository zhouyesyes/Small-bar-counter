import test from 'node:test';import assert from 'node:assert/strict';
import {glassSettings,setGlassSetting} from '../src/glass.mjs';
import {buildState} from '../src/core.mjs';
test('glass bounds preserve zero, invalid values use defaults, and unrelated settings survive',()=>{
 const settings={glass:{transparency:0,blur:100,width:100},splash:{cover:'private-local-image'},theme:'dark'};
 assert.deepEqual(glassSettings(settings),{enabled:true,transparency:0,blur:40,width:100});
 setGlassSetting(settings,'width',30);assert.equal(settings.glass.width,60);
 setGlassSetting(settings,'blur',0);assert.equal(settings.glass.blur,0);
 setGlassSetting(settings,'transparency',100);assert.equal(settings.glass.transparency,100);
 assert.equal(settings.splash.cover,'private-local-image');assert.equal(settings.theme,'dark');
 assert.equal(glassSettings({glass:{width:'bad',blur:null}}).width,94);assert.equal(glassSettings({glass:{blur:null}}).blur,16);
});
test('historical cards resolve the chosen reply including deltas, never the current snapshot',()=>{
 const raw=value=>'酒杯: '+JSON.stringify({version:1,mode:'default',...value});
 const messages=[{id:'first',raw:raw({scene:{location:'初见的吧台'},drink:{name:'青梅金汤力',cupType:'highball',colors:['#ddeebb','#aabbcc']},calendar:{date:'2026-11-20',events:[]}})},
 {id:'second',raw:raw({scene:{location:'雨停后的街口'},drink:{name:'樱桃曼哈顿',cupType:'coupe'}})},
 {id:'adaptive',raw:'酒杯: '+JSON.stringify({version:1,mode:'adaptive',drink:{name:'烟橙古典'}})}];
 const state=buildState(messages);assert.equal(state.cocktailLog.length,3);
 const first=state.cocktailLog[0],second=state.cocktailLog[1];
 assert.equal(first.snapshot.scene.location,'初见的吧台');assert.equal(first.snapshot.drink.name,'青梅金汤力');
 assert.equal(second.snapshot.scene.location,'雨停后的街口');assert.equal(second.snapshot.calendar.date,'2026-11-20');
 assert.equal(second.snapshot.drink.cupType,'coupe');assert.equal(first.snapshot.drink.cupType,'highball');
 assert.equal(Object.getOwnPropertyDescriptor(first,'snapshot').enumerable,false);
 assert(!JSON.stringify(first).includes('初见的吧台'),'summaries must not serialize entire hidden snapshots');
 first.snapshot.scene.location='accidental edit';assert.equal(first.snapshot.scene.location,'初见的吧台');
 assert.equal(buildState(messages,{history:false}).cocktailLog.length,0);
});
