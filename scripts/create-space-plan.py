"""Independent model drawings and evidence report; needs Pillow + ReportLab."""
import json, math, sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '../../outputs/MuKo Home 空间与视觉升级').resolve()
MODEL=json.loads((ROOT/'最终截图/home-model.json').read_text()); OUT=ROOT/'设计与验证';OUT.mkdir(exist_ok=True,parents=True)
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
t=MODEL['homeDesign']['dining']['table']['use'];pts=[p(t['x']-.55,t['z']-.35),p(t['x']+.55,t['z']+.35)];d.rectangle(pts,outline='#bd8b57',width=3);d.text(p(8.8,7.91),'备用餐桌展开位',font=font(22),fill='#9c7248')
for label,x,z,sub in [('影音客房',2.05,2.4,'沙发床 / 观影 / 客住'),('卫浴',5.65,1.3,'侧墙台盆 / 淋浴'),('主卧',9.4,2.65,'睡眠 / 一字双工位'),('封闭厨房',1.85,4.65,'水槽、灶具保留原关系'),('阅读与水吧',2.8,6.8,'窗下唱片 / 咖啡精酿 / 入口餐位'),('客厅',9.2,7.25,'无固定茶几 / 可变家具'),('家务阳台',12.12,7.55,'洗烘 / 折叠叠衣板')]:
 px,py=p(x,z);d.text((px,py),label,font=font(30),fill='#3d4a41',anchor='mm');d.text((px,py+35),sub,font=font(19),fill='#7e8175',anchor='mm')
d.text((110,60),'MuKo Home  |  V11 实景关系修订平面',font=font(46),fill='#35483d')
d.text((110,121),'统一虚拟模型投影 · 家具按外尺寸 · 未实测，不能用于施工放线',font=font(24),fill='#7a7a70')
d.text(p(5.35,8.78),'入户（外开）',font=font(24),fill='#495a4b')
for n in range(6):d.rectangle([p(n,9.85),p(n+1,9.88)],fill='#59685d' if n%2==0 else '#b3b7aa')
d.text(p(0,9.99),'0                         2                         4 m   （仅虚拟比例）',font=font(21),fill='#687265')
im.save(OUT/'V11概念平面.png')
