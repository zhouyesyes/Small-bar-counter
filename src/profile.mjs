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
