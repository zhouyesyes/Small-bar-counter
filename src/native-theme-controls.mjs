import { normalizeHex } from './color-picker.mjs';

// Move the actual host controls: their IDs, native listeners and save path stay intact.
export const nativeThemeColors = { bg: 'blur-tint-color-picker', accent: 'quote-color-picker' };
export function createNativeThemeControls({ move, attribute, text, openColor, appearance, currentMode }) {
    const bindings = new Map();
    let writing = false;
    const hex = event => normalizeHex(event.detail?.hex) || (() => {
        const channels = String(event.detail?.rgba || '').match(/[\d.]+/g);
        return channels?.length >= 3 ? '#' + channels.slice(0, 3).map(n => Math.round(Math.min(255, Math.max(0, Number(n)))).toString(16).padStart(2, '0')).join('') : null;
    })();
    function setValue(binding, color) {
        if (!color || (binding.node.getAttribute('color') === color && (!binding.node.hex || normalizeHex(binding.node.hex) === color))) return;
        writing = true;
        try { binding.node.setAttribute('color', color); }
        finally { writing = false; }
    }
    function stylePicker(binding) {
        const shadow = binding.node.shadowRoot;
        if (!shadow || shadow.querySelector('[data-sb-native-color]')) return;
        const css = document.createElement('style'); css.dataset.sbNativeColor = '';
        css.textContent = '.button{width:13px!important;height:13px!important;min-width:13px!important;padding:0!important;border-radius:50%!important;overflow:hidden}.button-color{border-radius:50%!important}';
        shadow.append(css);
    }
    function sync(root, box) {
        const mode = currentMode();
        for (const [key, id] of Object.entries(nativeThemeColors)) {
            const node = root.querySelector('#' + id);
            if (!node) continue;
            let binding = bindings.get(key);
            if (binding?.node !== node) {
                binding?.remove();
                const row = node.parentElement;
                const label = [...row.children].find(n => n.tagName === 'SPAN');
                const code = document.createElement('code'); code.className = 'sb-native-color-code'; row.append(code);
                binding = { node, row, code, mode };
                const change = event => {
                    if (writing) return;
                    const color = hex(event); if (!color) return;
                    appearance().set(binding.mode, { [key]: color });
                };
                const click = event => { event.preventDefault(); event.stopImmediatePropagation(); openColor(binding.mode, key, row); };
                const keydown = event => { if (event.key === 'Enter' || event.key === ' ') click(event); };
                node.addEventListener('change', change);
                row.addEventListener('click', click, true); row.addEventListener('keydown', keydown, true);
                binding.remove = () => { node.removeEventListener('change', change); row.removeEventListener('click', click, true); row.removeEventListener('keydown', keydown, true); code.remove(); node.shadowRoot?.querySelector('[data-sb-native-color]')?.remove(); };
                bindings.set(key, binding);
                text(label, key === 'bg' ? '主色调' : '辅助色');
                attribute(row, 'class', row.className + ' sb-native-color');
                attribute(row, 'role', 'button'); attribute(row, 'tabindex', '0');
                attribute(row, 'aria-label', key === 'bg' ? '调整主色调' : '调整辅助色');
            }
            binding.mode = mode;
            const slot = box.querySelector(`[data-folio-slot="${key}"][data-mode="${mode}"]`);
            if (!slot) continue;
            setValue(binding, appearance().get(mode)[key]);
            // Reconnecting toolcool reinitializes from its color attribute and emits change.
            writing = true;
            try { move(binding.row, slot); } finally { writing = false; }
            stylePicker(binding);
            const code = appearance().get(mode)[key].toUpperCase();
            if(binding.code.textContent !== code)binding.code.textContent = code;
        }
        for (const slot of box.querySelectorAll('[data-folio-slot]')) {
            const fallback = slot.querySelector('[data-folio-color]');
            fallback.hidden = !!slot.querySelector('.sb-native-color');
        }
        const slider = root.querySelector('#font_scale'), counter = root.querySelector('#font_scale_counter');
        if (slider && counter && slider.parentElement === counter.parentElement) {
            const row = slider.parentElement;
            if (!row.classList.contains('sb-native-font')) {
                attribute(row, 'class', row.className + ' sb-native-font');
                text(row.querySelector('[data-i18n="Font Scale"]') || row.querySelector('small'), '字号');
            }
            move(row, box);
            const colors = box.querySelector('.sb-folio-colors');
            if (row.nextElementSibling !== colors) box.insertBefore(row, colors);
        }
    }
    function commit(mode, key, color) {
        const binding = bindings.get(key);
        if (!binding) return false;
        const previousMode = binding.mode; binding.mode = mode;
        // Native toolcool's setter emits the same change event as its original popup.
        try {
            if ('color' in binding.node) binding.node.color = color;
            else binding.node.dispatchEvent(new CustomEvent('change', { detail: { hex: color, rgba: `rgba(${color.slice(1).match(/../g).map(n => parseInt(n, 16)).join(', ')}, 1)` } }));
        } finally { binding.mode = previousMode; }
        return true;
    }
    return { sync, commit, cleanup() { for (const b of bindings.values()) b.remove(); bindings.clear(); } };
}
