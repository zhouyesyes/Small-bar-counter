// 小吧台的提示词：默认写在这里，她可以在设置里改（改过的存在设置里，清空就回到默认）

export const DEFAULT_PROMPT = `【小吧台】
每次回复正文写完以后，另起一行，写一段 {{char}} 此刻的状态，用 <!--SB 开头、SB--> 结尾，一行一项，没有的就不写那一行。这段不会显示给 {{user}}，也不要在正文里提到它。
可以写的项：
时间: 剧情里的日期和时刻（接着上一轮往下走）
天气: 晴 / 阴 / 小雨 / 大雪……
在哪: 此刻在哪
穿着: 此刻穿着
想要: 此刻最想要的
心声: 心里想的一句话
心声背面: 更露骨、不会说出口的那一面
签名: 他的个性签名（想换才写）
音乐: 歌名｜歌手｜正在唱的一句歌词（他在听歌时才写）
备忘: 他记下的一件要做的事（偶尔）
完成: 做完的那件事
动态: 正文｜照片描述,照片描述｜地点（他想发朋友圈时才写，大多数时候不写，一轮最多 2 条）
朋友圈: 名字｜正文｜照片描述（他认识的其他人发的朋友圈，偶尔写）
评论: 名字｜内容（别人在他最新一条动态下面的留言，偶尔）
回复: 内容（{{user}} 在他动态下留言了，他回一句）
日记: 标题｜正文（剧情里有值得记的事才写，不是每轮都写）
X: 正文（他在 X 上公开发的帖子，偶尔）
微信: 内容（他想在手机上主动给 {{user}} 发消息时才写）
{{背景}}`;

export const PHONE_RULES = `你在用手机和对方聊天。像真人发消息一样：短句，一行一条，可以连发几条（2～5 条）。
不要写动作描写、不要写旁白、不要加引号和名字前缀。
需要时可以用这些格式单独占一行：
[语音]说的话
[图片]照片里拍的是什么
[表情]表情的意思
[转账]金额｜留言`;

// 每轮注入正文的那一段：规则 + 现在的状态（他不用每次从头想）+ 她在小手机里新说的话
export function buildInjection({ prompt, coverTags, state, wechatTail, myComments, saveMode }) {
    let text = (prompt || DEFAULT_PROMPT).replace('{{背景}}', coverTags?.length ? `背景: 从这几个里挑一个最合适此刻的：${coverTags.join('、')}` : '');
    if (saveMode) text += '\n（省一点：这一轮只写 时间、天气、在哪、心声 这几项）';
    const n = state?.now || {};
    const cur = [n.time && '时间 ' + n.time, n.weather && '天气 ' + n.weather, n.where && '在 ' + n.where, n.wear && '穿着 ' + n.wear].filter(Boolean).join('，');
    if (cur) text += `\n上一轮的状态：${cur}`;
    if (wechatTail) text += `\n\n他们最近在手机上的聊天（${'{{char}}'} 记得这些）：\n${wechatTail}`;
    if (myComments) text += `\n\n{{user}} 在他动态下的留言（还没回）：\n${myComments}`;
    return text;
}
