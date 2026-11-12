// Shared text hierarchy for every bar surface, including independently mounted dialogs.
export const fonts = {
    body: "'Noto Serif SC','Songti SC','STSong','Source Han Serif SC','Noto Serif CJK SC',serif",
    ui: "'Noto Serif SC','Songti SC','STSong','Source Han Serif SC','Noto Serif CJK SC',serif",
    action: "'Noto Sans SC','PingFang SC','Hiragino Sans GB','Microsoft YaHei',sans-serif",
    script: "'Pinyon Script','Snell Roundhand','Apple Chancery','Noto Serif SC','Songti SC',cursive",
    italic: "'Cormorant Garamond','Baskerville','Times New Roman','Noto Serif SC','Songti SC',serif",
    mono: 'ui-monospace,SFMono-Regular,Menlo,monospace',
};
export const typeSizes = { page:46, identity:20, record:17, section:15, subheading:13, body:12, control:12, menu:11, meta:10 };
export const typographyCss = `
:root{${Object.entries(fonts).map(([name,value])=>`--sb-type-${name}:${value};`).join('')}${Object.entries(typeSizes).map(([name,value])=>`--sb-type-size-${name}:calc(${value}px * var(--fontScale,1));`).join('')}}
/* Only our widgets and the explicitly enabled bar theme participate. Icon fonts stay native. */
#sb-root{--sb-font:var(--sb-type-body)!important;--sb-serif:var(--sb-type-body)!important;font-family:var(--sb-type-body)!important;font-size:var(--sb-type-size-body);}
html.sb-bar{--sb-f-serif:var(--sb-type-body);--sb-f-script:var(--sb-type-script);--sb-f-italic:var(--sb-type-italic);}
html.sb-bar .sb-page,#sb-splash,#sb-splash-settings,#sb-color-picker,#sb-crop{font-family:var(--sb-type-body)!important;}
html.sb-bar .sb-page{font-size:var(--sb-type-size-body);line-height:1.65;}
html.sb-bar .sb-page.drawer-content,html.sb-bar #right-nav-panel:has(.sb-page){padding:12px 16px 20px!important;}
html.sb-bar :is(#rm_characters_block,#rm_ch_create_block).sb-page{padding:0!important;}
html.sb-bar #chat.sb-lounge .welcomePanel{padding:12px 16px 25px!important;}
html.sb-bar :is(.sb-head,.sb-lounge-head){box-sizing:border-box;width:100%;margin:0!important;padding:22px 0 14px!important;text-align:center;flex-shrink:0;}
html.sb-bar :is(.sb-script,.sb-chat-script){font-family:var(--sb-type-script)!important;font-size:var(--sb-type-size-page)!important;font-weight:400!important;line-height:1.15!important;letter-spacing:0!important;text-align:center;}
html.sb-bar :is(.sb-en,.sb-lounge-en){font:400 calc(10px * var(--fontScale,1))/1.6 var(--sb-type-italic)!important;letter-spacing:.32em!important;margin-top:8px;}
html.sb-bar :is(.sb-zh,.sb-lounge-zh){font:400 calc(10.5px * var(--fontScale,1))/1.6 var(--sb-type-body)!important;letter-spacing:.45em!important;margin-top:2px;}
/* Ordinary interface text uses Songti; only square-bracket actions use bold sans. */
html.sb-bar :is(.sb-fold-h b,.sb-title b,.sb-sec b,.sb-lighting-label b,.sb-format-group>summary>b),
html.sb-bar #rm_extensions_block :is(.inline-drawer-header,details:has(.inline-drawer)>summary){font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-section)!important;line-height:1.6!important;font-weight:500!important;}
html.sb-bar #rm_extensions_block .inline-drawer-header :is(b,strong){font-family:inherit!important;font-size:inherit!important;font-weight:inherit!important;}
html.sb-bar .sb-page :is(h3,h4){font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-subheading)!important;font-weight:500!important;}
html.sb-bar .sb-page .menu_button{white-space:nowrap;}
html.sb-bar .sb-page .menu_button::before{white-space:nowrap;}
html.sb-bar :is(.sb-fold-h i,.sb-title i,.sb-lighting-label i,.sb-format-group>summary>i,.sb-cardlabel,.sb-label i,.sb-foot i){font-family:var(--sb-type-italic)!important;font-size:calc(13px * var(--fontScale,1))!important;}
html.sb-bar .sb-page :is(button,input,select,textarea):not([class*="fa-"]),
html.sb-bar .sb-page .menu_button:not(i):not([class*="fa-"]),
#sb-root :is(button,input,select,textarea):not([class*="fa-"]),
#sb-splash-settings :is(button,input,select,textarea),#sb-color-picker :is(button,input),#sb-crop :is(button,input){font-family:var(--sb-type-ui)!important;}
html.sb-bar .sb-page :is(input,select,textarea):not([data-preset-manager-for]):not(#themes),
#sb-root :is(input,select,textarea),#sb-splash-settings :is(input,select,textarea){font-size:var(--sb-type-size-control)!important;line-height:1.6;}
html.sb-bar .sb-page :is(.sb-b,.sb-use button,.sb-pick){font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-control)!important;}
html.sb-bar .sb-page select[data-preset-manager-for],html.sb-bar #respective-presets-block select,html.sb-bar #user-settings-block #themes{font-family:var(--sb-type-body)!important;font-size:var(--sb-type-size-record)!important;line-height:1.4!important;font-weight:400!important;}
html.sb-bar .sb-page :is([data-preset-manager-update],[data-preset-manager-rename],[data-preset-manager-new],[data-preset-manager-import],[data-preset-manager-export],[data-preset-manager-restore],#af_master_import,#af_master_export,#extensions_details,#third_party_extension_button,#auto_background,#bg_add_folder_button,#add_background_button_top,#bg_selection_mode_button)::before{font-family:var(--sb-type-action)!important;font-weight:700!important;font-size:var(--sb-type-size-menu)!important;}
html.sb-bar .sb-page :is(pre,code,.monospace,#customCSS,#custom_stopping_strings),#sb-root :is(pre,code){font-family:var(--sb-type-mono)!important;}
html.sb-bar #chat.sb-reading .mes_text,html.sb-bar .sb-lounge-root{font-family:var(--sb-type-body)!important;}
html.sb-bar .sb-lounge-root :is(input,button),html.sb-bar .sb-chat-popup button{font-family:var(--sb-type-ui)!important;}
html.sb-bar :is(.sb-lounge-label,.sb-lounge-quick button){font-family:var(--sb-type-ui)!important;}
html.sb-bar .sb-lounge-label{font-size:var(--sb-type-size-section)!important;font-weight:500!important;}
html.sb-bar .sb-mc-name,html.sb-bar #character_name_pole,#sb-root .sb-name{font-family:var(--sb-type-body)!important;font-size:var(--sb-type-size-identity)!important;font-weight:500!important;}
html.sb-bar .sb-chat-popup button{font-size:var(--sb-type-size-menu)!important;}
html.sb-bar #send_form textarea{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-control)!important;}
html.sb-bar .sb-page :is(input,textarea)::placeholder,#sb-root :is(input,textarea)::placeholder,#sb-splash-settings input::placeholder{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-menu)!important;}
/* Every kind of tab uses the same Songti family/weight, including mini-phone apps. */
#sb-root :is(.sb-tabs,.sb-wxtabs,.sb-xtabs,.sb-wbnav,.sb-wbtabs2) :is(button,a,span),
html.sb-bar #bg_tabs .bg_tab_button a{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-control)!important;font-weight:500!important;}
#sb-root :is(.sb-ph,.sb-dmhead,.sb-wbhead) :is(strong,b),#sb-root :is(.sb-wbtitle,.sb-pht){font-family:var(--sb-type-ui)!important;font-size:calc(14px * var(--fontScale,1))!important;font-weight:500!important;}
#sb-root .sb-cap{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-menu)!important;font-weight:500!important;}
#sb-root button :is(span,strong,b,small){font-family:inherit!important;}
#sb-root .sb-widget :is(b,small){font-family:var(--sb-type-body)!important;}
#sb-root .sb-srow{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-control)!important;}
#sb-root :is(.sb-sh,.sb-app .sb-an){font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-menu)!important;}
html.sb-bar .sb-lounge-quick button span{font-family:inherit!important;}
#sb-root :is(.sb-dmmenu,.sb-pop,.sb-song-pop,.sb-ppanel,.sb-sheet) button,
html.sb-bar #Backgrounds .jg-button::after{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-menu)!important;}
#sb-root .sb-home-tab>div{font-family:var(--sb-type-body)!important;}
#sb-root .sb-home-tab dt{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-menu)!important;}
#sb-root .sb-home-words .sb-sign{font-family:var(--sb-type-italic)!important;}
/* The ticket retains decorative English, but no longer switches all text to monospace. */
#sb-splash .sb-ticket,#sb-splash .sb-ticket-profile p{font-family:var(--sb-type-body)!important;}
#sb-splash :is(dt,.sb-sign-label,.sb-remember,.sb-pour,.sb-pass,.sb-splash-edit,.sb-tab-title){font-family:var(--sb-type-ui)!important;}
#sb-splash :is(dt,.sb-sign-label,.sb-remember,.sb-pass){font-size:var(--sb-type-size-meta)!important;}
#sb-splash .sb-ticket-profile p{font-family:var(--sb-type-italic)!important;}
#sb-splash [data-signature]{font-family:var(--sb-type-script)!important;font-size:calc(22px * var(--fontScale,1))!important;}
/* The ticket is geometrically scaled; compensate text so it remains readable on phones. */
#sb-splash .sb-ticket,#sb-splash dl div,#sb-splash dd{font-size:calc(12px / var(--sb-ticket-scale,1))!important;}
#sb-splash :is(dt,.sb-sign-label,.sb-remember,.sb-barcode,.sb-ticket-cover){font-size:calc(10px / var(--sb-ticket-scale,1))!important;}
#sb-splash .sb-barcode span{font-family:var(--sb-type-mono)!important;font-size:calc(10px / var(--sb-ticket-scale,1))!important;}
#sb-splash :is(.sb-ticket-profile p,.sb-pour,.sb-pass){font-size:calc(11px / var(--sb-ticket-scale,1))!important;}
#sb-splash .sb-tab-title{font-size:calc(13px / var(--sb-ticket-scale,1))!important;}
#sb-splash [data-signature]{font-size:calc(22px / var(--sb-ticket-scale,1))!important;}
#sb-splash .sb-pouring p{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-subheading)!important;}
#sb-splash .sb-pouring small,#sb-crop .cr-tip{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-menu)!important;}
#sb-crop button{font-size:var(--sb-type-size-control)!important;}
#sb-splash-settings :is(header,legend),#sb-color-picker header b{font-family:var(--sb-type-ui)!important;}
#sb-splash-settings :is(label,.sb-color-setting){font-family:var(--sb-type-body)!important;font-size:var(--sb-type-size-body)!important;}
#sb-splash-settings :is([data-clear],[data-preview]),#sb-color-picker footer button{font-family:var(--sb-type-ui)!important;font-size:var(--sb-type-size-menu)!important;}
#sb-color-picker header b{font-size:var(--sb-type-size-section)!important;}
#sb-color-picker header i{font-family:var(--sb-type-italic)!important;}
#sb-color-picker [data-hex],#sb-splash-settings .sb-color-launch code{font-family:var(--sb-type-mono)!important;}
/* The bracket itself and its label share one bold font; symbols and unbracketed actions do not. */
html.sb-bar .sb-page :is(button.sb-b,label.sb-pick){font-family:var(--sb-type-action)!important;font-weight:700!important;}
html.sb-bar #rm_extensions_block :is(#extensions_details,#third_party_extension_button),
html.sb-bar #user-settings-block #account_controls .menu_button{font-family:var(--sb-type-action)!important;font-weight:700!important;}
html.sb-bar #rm_extensions_block :is(#extensions_details,#third_party_extension_button) :is(span),
html.sb-bar #user-settings-block #account_controls .menu_button span{font-family:inherit!important;font-weight:inherit!important;}
html.sb-bar #user-settings-block :is(#ui_preset_import_button,#ui_preset_export_button,#ui-preset-update-button,#ui-preset-save-button)::before{font-family:var(--sb-type-action)!important;font-weight:700!important;}
html.sb-bar #rm_extensions_block :is(#extensions_details,#third_party_extension_button)::after,
html.sb-bar #user-settings-block #account_controls .menu_button::before,
html.sb-bar #user-settings-block #account_controls .menu_button::after{font-family:var(--sb-type-action)!important;font-weight:700!important;}
html.sb-bar #Backgrounds .jg-button:is([data-action=lock],[data-action=unlock],[data-action=copy],[data-action=edit],[data-action=delete],[data-action=folder],[data-action=set-cover],[data-action=rename-folder],[data-action=delete-folder])::after{font-family:var(--sb-type-action)!important;font-weight:700!important;}
html.sb-bar #user_avatar_block .avatar_upload::before{font-family:var(--sb-type-action)!important;font-weight:700!important;}
#sb-color-picker footer button{font-family:var(--sb-type-action)!important;font-weight:700!important;}

`;
export function installTypography() {
    if (typeof document === 'undefined') return;
    const existing = document.getElementById('sb-typography');
    if (existing) return existing;
    const style = document.createElement('style'); style.id = 'sb-typography'; style.textContent = typographyCss;
    (document.head || document.documentElement).appendChild(style);
    return style;
}
