import {counterStyle} from './counter-appearance.mjs';
// Explicit per-chat choices override the former master switch and global economy mode.
// Reading old settings never changes them or turns previously disabled content on.
export function replyContent(config={},settings={}) {
 const legacy=!config.noAutoStatus;
 return {status:typeof config.autoStatus==='boolean'?config.autoStatus:legacy,
  calendar:typeof config.autoCalendar==='boolean'?config.autoCalendar:legacy&&counterStyle(settings)==='default',
  music:config.autoMusicPick!==false,
  phone:typeof config.autoPhone==='boolean'?config.autoPhone:legacy&&!settings.saveMode};
}
export function phoneSideStatus(config,settings){
 const flags=replyContent(config,settings);
 if(!flags.phone)return '';
 return '回完消息以后，可按剧情偶尔补一段 <!--SB … SB--> 小手机动态、日记或备忘，没有变化就不写。'+(flags.status?'此刻有变化也可补充时间、在哪和心声。':'不写时间、在哪、心声等状态栏项目。')+'不自动选曲，不更新日历。';
}
