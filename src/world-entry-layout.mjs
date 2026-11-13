// Reorder native controls without replacing their nodes, values or event handlers.
const layouts = new Map();
export function layoutWorldEntry(entry) {
    for (const old of layouts.keys()) if (!old.isConnected) layouts.delete(old);
    const body = entry.querySelector('.inline-drawer-content');
    const content = body?.querySelector('textarea[name="content"]');
    if (!body || !content || layouts.has(entry)) return;
    const moves = [];
    const move = (node, target) => {
        const marker = document.createComment('sb-world-original');
        node.before(marker); moves.push([node, marker]); target.append(node);
    };
    const common = document.createElement('div');common.className = 'sb-entry-common';
    const text = document.createElement('label');text.className = 'sb-entry-content';
    const caption = document.createElement('span');caption.textContent = '内容';text.append(caption);
    const advanced = document.createElement('details');advanced.className = 'sb-entry-advanced';
    const summary = document.createElement('summary');summary.textContent = '高级设置 · 匹配、递归、分组与时效';advanced.append(summary);
    const fields = [['position','位置'],['depth','深度'],['order','顺序'],['probability','触发 %'],['key','主要关键词']];
    for (const [name, title] of fields) {
        const control = entry.querySelector(`[name="${name}"]`);
        if (!control) continue;
        const native = control.closest('.world_entry_form_control');
        if (native && native !== body && entry.contains(native) && !native.contains(content)) {
            move(native, common);
        } else {
            const label = document.createElement('label');label.textContent = title;
            common.append(label);move(control,label);
        }
    }
    move(content, text);
    // All less frequent options remain intact in their original containers.
    for (const child of [...body.children]) move(child, advanced);
    body.append(common,text,advanced);
    entry.classList.add('sb-entry-layout');
    layouts.set(entry,{moves,common,text,advanced});
}
export function restoreWorldEntries() {
    for (const [entry, state] of layouts) {
        for (const [node, marker] of state.moves.reverse()) if (marker.parentNode) marker.replaceWith(node);
        state.common.remove();state.text.remove();state.advanced.remove();entry.classList.remove('sb-entry-layout');
    }
    layouts.clear();
}
