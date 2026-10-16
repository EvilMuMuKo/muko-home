"""Independent model drawings and evidence report; needs Pillow + ReportLab."""
import json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '../../outputs/MuKo Home 空间与视觉升级').resolve()
MODEL=json.loads((ROOT/'浏览器截图/home-model.json').read_text()); OUT=ROOT/'设计与验证';OUT.mkdir(exist_ok=True)
FONT='/System/Library/Fonts/STHeiti Medium.ttc'
def font(s): return ImageFont.truetype(FONT,s)
im=Image.new('RGB',(2400,1850),'#f5f2eb');d=ImageDraw.Draw(im);S=145;OX=200;OY=185
p=lambda x,z:(OX+x*S,OY+z*S)
def poly(points,fill,line='#827b6c',width=2):
 pts=[p(x,z) for x,z in points];d.polygon(pts,fill=fill);d.line(pts+[pts[0]],fill=line,width=width)
def rect(o,color,outline='#918473',dash=False):
 w=o.get('w',0);dep=o.get('d',0);a=-math.radians(o.get('rotation',0));pts=[]
 for x,z in [(-w/2,-dep/2),(w/2,-dep/2),(w/2,dep/2),(-w/2,dep/2)]:pts.append((o['x']+x*math.cos(a)+z*math.sin(a),o['z']-x*math.sin(a)+z*math.cos(a)))
 poly(pts,color,outline)
for r in MODEL['rooms']:
 if r['id']!='hall':poly(r['polygon'],'#ebe7dd' if r['id'] not in ['bath','kitchen','balcony'] else '#e1e7e1','#d8d3c7')
for bay in MODEL['homeDesign']['bayWindows']:
 x,z=bay['center'];sx=bay['outward'][0];W=bay['widthM'];P=bay['projectionM'];poly([(x,z-W/2),(x+sx*P,z-W/2),(x+sx*P,z+W/2),(x,z+W/2)],'#dce8e7','#8da5a3')
for w in MODEL['walls']:d.line([p(*w['a']),p(*w['b'])],fill='#697269',width=max(2,int(w['thickness']*S)))
for o in MODEL['openings']:
 if not o.get('wallId'):continue
 w=next((w for w in MODEL['walls'] if w['id']==o['wallId']),None)
 if not w:continue
 a,b=w['a'],w['b'];ln=math.dist(a,b);ux=(b[0]-a[0])/ln;uz=(b[1]-a[1])/ln;x,z=o['center'];hw=o['width']/2
 ends=[p(x-ux*hw,z-uz*hw),p(x+ux*hw,z+uz*hw)]
 d.line(ends,fill='#f5f2eb',width=int(w['thickness']*S+3))
 if o['type']=='window':d.line(ends,fill='#80a5a8',width=5)
 else:
  d.line(ends,fill='#b89973',width=3)
  if o.get('hinge'):
   hx,hz=o['hinge'];a=-math.radians(o.get('rotation',0)+o.get('openAngle',0));d.line([p(hx,hz),p(hx+o['width']*math.cos(a),hz-o['width']*math.sin(a))],fill='#a28e6e',width=2)
exclude={'door_leaf','door_panel','cabinet_frame_part','rug','study_bottle','study_cup','study_stemware','pegboard','tray','speaker','ceiling_equipment'}
for o in MODEL['objects']:
 if o['type'] in exclude or o.get('rendererHidden') or o.get('y',0)>=1.2 or min(o.get('w',0),o.get('d',0))<.2:continue
 t=o['type'];col='#c7ad88'
 if t in ['fridge','washer','dryer','toilet','shower']:col='#d2d9d6'
 if t in ['modular_sofa','sofa_bed','office_chair','lounge_chair','bed','mattress']:col='#bcc4af'
 if t=='column':col='#414e47'
 if t=='modular_sofa':
  dims=MODEL['homeDesign']['modularSofa']['moduleDimensions']
  for pose in MODEL['homeDesign']['modularSofa']['combined']:rect({**pose,'w':dims['w'],'d':dims['d']},col)
  continue
 if t=='folding_table':o={**o,'d':.18}
 if t=='folding_chair':o={**o,'d':.15}
 rect(o,col)
 if t=='column':d.text(p(o['x']-.1,o['z']-.1),'柱',font=font(24),fill='white')
# Normal dining deployed pose shown separately as a fine outline, not a permanent coffee table.
t=MODEL['homeDesign']['dining']['table']['use'];pts=[p(t['x']-.55,t['z']-.35),p(t['x']+.55,t['z']+.35)];d.rectangle(pts,outline='#bd8b57',width=3);d.text(p(8.8,7.91),'用餐展开位',font=font(22),fill='#9c7248')
for label,x,z,sub in [('影音客房',2.05,2.4,'沙发床 / 观影 / 客住'),('卫浴',5.65,1.3,'切角淋浴'),('主卧',9.4,2.65,'睡眠 / 一字双工位'),('封闭厨房',1.85,4.65,'水槽、灶具保留原关系'),('阅读与水吧',2.8,6.8,'窗下唱片 / 咖啡精酿'),('客厅',9.2,7.25,'无固定茶几 / 可变家具'),('家务阳台',12.12,7.55,'洗烘 / 折叠叠衣板')]:
 px,py=p(x,z);d.text((px,py),label,font=font(30),fill='#3d4a41',anchor='mm');d.text((px,py+35),sub,font=font(19),fill='#7e8175',anchor='mm')
d.text((110,60),'MuKo Home  |  V10 概念平面',font=font(46),fill='#35483d')
d.text((110,121),'统一虚拟模型投影 · 家具按外尺寸 · 未实测，不能用于施工放线',font=font(24),fill='#7a7a70')
d.text(p(5.35,8.78),'入户（外开）',font=font(24),fill='#495a4b')
for n in range(6):d.rectangle([p(n,9.85),p(n+1,9.88)],fill='#59685d' if n%2==0 else '#b3b7aa')
d.text(p(0,9.99),'0                         2                         4 m   （仅虚拟比例）',font=font(21),fill='#687265')
im.save(OUT/'V10概念平面.png')
# Independent key sections: architectural bay base and transparent bar upper volume.
sec=Image.new('RGB',(2400,1100),'#f5f2eb');sd=ImageDraw.Draw(sec)
sd.text((100,50),'MuKo Home  |  关键立面与剖面',font=font(44),fill='#35483d')
sd.text((100,110),'虚拟层高 2700mm；构造、锚固与机电均待实测深化',font=font(24),fill='#797b71')
sx,sy,sc=110,850,300
sd.line([(sx,sy),(sx+5.6*sc,sy)],fill='#6c776d',width=4)
for o in MODEL['objects']:
 if o.get('room')!='bar' or o.get('rendererHidden') or o.get('z',0)<7.6 or o['type'] in ['door_leaf','study_bottle','study_cup','study_stemware']:continue
 w=o.get('w',0);h=o.get('h',0);y=o.get('y',0);x=o.get('x',0)
 if w<=0 or h<=0:continue
 sd.rectangle((sx+(x-w/2)*sc,sy-(y+h)*sc,sx+(x+w/2)*sc,sy-y*sc),outline='#927452',width=3)
sd.text((sx,900),'A · 水吧立面投影：下柜与设备格、操作留空、上方吊架分开建模',font=font(25),fill='#48594b')
# bay schematic at right
bx=1930; by=850;bs=200
sd.rectangle((bx,by-.9*bs,bx+.6*bs,by),fill='#c0c5b8',outline='#687267',width=3)
sd.line([(bx,by-2.35*bs),(bx+.6*bs,by-2.35*bs),(bx+.6*bs,by-.9*bs),(bx,by-.9*bs)],fill='#719da0',width=5)
sd.line([(bx,by),(bx-1.0*bs,by)],fill='#687267',width=4)
sd.text((1810,910),'B · 飘窗剖面：外凸600 / 台高900mm',font=font(22),fill='#48594b')
sd.text((1810,950),'建筑台体保留；不是地面面积或低坐榻',font=font(20),fill='#7b7c70')
sec.save(OUT/'V10关键立面剖面.png')
pdfmetrics.registerFont(TTFont('MuKoCJK',FONT))
c=canvas.Canvas(str(OUT/'MuKo Home V10设计与验证报告.pdf'),pagesize=(842,595))
def page_title(title,n):
 c.setFillColorRGB(.96,.95,.92);c.rect(0,0,842,595,fill=1,stroke=0);c.setFillColorRGB(.2,.29,.23);c.setFont('MuKoCJK',23);c.drawString(42,548,title);c.setFont('Helvetica',9);c.drawRightString(800,25,f'MuKo Home / V10 / {n:02d}');c.setFont('MuKoCJK',10)
def line(text,y,color=(.25,.3,.26)):
 c.setFillColorRGB(*color);c.setFont('MuKoCJK',11);c.drawString(44,y,text)
def pic(path,x,y,w,h):c.drawImage(ImageReader(str(path)),x,y,width=w,height=h,preserveAspectRatio=True,anchor='c',mask='auto')
page_title('空间重组与视觉升级',1);pic(OUT/'V10概念平面.png',30,60,780,460);line('概念设计 / 坐标未经实测。承重柱、主卧承重墙及房屋主体边界保留。',47);c.showPage()
page_title('日常生活与可转换空间',2)
for text,y in [('厨房：冰箱移至外侧端部柜位；水槽、灶具关系保留。隔墙调整仍须现场核查。',506),('客厅：双模块沙发、移动电视、1100×700mm正常餐桌；没有固定茶几。',481),('阅读：唱片柜靠窗下，最高设备约765mm，低于虚拟900mm窗台；窗扇和防尘盖待核。',456),('主卧：原床朝向、1800×2000mm床垫、一字双工位及温暖偏暗墙面。',431),('次卧：保留1400mm沙发床，新增饮料冰箱；床品与两人过夜舒适度待试用。',406)]:line(text,y)
pic(ROOT/'浏览器截图/desktop-reading-day.png',42,110,368,260);pic(ROOT/'浏览器截图/desktop-living-dining.png',430,110,368,260);line('浏览器实际截图，来自同一模型；图中室外住宅绿景为共享概念环境。',82);c.showPage()
page_title('构造与立体收纳',3);pic(OUT/'V10关键立面剖面.png',30,155,780,360)
line('一件紧凑三层陈列单元；其余上层以开放吊架、挂杯、留空及任务照明形成层次。',125)
line('岛台外宽500mm；抽拉台面采用已接受的405mm工作面，收起时隐藏于柜内。',100)
line('淋浴切角底盘约0.820m²；门板运动检查通过，实体五金及湿区施工条件仍待确认。',75);c.showPage()
page_title('渲染验证与结论边界',4)
lines=[('PASS  固定画质档转向与静止不再切换DPR；桌面主画面4x MSAA + 空间SMAA。',508),('PASS  镜面独立4x采样；木、墙、织物、金属采用各自标定的PBR通道。',480),('PASS  7个房间的日夜间接光离线生成；手机端不执行烘焙。',452),('PASS  活动家具及淋浴门进行101步网格检查；完整浏览器回归结果见配套记录。',424),('PASS/BLOCKED按证据分别记录；全屋漫步与性能数据见同目录JSON，不以截图数量验收。',396),('BLOCKED  现场结构、净尺寸、机电端点、窗型、五金及最终家具家电型号。',352),('NOT RUN  真实手机硬件帧率、照度与眩光检测、真实居住联合使用、施工验收。',324),('局限：低阶探针是近似间接光，跨墙采样仍可能漏光；WebGL回退限制更明显。',282),('当前没有光线追踪；外景仍为简化概念模型。本轮不宣称达到3A成品游戏美术标准。',254),('现场补测：详见life-v10-measurements.csv（测量端点、毫米、模型参数、受影响功能）。',206),('发布与回退：使用同一GitHub Pages网址；源码、生成产物及精确提交CI一并记录。',178)]
for text,y in lines:line(text,y)
line('启动：本机冷缓存同模型对照约7.1s→4.1s；完整贴图延后补齐，非手机或公网保证。',145)
line('桌面首次遍历约34fps / P95 50ms，未达到60fps目标；横屏尺寸仿真不能代替真机。',117)
c.showPage();c.save();print(str(OUT))
