const states = new WeakMap();
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function updateLyrics(el, lyrics, current, trackKey = '', seconds = 0) {
    if (!el) return;
    let state = states.get(el);
    if (!state) {
        state = { lyrics: null, current: null, trackKey: '', holdUntil: 0 };
        states.set(el, state);
        const hold = () => { state.holdUntil = Date.now() + 4000; };
        el.addEventListener('touchstart', hold, { passive: true });
        el.addEventListener('touchmove', hold, { passive: true });
        el.addEventListener('wheel', hold, { passive: true });
        el.addEventListener('pointerdown', hold, { passive: true });
    }
    const changed = state.lyrics !== lyrics || state.trackKey !== trackKey;
    if (changed) {
        state.lyrics = lyrics; state.trackKey = trackKey; state.current = null; state.holdUntil = 0;
        el.innerHTML = lyrics.length ? lyrics.map((line, index) => `<button type="button" class="sb-lyric-line" data-act="mlyric" data-line="${index}">${line.words?.length ? line.words.map(word => `<span class="sb-lyric-word">${escape(word.text)}</span>`).join('') : escape(line.text)}</button>`).join('') : '<div class="sb-lyric-empty">暂无歌词</div>';
        el.scrollTop = 0;
    }
    if (state.current !== current) {
        el.querySelector('.cur')?.classList.remove('cur');
        const line = el.querySelector(`[data-line="${current}"]`);
        line?.classList.add('cur');
        el.querySelectorAll('[data-line]').forEach((row, index) => {
            row.classList.toggle('played-line', index < current);
            row.classList.toggle('upcoming-line', index > current);
        });
        state.current = current;
    }
    const active = el.querySelector('.cur');
    const words = lyrics[current]?.words;
    if (active && words) active.querySelectorAll('.sb-lyric-word').forEach((span, i) => {
        span.classList.toggle('played', seconds >= words[i].end);
        span.classList.toggle('active', seconds >= words[i].start && seconds < words[i].end);
    });
    // Only scroll this lyric viewport; never scroll the containing chat or drawer.
    const line = el.querySelector('.cur');
    if (line && Date.now() >= state.holdUntil) {
        const top = Math.max(0, line.offsetTop - (el.clientHeight - line.offsetHeight) / 2);
        if (Math.abs(el.scrollTop - top) > 2) el.scrollTo({ top, behavior: changed ? 'auto' : 'smooth' });
    }
}
