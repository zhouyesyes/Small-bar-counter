from PIL import Image, ImageDraw, ImageFont
HEAD = [  # 前面那只的猫头（不带爪子）
    "..#.......#..",
    "..##.....##..",
    "..###...###..",
    "..#########..",
    ".###########.",
    ".##O####O###.",
    ".##O####O###.",
    ".#####o#####.",
    "..#########..",
    "...#######...",
]
def rot_cw(g):  # 顺时针转 90 度：头顶（耳朵）朝右
    H=len(g); W=len(g[0])
    return [''.join(g[H-1-r][c] for r in range(H)) for c in range(W)]
def build(kind):
    g=[list(r) for r in HEAD]
    if kind=='blink':
        for x in range(len(g[5])):
            if g[5][x]=='O': g[5][x]='#'
    head=rot_cw([''.join(r) for r in g])        # 13 行 x 10 列，耳朵在右
    rows=[("." + r + "......") for r in head]    # 左边留一格给墙，右边留地方给小心
    # 一只小爪子扒在左边缘（脸下面）
    # 不要爪子（她 11/9 说的）
    if False: rows += ["#####" + "." * (len(rows[0]) - 5), "####" + "." * (len(rows[0]) - 4)]
    if kind=='msg':
        hrt=[".h.h.", "hhhhh", ".hhh.", "..h.."]
        for i,hl in enumerate(hrt):
            r=list(rows[i]); 
            for j,ch in enumerate(hl): r[12+j]=ch if ch=='h' else r[12+j]
            rows[i]=''.join(r)
    return rows
def render(rows, fg, bg, s):
    w=max(len(r) for r in rows); h=len(rows)
    im=Image.new('RGBA',(w*s,h*s),(0,0,0,0)); d=ImageDraw.Draw(im)
    for y,r in enumerate(rows):
        for x,c in enumerate(r):
            col={'#':fg,'O':bg,'o':bg,'h':fg}.get(c)
            if col: d.rectangle([x*s,y*s,(x+1)*s-1,(y+1)*s-1],fill=col)
    return im
font=ImageFont.truetype('/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',20)
for theme,fg,bg,paper in (('light',(17,17,17,255),(255,255,255,255),(255,255,255)),('dark',(242,242,242,255),(11,11,11,255),(11,11,11))):
    S=11; sheet=Image.new('RGB',(3*230+20,16*S+50),paper); d=ImageDraw.Draw(sheet)
    for i,(k,t) in enumerate((('idle','平时'),('blink','眨眼'),('msg','有新消息'))):
        x=20+i*230; im=render(build(k),fg,bg,S)
        sheet.paste(im,(x-S,8),im)  # 最左一列藏到墙后
        d.rectangle([0,0,x-1,16*S+12],fill=paper) if i==0 else None
        d.line([(x,0),(x,16*S+12)],fill=(150,150,150),width=2)
        d.text((x+40,16*S+20),t,fill=fg[:3],font=font)
    sheet.save(f'turn-{theme}.png')
    render(build('idle'),fg,bg,3).save(f'turn-{theme}-idle.png'); render(build('msg'),fg,bg,3).save(f'turn-{theme}-msg.png')
