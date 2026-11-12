// Cover ownership is explicit: side profiles never inherit the character's drawer art.
export function profileCover(kind,config={},currentCover='',account={}) {
    if(kind==='coverWx')return config.coverWx||'';
    if(kind==='coverX')return config.coverX||'';
    if(kind==='coverXMe')return account.cover||config.coverXMe||'';
    if(kind!=='cover')throw new TypeError('Unknown cover owner: '+kind);
    const cover=config.cover||{};
    if(cover.mode==='fixed')return cover.fixed||'';
    if(cover.mode==='pick')return (cover.images?.find(item=>item.tag&&currentCover&&(currentCover.includes(item.tag)||item.tag.includes(currentCover)))||cover.images?.[0])?.src||'';
    return '';
}
// User profile overrides belong to one chat; legacy global `settings.me` is never a fallback.
export function resolveMe(context, personaAvatar = '', image = src => src) {
    const profile = context.chatMetadata?.small_bar?.cfg?.me || {};
    const pu = context.powerUserSettings || {};
    const file = personaAvatar || context.chatMetadata?.persona || '';
    const cardName = pu.personas?.[file] || context.name1 || '我';
    const avatar = file ? (context.getThumbnailUrl?.('persona', file) ?? `/thumbnail?type=persona&file=${encodeURIComponent(file)}`) : '';
    return {
        cardName, name: profile.name || cardName, sign: profile.sign || '',
        avatar: (profile.avatar && image(profile.avatar)) || avatar,
        persona: pu.persona_descriptions?.[file]?.description || pu.persona_description || '',
    };
}
