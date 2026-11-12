import { modeFor } from './palette.mjs';
export function artwork(profile = {}, mode = 'light') {
    const images = profile.images?.[mode] || {};
    const fallback = kind => new URL(`../assets/opening/${mode}-${kind}.jpg`, import.meta.url).href;
    return { avatar: images.avatar || profile.avatar || fallback('avatar'), cover: images.cover || profile.cover || fallback('cover') };
}
export const artworkMode = settings => modeFor(settings);
// Landing and welcome assistant share explicit day/night art; empty cover stays neutral.
export function landingArtwork(profile={},mode='light',assistantAvatar='') {
    const images=profile.images?.[mode]||{};
    return {avatar:images.avatar||profile.avatar||assistantAvatar,cover:images.cover||profile.cover||''};
}

// The landing page and startup ticket are two views of the same personal profile.
// Keep legacy home settings as a backup; migrate them only once and never read personas.
export function personalProfile(settings) {
    const profile = (settings.splash ??= {});
    if (!profile.sharedPersonalProfile) {
        const home = settings.home || {};
        profile.images ??= {};
        for (const mode of ['light', 'dark']) {
            const images = (profile.images[mode] ??= {});
            for (const key of ['avatar', 'cover']) {
                images[key] ??= home.images?.[mode]?.[key] || profile[key] || home[key];
                if (!images[key]) delete images[key];
            }
        }
        if ((profile.signature == null || profile.signature === 'yesyes') && home.name != null) profile.signature = home.name;
        if ((profile.quote == null || profile.quote === 'a quiet seat, kept for you') && home.sign != null) profile.quote = home.sign;
        profile.sharedPersonalProfile = true;
    }
    return profile;
}
