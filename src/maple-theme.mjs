import { mix } from './palette.mjs';
export const MAPLE_ICONS =[
['预设','<path d="M5 4h14v16H5zM8 4v16M10 8h6M10 12h6M10 16h4"/><path d="M3 7h3M3 12h3M3 17h3"/>'],
['API','<path d="M12 3l6 4v10l-6 4-6-4V7zM6 7l6 4 6-4M12 11v10M9 5l6 14"/>'],
['格式','<path d="M5 5h14M8 9h8M6 13h12M8 17h8M12 3v18"/>'],
['世界书','<path d="M4 4q5-1 8 2 3-3 8-2v15q-5-1-8 2-3-3-8-2zM12 6v15M7 8h2M15 8h2M7 12h2M15 12h2"/>'],
['界面','<path d="M6 3h12M8 3v4l-3 8h14l-3-8V3M5 15v5h14v-5M10 20v2M14 20v2"/><path d="M11 9h2v4h-2z"/>'],
['背景','<path d="M4 21V9a8 8 0 0116 0v12zM12 2v19M4 12h16M7 8l3 2M14 16l3 2"/>'],
['扩展','<path d="M4 7h16v13H4zM3 7l2-4h14l2 4M4 11h16M10 10v4h4v-4M7 18h2M15 18h2"/>'],
['人设','<path d="M8 3h8v3h3v15H5V6h3zM8 6h8"/><circle cx="12" cy="11" r="2"/><path d="M8 18q0-4 4-4t4 4"/>'],
['角色','<path d="M12 21V4M12 9Q4 11 3 4q8-2 9 5zM12 15q1-8 9-7-1 8-9 7zM12 20Q5 22 4 15q7-2 8 5z"/>']];

export const mapleSelected = settings => settings?.barStyle === 'maple';
export const mapleDefaults = { light: { bg: '#f7e9df', accent: '#a84832' }, dark: { bg: '#1b2220', accent: '#c6a58a' } };
const art = name => new URL('../assets/maple/' + name, import.meta.url).href;
const image = name => `url(${JSON.stringify(art(name))})`;
const TITLES = {
    'Recipe Book': ['枝序', '预设 · 故事由此生长'], 'The Cellar': ['汲泉', 'API · 为枝叶引来活水'],
    'The Script': ['文理', '格式 · 让话语各得其位'], 'The Menu': ['万象志', '世界书 · 为故事留一份来历'],
    'The Lighting': ['时色', '界面 · 调成你喜欢的样子'], 'The Window': ['林间', '背景 · 换一处停留'],
    'The Toolbox': ['随行匣', '扩展 · 顺手之物'], 'Member Cards': ['拾叶人', '人设 · 此刻你是谁'],
    'The Bartenders': ['众生枝', '角色 · 与谁共行'],
};
export function mapleHeading(script, en, zh, enabled) {
    const pair = enabled && TITLES[script];
    return pair ? [pair[0], '', pair[1]] : [script, en, zh];
}
const CAPTIONS = { '换一份': '切换', '新建一份': '新建', '换一款':'切换', '试一杯':'测试连接', '改卡背':'编辑描述', '换照片':'更换头像', '绑酒单':'绑定世界书', '调酒台': '生成参数', '原料': '提示词条目', '常备': '全局世界书', '进货单': '连接配置', '进货细节': '连接详情', '灯光搭配': '界面配色', '店内杂项': '其他设置', '其他会员卡': '其他人设', '其他调酒师': '其他角色', "Tonight's Recipe": '当前预设', 'Now Pouring': '当前连接', "Tonight's Menu": '当前世界书', 'Current Lighting': '当前装帧' };
export function mapleCaption(text) { return CAPTIONS[text.replace(/\s/g, '')] || CAPTIONS[text] || text; }
export function mapleCss(p) {
    const S = 'html.sb-bar.sb-maple';
    return `
@font-face{font-family:SBWenKai;src:${image('wenkai.woff')} format('woff');font-display:swap}
${S}{--sb-type-body:SBWenKai,'Songti SC',serif;--sb-type-ui:SBWenKai,'Songti SC',serif;--sb-type-action:SBWenKai,'Songti SC',serif;--sb-type-script:SBWenKai,'Songti SC',serif;--sb-type-italic:SBWenKai,'Songti SC',serif;--sb-f-serif:SBWenKai,serif;--sb-f-script:SBWenKai,serif;--sb-maple-pane:${mix(p.bg,p.fg,.035)};--sb-maple-bar-ink:${p.ink};--sb-maple-bar-field:${mix(p.accent,p.ink,.12)}}
${S} :is(.sb-page,.sb-lounge-root){font-family:var(--sb-type-body)!important}
${S} :is(.sb-head,.sb-reading-head){position:relative!important;background:none!important;padding:145px 8px 20px!important;min-height:226px}
${S} :is(.sb-page.drawer-content,.drawer-content:has(.sb-page),#chat.sb-reading){background-color:var(--sb-bar-bg)!important;background-image:linear-gradient(to bottom,${p.bg}00,${p.bg} 360px),${image('home.webp')}!important;background-size:100% 100%,100% auto!important;background-repeat:no-repeat!important;background-position:center top!important;background-attachment:local!important}
${S} :is(.sb-script,.sb-chat-script){font-family:var(--sb-type-body)!important;font-size:34px!important;line-height:1.15!important;letter-spacing:2px!important;font-weight:400!important;color:var(--sb-bar-text)!important}
${S} :is(.sb-en,.sb-lounge-en){display:none!important}
${S} :is(.sb-zh,.sb-lounge-zh){font:13px/1.6 var(--sb-type-body)!important;letter-spacing:1px!important;color:var(--sb-bar-sub)}
${S} #chat.sb-lounge{background-color:var(--sb-bar-bg)!important;background-image:linear-gradient(${p.bg}26,${p.bg}40),${image('home.webp')}!important;background-size:100% 100%,100% 100vh!important;background-repeat:no-repeat!important;background-position:center top!important;background-attachment:local!important}
${S} #chat.sb-lounge .welcomePanel{padding:0 20px 35px!important}
${S} .sb-lounge-head{padding:145px 8px 20px!important;min-height:226px;background:none}
${S} .sb-lounge-glass{display:none!important}
${S} .sb-lounge-root .sb-lounge-settings{top:auto;bottom:0;right:0}
${S} #chat .sb-lounge-search{border:0;border-bottom:1px solid var(--sb-bar-line);border-radius:0;height:43px;padding:0 3px;margin:14px 0 18px;background:transparent;font-size:14px}
${S} :is(.sb-lounge-groups,.sb-page .sb-card,.sb-page .sb-member-card){background:color-mix(in srgb,var(--sb-bar-bg) 65%,transparent);backdrop-filter:blur(9px) saturate(.8);-webkit-backdrop-filter:blur(9px) saturate(.8);border-color:var(--sb-bar-line);border-radius:9px;box-shadow:inset 0 1px 0 #fff5}
${S} .sb-lounge-root{font-size:14px}${S} .sb-lounge-role-name{font-size:17px}${S} .sb-lounge-role-preview{font-size:13px}${S} .sb-lounge-role-count{font-size:12px}${S} .sb-lounge-role-date{font:11px var(--sb-type-body)}
${S} .sb-lounge-label{font:22px var(--sb-type-body)!important;letter-spacing:1px;color:var(--sb-bar-text);margin:22px 0 12px}
${S} .sb-lounge-label i{font-size:12px}${S} .sb-lounge-root .sb-lounge-quick button{background:color-mix(in srgb,var(--sb-bar-bg) 65%,transparent);color:var(--sb-bar-text);border-color:var(--sb-bar-line);font-size:13px;min-height:40px}
${S} .sb-lounge-root .sb-lounge-temporary{font-size:12px}${S} .sb-lounge-foot{font:12px var(--sb-type-body);letter-spacing:2px}
${S} .sb-page:not(.drawer-content){background:transparent!important}${S} .sb-page :is(.sb-title,.sb-fold,.sb-format-group,.sb-lighting-group){border-color:var(--sb-bar-line)}
${S} :is(.sb-label,.sb-foot){display:none}${S} :is(.sb-title i,.sb-fold-h i,.sb-sec>i,.sb-lighting-label i){display:none}
${S} .sb-page :is(.sb-solid,.sb-b){font-family:var(--sb-type-ui)!important}${S} .sb-page :is(input,textarea,select){font-family:var(--sb-type-ui)!important}
${S} #chat .sb-reading-head{background:none!important;position:static!important;padding-top:145px!important;min-height:226px}
${S} :is(#top-settings-holder,#send_form){position:relative;isolation:isolate;background-color:var(--sb-bar-accent)!important;background-image:linear-gradient(#ffffff08,#00000008)!important;color:var(--sb-maple-bar-ink)!important;border-color:color-mix(in srgb,var(--sb-maple-bar-ink) 20%,transparent)!important}
${S} :is(#top-settings-holder,#send_form)::after{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;border-radius:inherit;background:var(--sb-maple-bar-ink);opacity:.24;-webkit-mask:${image('pattern.webp')} center bottom/100% auto no-repeat;mask:${image('pattern.webp')} center bottom/100% auto no-repeat}
${S} #top-settings-holder .drawer-icon{background:none!important;border:0!important}
${S} #top-settings-holder .drawer-icon,${S} #top-settings-holder .drawer-icon.openIcon{color:var(--sb-maple-bar-ink)!important}${S} #top-settings-holder .drawer-icon.openIcon::after{background:currentColor}
${S} #send_form{border-radius:12px!important;margin:7px auto!important;max-width:calc(100% - 16px);padding:7px 9px!important;box-sizing:border-box;box-shadow:0 6px 22px #54332126,inset 0 1px 0 #fff4}
${S} #send_form textarea{background:var(--sb-maple-bar-field)!important;color:var(--sb-maple-bar-ink)!important;border-color:color-mix(in srgb,var(--sb-maple-bar-ink) 25%,transparent)!important;border-radius:5px!important;font-size:14px!important}
${S} #send_form textarea::placeholder{color:var(--sb-maple-bar-ink)!important;opacity:.78}${S} #send_form :is(.fa-solid,.fa-regular,.fa-fw,.fa){color:var(--sb-maple-bar-ink)!important}
${S} #send_but{color:var(--sb-maple-bar-ink)!important}${S} #options_button::before{ -webkit-mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black'%3E%3Cpath d='M5 4h14v16H5zM8 8h8M8 12h8M8 16h5'/%3E%3C/svg%3E");mask-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black'%3E%3Cpath d='M5 4h14v16H5zM8 8h8M8 12h8M8 16h5'/%3E%3C/svg%3E")}
@supports not (backdrop-filter:blur(1px)){${S} .sb-lounge-groups{background:var(--sb-bar-paper)}}
`;
}
