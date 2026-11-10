// Subscribe before the host continues loading other extensions.
import { getContext } from '../../../extensions.js';
import { startSplash, configureSplash, progress, splashFailed } from './src/splash.mjs';
const context = getContext();
const settings = (context.extensionSettings.small_bar ??= {});
configureSplash(settings, () => context.saveSettingsDebounced(), context);
startSplash();
import('./src/main.mjs').then(() => progress(1 / 3)).catch(error => {
    splashFailed();
    console.error('[Small Bar] Initialization failed', error);
});
