const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
const b=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});
const p=await b.newPage({viewport:{width:820,height:1180}});
await p.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await p.waitForFunction(()=>window.ready);
for(const style of ['folio','default']){
await p.evaluate(style=>{setStyle(style);showPage('WorldInfo')},style);
await p.waitForTimeout(200);
await p.evaluate(async()=>{
 const entry=document.querySelector('.world_entry');const content=entry.querySelector('[name=content]');
 if(!entry.querySelector('.sb-entry-content')?.contains(content))throw Error('native content not promoted');
 if(entry.querySelector('.sb-entry-advanced').open)throw Error('advanced not initially folded');
 const depth=entry.querySelector('[name=depth]');if(!entry.querySelector('.sb-entry-common').contains(depth))throw Error('depth hidden');
 let calls=0;depth.addEventListener('input',()=>calls++);depth.value='7';depth.dispatchEvent(new Event('input',{bubbles:true}));if(calls!==1)throw Error('native event lost');
});}
await p.evaluate(async()=>{
 const {restoreWorldEntries,layoutWorldEntry}=await import('/src/world-entry-layout.mjs');
 const e=document.querySelector('.world_entry'),depth=e.querySelector('[name=depth]');restoreWorldEntries();
 if(e.querySelector('.sb-entry-common')||!e.contains(depth)||depth.value!=='7')throw Error('restore lost values');
 layoutWorldEntry(e);if(e.querySelector('[name=depth]')!==depth)throw Error('native node replaced');
});
// Export to a second browser context with no image database.
const exported=await p.evaluate(async()=>{
 const m=await import('/src/imgstore.mjs');const s={};m.configureImageStore(s,()=>{});
 const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
 const a=await m.saveImage(image),b=await m.saveImage(image);
 if(a!==b||Object.keys(s.imageData).length!==1)throw Error('image not deduplicated');return {s,src:a};
});
const other=await b.newContext();const q=await other.newPage();await q.goto('http://127.0.0.1:8870/tests/fixtures/folio-runtime.html');await q.waitForFunction(()=>window.ready);
assert(await q.evaluate(async({s,src})=>{const m=await import('/src/imgstore.mjs');m.configureImageStore(s,()=>{});const image=m.imageUrl(src);const img=new Image();img.src=image;await img.decode();return img.naturalWidth===1;},exported));
console.log('Both themes: native controls, restore, values/events; portable image export/import and deduplication passed.');
await b.close();
})().catch(e=>{console.error(e);process.exit(1)});
