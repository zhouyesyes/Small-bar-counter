import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMe } from '../src/profile.mjs';
const context = metadata => ({
    name1: 'Current persona', chatMetadata: metadata,
    extensionSettings: { small_bar: { me: { name: 'Old global name', avatar: 'old-global.png', sign: 'Old global sign' } } },
    powerUserSettings: { personas: { 'a.png': 'Persona A', 'b.png': 'Persona B' } },
    getThumbnailUrl: (type, file) => `/thumb/${type}/${file}`,
});
test('chat overrides remain isolated and do not inherit the old global profile', () => {
    const a = context({ persona: 'a.png', small_bar: { cfg: { me: { name: 'Alice', avatar: 'idb:a', sign: 'Only A' } } } });
    const b = context({ persona: 'b.png' });
    assert.deepEqual(resolveMe(a, '', src => 'resolved:' + src), {cardName:'Persona A',name:'Alice',avatar:'resolved:idb:a',sign:'Only A',persona:''});
    assert.equal(resolveMe(b).name, 'Persona B');
    assert.equal(resolveMe(b).avatar, '/thumb/persona/b.png');
    assert.equal(resolveMe(b).sign, '');
    assert.equal(resolveMe(a).name, 'Alice');
    assert.equal(a.extensionSettings.small_bar.me.avatar, 'old-global.png');
    assert.equal(b.chatMetadata.small_bar, undefined);
});
test('selected persona and description remain live; blank overrides follow the persona', () => {
    const c = context({ persona:'a.png', small_bar:{cfg:{me:{name:'',avatar:'',sign:''}}} });
    c.powerUserSettings.persona_descriptions = {'b.png':{description:'Persona B description'}};
    assert.equal(resolveMe(c,'b.png').name,'Persona B');
    assert.equal(resolveMe(c,'b.png').avatar,'/thumb/persona/b.png');
    assert.equal(resolveMe(c,'b.png').persona,'Persona B description');
});
