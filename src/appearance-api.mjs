import { defaults } from './palette.mjs';
import { normalizeHex } from './color-picker.mjs';

// Both appearance entry points use splash.colors; no second theme store.
const modes = new Set(['light', 'dark']);
const keys = new Set(['bg', 'accent']);
function checkMode(mode) {
    if (!modes.has(mode)) throw new TypeError('Appearance mode must be light or dark');
}
export function readAppearanceColors(settings, mode) {
    checkMode(mode);
    const saved = settings?.splash?.colors?.[mode];
    return Object.fromEntries([...keys].map(key => [key, normalizeHex(saved?.[key]) || defaults[mode][key]]));
}
export function updateAppearanceColors(settings, mode, patch) {
    checkMode(mode);
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw new TypeError('Settings are required');
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new TypeError('A color patch is required');
    const normalized = {};
    for (const [key, value] of Object.entries(patch)) {
        if (!keys.has(key)) throw new TypeError('Unknown appearance color: ' + key);
        const color = normalizeHex(value);
        if (!color) throw new TypeError('Invalid appearance color: ' + key);
        normalized[key] = color;
    }
    const before = readAppearanceColors(settings, mode);
    if (!Object.entries(normalized).some(([key, value]) => before[key] !== value)) return false;
    // Validate the complete patch before changing any saved field.
    settings.splash ??= {};
    settings.splash.colors ??= {};
    settings.splash.colors[mode] ??= {};
    Object.assign(settings.splash.colors[mode], normalized);
    return true;
}
export function createAppearanceBridge({ getSettings, save = () => {}, notify = () => {} }) {
    if (typeof getSettings !== 'function') throw new TypeError('getSettings is required');
    return Object.freeze({
        get: mode => readAppearanceColors(getSettings(), mode),
        set(mode, patch) {
            const settings = getSettings();
            if (updateAppearanceColors(settings, mode, patch)) { save(); notify(); }
            return readAppearanceColors(settings, mode);
        },
    });
}
