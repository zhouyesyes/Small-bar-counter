// 小吧台的提示词：默认写在这里，她可以在设置里改（改过的存在设置里，清空就回到默认）

export const DEFAULT_PROMPT = `【小吧台】
每次回复正文写完以后，另起一行，写一段 {{char}} 此刻的状态，用 <!--SB 开头、SB--> 结尾，一行一项，没有的就不写那一行。这段不会显示给 {{user}}，也不要在正文里提到它。
这段也是 {{char}} 本人：内容要贴合 {{char}} 的性格、口吻、关系和当下剧情，不要写成旁白或客观报告。
可以写的项：
时间: 剧情里的日期和时刻（接着上一轮往下走）
天气: 晴 / 阴 / 小雨 / 大雪……
在哪: 此刻在哪
穿着: 此刻穿着
想要: 此刻最想要的
心声: 心里想的一句话
心声背面: 更露骨、不会说出口的那一面
签名: {{char}}的个性签名（想换才写）
音乐: 歌名｜歌手｜正在唱的一句歌词（{{char}}在听歌时才写）
备忘: {{char}}记下的一件要做的事（偶尔）
完成: 做完的那件事
动态: 正文｜照片描述,照片描述｜地点（{{char}}想发朋友圈时才写，大多数时候不写，一轮最多 2 条）
朋友圈: 名字｜正文｜照片描述（{{char}}认识的其他人发的朋友圈，偶尔写）
评论: 名字｜内容（别人在{{char}}最新一条动态下面的留言，偶尔）
回复: 内容（{{user}} 在{{char}}动态下留言了，{{char}}回一句）
日记: 标题｜正文（剧情里有值得记的事才写，不是每轮都写）
X: 正文（{{char}}在 X 上公开发的帖子，偶尔）
微信: 内容（{{char}}想在手机上主动给 {{user}} 发消息时才写）
{{背景}}`;

export const LETTER_RULES = `你们在书信往来。回一封信：几句话就好，一行一句，口吻合乎你们所处的年代。
不要写动作描写、不要写旁白、不要加引号，不用写抬头和落款（会自动加）。
需要时可以单独占一行：
[图片]随信附上的东西或画
[转账]数目｜附言`;

export const PHONE_RULES = `你在用手机和对方聊天。像真人发消息一样：短句，一行一条，可以连发几条（2～5 条）。
不要写动作描写、不要写旁白、不要加引号和名字前缀。
需要时可以用这些格式单独占一行：
[语音]说的话
[图片]照片里拍的是什么
[表情]表情的意思
[转账]金额｜留言`;

// 每轮注入正文的那一段：规则 + 现在的状态（{{char}}不用每次从头想）+ 她在小手机里新说的话
export function buildInjection({ prompt, coverTags, state, wechatTail, myComments, waiting, saveMode, channel = '手机上的聊天' }) {
    let text = (prompt || DEFAULT_PROMPT).replace('{{背景}}', coverTags?.length ? `背景: 从这几个里挑一个最合适此刻的：${coverTags.join('、')}` : '');
    if (saveMode) text += '\n（省一点：这一轮只写 时间、天气、在哪、心声 这几项）';
    const n = state?.now || {};
    const cur = [n.time && '时间 ' + n.time, n.weather && '天气 ' + n.weather, n.where && '在 ' + n.where, n.wear && '穿着 ' + n.wear].filter(Boolean).join('，');
    if (cur) text += `\n上一轮的状态：${cur}`;
    if (wechatTail) text += `\n\n你们最近${channel}（{{char}} 记得这些）：\n${wechatTail}`;
    if (waiting) text += `\n\n{{user}} 刚在手机上发来、还没回的消息：\n${waiting}\n这一轮请在状态段里用「微信:」回她，一行一条（可以好几行）。`;
    if (myComments) text += `\n\n{{user}} 在{{char}}动态下的留言（还没回）：\n${myComments}`;
    return text;
}
