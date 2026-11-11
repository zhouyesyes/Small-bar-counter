import { installTypography } from './typography.mjs';
// 选图以后先调一下位置：拖着挪、双指 / 滑条放大，框里的就是最后用的那块
// 框的比例跟着用的地方走（头像圆的、头图扁的），切好的直接存，别的地方照常用 center/cover 显示，看到的就是框里那块
// 自己画在最上面一层，跟小吧台的页面分开（不会被重画冲掉）；像手机相册的裁剪，深色底，浅色深色模式都一样

const CSS = `
#sb-crop{position:fixed;inset:0;z-index:2147483000;background:rgba(0,0,0,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;font:14px -apple-system,"Helvetica Neue","PingFang SC",sans-serif;color:#fff;touch-action:none;padding:env(safe-area-inset-top) 16px env(safe-area-inset-bottom)}
#sb-crop .cr-tip{font-size:12.5px;color:rgba(255,255,255,.62);text-align:center}
#sb-crop .cr-frame{position:relative;overflow:hidden;background:#222;box-shadow:0 0 0 1px rgba(255,255,255,.55);cursor:grab;touch-action:none}
#sb-crop .cr-frame.round{border-radius:50%}
#sb-crop .cr-frame img{position:absolute;left:0;top:0;transform-origin:0 0;max-width:none;user-select:none;-webkit-user-drag:none;pointer-events:none}
#sb-crop .cr-zoom{width:min(280px,80vw);accent-color:#fff}
#sb-crop .cr-btns{display:flex;gap:14px}
#sb-crop .cr-btns button{min-width:96px;padding:9px 18px;border-radius:20px;border:1px solid rgba(255,255,255,.5);background:transparent;color:#fff;font-size:14px}
#sb-crop .cr-btns button.ok{background:#fff;color:#111;border-color:#fff}
`;

// file：选的图；ratio：宽 / 高；round：头像（圆框）；outW：存下来的宽度
// 返回切好的图（dataURL）；点「取消」返回 null
export function cropImage(file, { ratio = 1, round = false, outW = 900 } = {}) {
    installTypography();
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onerror = () => reject(new Error('这张图读不出来'));
        img.onload = () => open(img);
        img.src = URL.createObjectURL(file);

        function open(img) {
            const iw = img.naturalWidth, ih = img.naturalHeight;
            let W = Math.min(320, innerWidth - 48), H = W / ratio;
            if (H > innerHeight * 0.55) { H = innerHeight * 0.55; W = H * ratio; }
            const base = Math.max(W / iw, H / ih); // 刚好盖满框
            let z = 1, x = 0, y = 0;
            const scale = () => base * z;
            const clamp = () => { const s = scale(); x = Math.min(0, Math.max(W - iw * s, x)); y = Math.min(0, Math.max(H - ih * s, y)); };
            // 以框里某一点为中心缩放（双指中间 / 框中心）
            const zoomAt = (nz, px = W / 2, py = H / 2) => {
                nz = Math.min(5, Math.max(1, nz));
                const s0 = scale(), ix = (px - x) / s0, iy = (py - y) / s0;
                z = nz; const s = scale(); x = px - ix * s; y = py - iy * s; clamp(); draw();
            };

            const style = document.createElement('style'); style.textContent = CSS;
            const box = document.createElement('div'); box.id = 'sb-crop';
            box.innerHTML = `<div class="cr-tip">拖动调整位置，双指或下面的滑条放大</div>
<div class="cr-frame${round ? ' round' : ''}" style="width:${W}px;height:${H}px"></div>
<input class="cr-zoom" type="range" min="1" max="5" step="0.01" value="1" aria-label="放大">
<div class="cr-btns"><button type="button" class="no">取消</button><button type="button" class="ok">用这块</button></div>`;
            const frame = box.querySelector('.cr-frame'), slider = box.querySelector('.cr-zoom');
            img.alt = ''; img.style.width = iw + 'px'; img.style.height = ih + 'px'; frame.append(img);
            const draw = () => { img.style.transform = `translate(${x}px,${y}px) scale(${scale()})`; slider.value = String(z); };
            x = (W - iw * base) / 2; y = (H - ih * base) / 2; draw();

            // 拖：一根手指挪；两根手指捏着放大
            const pts = new Map(); let last = null;
            const rel = e => { const r = frame.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
            const pinch = () => { const [a, b] = [...pts.values()]; return { d: Math.hypot(a[0] - b[0], a[1] - b[1]), m: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] }; };
            frame.addEventListener('pointerdown', e => {
                try { frame.setPointerCapture(e.pointerId); } catch { /* 旧浏览器 */ }
                pts.set(e.pointerId, rel(e)); last = pts.size === 2 ? { ...pinch(), z } : null; e.preventDefault();
            });
            frame.addEventListener('pointermove', e => {
                if (!pts.has(e.pointerId)) return;
                const prev = pts.get(e.pointerId), now = rel(e); pts.set(e.pointerId, now);
                if (pts.size === 1) { x += now[0] - prev[0]; y += now[1] - prev[1]; clamp(); draw(); }
                else if (pts.size === 2 && last) { const p = pinch(); zoomAt(last.z * p.d / (last.d || 1), p.m[0], p.m[1]); }
                e.preventDefault();
            });
            const up = e => { pts.delete(e.pointerId); last = pts.size === 2 ? { ...pinch(), z } : null; };
            frame.addEventListener('pointerup', up); frame.addEventListener('pointercancel', up);
            frame.addEventListener('wheel', e => { e.preventDefault(); const [px, py] = rel(e); zoomAt(z * (e.deltaY < 0 ? 1.08 : 1 / 1.08), px, py); }, { passive: false });
            slider.addEventListener('input', () => zoomAt(Number(slider.value)));

            const close = out => { box.remove(); style.remove(); URL.revokeObjectURL(img.src); resolve(out); };
            box.querySelector('.no').addEventListener('click', () => close(null));
            box.querySelector('.ok').addEventListener('click', () => {
                const s = scale(), w = Math.round(Math.min(outW, (W / s))), h = Math.round(w / ratio);
                const c = document.createElement('canvas'); c.width = w; c.height = h;
                const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
                g.drawImage(img, -x / s, -y / s, W / s, H / s, 0, 0, w, h);
                close(c.toDataURL('image/jpeg', 0.85));
            });
            document.documentElement.append(style, box);
        }
    });
}
