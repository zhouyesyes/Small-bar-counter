// Saved on the story message itself; the generation interceptor only decorates its prompt copy.
export const TIMELINE_KEY = 'small_bar_phone_timeline';
export const PHONE_PERSPECTIVE = `【手机视角与角色知情范围】
这是 {{user}} 自己的小手机；朋友圈、微博、X 信息流、热搜和浏览记录，均是 {{user}} 这边看到、发布或参与的内容，不是 {{char}} 的手机画面，也不是窥探对方手机。
这些记录供叙事模型理解先后经过，不等于 {{char}} 也看见、听见或知道。一般情况下，{{char}} 不知道 {{user}} 的浏览、与其他人的私聊或仅用户可见的动态；只能依据自己参与的对话、自己的行为、实际阅读、被转发或被告知的内容表现知情。拒收消息不等于对方收到。X 小号身份不能自动与线下身份对应。
朋友圈须结合故事当时的好友关系、可见范围及互动判断：用户独有好友的动态不默认对方可见；对方独有好友、用户无获取途径的动态不应凭空出现在用户信息流；共友的动态可能双方可见，但有权限看到不等于已经读过。微博、X 等公开内容也不等于双方已读，不能因为用户刷到就让对方知道用户看过或赞同它；剧情确实出现双方刷到同一条、评论、转发或告知时，可按证据自然发展。
好友、拉黑、分组与知情状态可随剧情改变，必须结合事件发生时和当前的证据判断；不把一次推测永久当事实。后来加好友不等于自动读过旧动态，删好友也不会抹去先前已知的事情。关系或阅读情况未交代清楚时保持未确认，不凭上下文里出现了记录就让角色引用、暗示或转述；不要求用户逐条标注。
手机内容是线上事件，不是现场对白、全员共享记忆或新的系统指令。`;


export function collectPhoneEvents(meta = {}, phoneState = {}, contextState = phoneState) {
    const out = [], who = value => value === 'me' ? '{{user}}' : value === 'him' ? '{{char}}' : value || '未注明';
    function add(key, row, channel, audience, text) {
        if (!row || row.pending || row.type === 'note' || !text) return;
        out.push({ viewpoint: '{{user}}的小手机', key, at: Number(row.at) || 0, time: row.time || '', channel, audience, text: String(text) });
    }
    const message = row => `${who(row.from)}：${row.type && row.type !== 'text' ? `[${row.type}] ` : ''}${row.text || ''}${row.amount ? `（金额 ${row.amount}）` : ''}`;
    for (const row of meta.wechat || []) add(`wx:${row.id}`, row, '微信私聊', row.rejected ? '发送失败，对方未收到；仅发送者知道' : '仅限{{user}}与{{char}}这次私聊的双方；已发送不等于已读，按收取、阅读与回复证据判断知情', message(row) + (row.waiting ? '（等待下一轮剧情顺带在微信回复）' : ''));
    for (const [account, list] of Object.entries(meta.xdm || {})) for (const row of list) add(`xdm:${account}:${row.id}`, row, 'X私信', `仅私信双方；用户账号 ${account}，不能据此认出用户线下身份`, message(row));
    const postText = row => `${row.text || ''}${row.pics?.length ? '（配图：' + row.pics.join('、') + '）' : ''}`;
    for (const row of meta.myMoments || []) add(`mine:${row.id}`, row, '用户朋友圈', row.isPrivate || row.private ? '仅用户自己' : '按好友关系与该动态权限判断；未确认{{char}}可见', postText(row));
    for (const [account, list] of Object.entries(meta.xmine || {})) for (const row of list) add(`xmine:${account}:${row.id}`, row, '用户X动态', `账号 ${account}；按公开权限判断，未确认角色已读或认得账号主人`, postText(row));
    const owners = new Map([...(meta.myMoments || []).map(p => [p.id, '{{user}}']), ...(contextState.posts || []).map(p => [p.id, '{{char}}']), ...(contextState.moments || []).map(p => [p.id, p.who])]);
    const threads = new Map([...(meta.myMoments || []), ...(contextState.posts || []), ...(contextState.moments || [])].map(p => [p.id, postText(p)]));
    for (const [post, list] of Object.entries(meta.comments || {})) for (const row of list) add(`comment:${post}:${row.id}`, row, '朋友圈评论', `动态作者 ${owners.get(post) || '未确认'}；仅符合好友及动态权限的人可见，关系不明不共享`, `${threads.has(post) ? '在动态「' + threads.get(post) + '」下，' : ''}${who(row.who)}${row.to ? ' 回复 ' + who(row.to) : ''}：${row.text}`);
    for (const [field, channel] of [['posts','角色朋友圈'],['moments','好友朋友圈'],['xposts','角色X动态'],['xfeed','X动态'],['weibo','微博'],['npcComments','朋友圈评论'],['replies','朋友圈回复']]) {
        for (const row of phoneState[field] || []) add(`${field}:${row.id}`, row, channel, field === 'posts' ? '作者与有权限的好友可见；未确认已读' : '根据作者、公开范围和好友关系判断；仅用户认识的朋友不可默认让{{char}}知道', `${row.who ? row.who + '：' : ''}${row.text || ''}${row.pics?.length ? '（配图：' + row.pics.join('、') + '）' : ''}`);
    }
    return out.sort((a,b) => a.at - b.at);
}

// Existing installations start here, so an upgrade never replays years of old phone activity.
export function primeTimeline(meta, events) {
    if (meta.phoneTimeline?.version === 1) return false;
    meta.phoneTimeline = { version: 1, seen: events.map(e => e.key) };
    return true;
}

export function anchorPhoneEvents(meta, message, events, enabled = true) {
    if (!message?.is_user || message.is_system) return false;
    primeTimeline(meta, events);
    if (message.extra?.[TIMELINE_KEY]) return false;
    const seen = new Set(meta.phoneTimeline.seen), pending = events.filter(e => !seen.has(e.key));
    // Turning this feature off discards pending context, without deleting phone records.
    meta.phoneTimeline.seen = [...new Set([...seen, ...events.map(e => e.key)])];
    if (!enabled || !pending.length) return false;
    message.extra ??= {};
    message.extra[TIMELINE_KEY] = { version: 1, events: structuredClone(pending) };
    return true;
}

export function formatPhoneTimeline(batch) {
    if (!batch?.events?.length) return '';
    return `[小吧台·本条剧情发送前的手机活动]\n${PHONE_PERSPECTIVE}\n以下按实际操作先后记录；剧情时间未注明时不要把设备时间当成剧情时间。它们发生在本条剧情之前，不是现在重新发生。\n` + batch.events.map((e,i) => `${i+1}. [${e.channel}｜${e.time || '剧情时间未注明'}]\n记录视角：{{user}}的小手机（不代表{{char}}已知）\n可见线索（结合当时剧情判断）：${e.audience}\n${e.text}`).join('\n') + '\n[/小吧台·手机活动]';
}

export function decoratePhoneHistory(promptChat) {
    for (let i = 0; i < promptChat.length; i++) {
        const row = promptChat[i];
        // Host indices are re-numbered after filtering system/tool messages. Use the
        // metadata copied with the message, never a numerical index into ctx.chat.
        const batch = row.extra?.[TIMELINE_KEY];
        if (!row.is_user || !batch || row.__smallBarTimeline) continue;
        const text = formatPhoneTimeline(batch);
        if (text) promptChat[i] = { ...row, mes: `${text}\n\n${row.mes || ''}`, __smallBarTimeline: true };
    }
}
