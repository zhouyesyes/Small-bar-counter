import test from 'node:test';import assert from 'node:assert/strict';
import {modeFor,phoneModeFor,watchSystemTheme} from '../src/palette.mjs';
test('automatic mode follows the OS independently of host colors; explicit modes win',()=>{
 const old=globalThis.matchMedia;let dark=true;globalThis.matchMedia=()=>({matches:dark});
 try{assert.equal(modeFor({theme:'auto'}),'dark');dark=false;assert.equal(modeFor({}),'light');assert.equal(modeFor({theme:'dark'}),'dark');assert.equal(phoneModeFor({theme:'auto',phoneTheme:'dark'}),'dark');assert.equal(phoneModeFor({theme:'dark',phoneTheme:'auto'}),'dark');}finally{globalThis.matchMedia=old;}
});
test('theme changes and returning from background notify without changing preferences',()=>{
 const old={matchMedia:globalThis.matchMedia,document:globalThis.document,window:globalThis.window};
 const media=new EventTarget();media.matches=false;const doc=new EventTarget();doc.hidden=false;const win=new EventTarget();
 globalThis.matchMedia=()=>media;globalThis.document=doc;globalThis.window=win;
 try{const seen=[],stop=watchSystemTheme(mode=>seen.push(mode));media.matches=true;media.dispatchEvent(new Event('change'));assert.deepEqual(seen,['dark']);
 doc.hidden=true;media.matches=false;doc.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(seen,['dark']);doc.hidden=false;doc.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(seen,['dark','light']);
 media.matches=true;win.dispatchEvent(new Event('pageshow'));assert.deepEqual(seen,['dark','light','dark']);stop();media.matches=false;media.dispatchEvent(new Event('change'));assert.equal(seen.length,3);
 }finally{for(const [key,value]of Object.entries(old))if(value===undefined)delete globalThis[key];else globalThis[key]=value;}
});
test('older WebKit media-query listeners are supported and cleaned up',()=>{
 const old=globalThis.matchMedia;let listener,removed=false;const media={matches:false,addListener:f=>listener=f,removeListener:f=>{removed=f===listener}};globalThis.matchMedia=()=>media;
 try{let mode;const stop=watchSystemTheme(value=>mode=value);media.matches=true;listener();assert.equal(mode,'dark');stop();assert(removed);}finally{globalThis.matchMedia=old;}
});
