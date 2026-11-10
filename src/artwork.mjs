import { modeFor } from './palette.mjs';
export function artwork(profile = {}, mode = 'light') {
    const images = profile.images?.[mode] || {};
    const fallback = kind => new URL(`../assets/opening/${mode}-${kind}.jpg`, import.meta.url).href;
    return { avatar: images.avatar || profile.avatar || fallback('avatar'), cover: images.cover || profile.cover || fallback('cover') };
}
export const artworkMode = settings => modeFor(settings);
