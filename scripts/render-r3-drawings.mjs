import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
const out=resolve(process.argv[2]||'../../outputs/MuKo Home R3 实施与验证/最终二维图');
await mkdir(out,{recursive:true});
const m=JSON.parse(await readFile('src/generated-layout.json','utf8'));
if(m.version!=='13.0.0') throw new Error(`expected final model 13.0.0, got ${m.version}`);
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:'custom'});
const {r2CabinetPanels}=await server.ssrLoadModule('/src/r2-cabinet-mesh.ts');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(x,y,s,size=14,fill='#38413b')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}">${esc(s)}</text>`;
const rect=(x,y,w,h,fill,stroke='#8f8d7c',sw=1,extra='')=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`;
const footer='MuKo Home R3 / 13.0.0 · 统一虚拟模型 · 单位 m · 未实测，不用于施工 · 请勿发布私人照片';
const svg=(w,h,title,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#f5f2e9"/><g font-family="PingFang SC,Microsoft YaHei,sans-serif">${text(40,44,title,25)}${body}${text(40,h-30,footer,13,'#72766c')}</g></svg>`;
let b='';const sc=84,ox=65,oz=95;
const colors={guest:'#e6dfd2',bath:'#dfe8e2',master:'#e3ded1',kitchen:'#e2e7dc',bar:'#e9dfcb',living:'#ece5d8',balcony:'#dfe5db',hall:'#f0eadc'};
const names={guest:'影音客房',bath:'卫浴',master:'主卧 · 床对面双工位',kitchen:'半开放厨房',bar:'阅读 · 家庭水吧',living:'可变客厅 · 无固定茶几',balcony:'家务阳台',hall:'入户与走廊'};
for(const r of m.rooms){b+=`<polygon points="${r.polygon.map(p=>`${ox+p[0]*sc},${oz+p[1]*sc}`).join(' ')}" fill="${colors[r.id]||'#ece7dd'}"/>`;}
for(const bay of m.homeDesign.bayWindows){const x=bay.center[0]+bay.outward[0]*bay.projectionM/2,z=bay.center[1];b+=rect(ox+(x-bay.projectionM/2)*sc,oz+(z-bay.widthM/2)*sc,bay.projectionM*sc,bay.widthM*sc,'#e2ede7','#91aaa2');b+=text(ox+(x-bay.projectionM/2)*sc+5,oz+z*sc,'外凸',11);}
for(const w of m.walls){const L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]);let spans=[[0,L]];
 for(const o of m.openings.filter(o=>o.wallId===w.id)){const c=((o.center[0]-w.a[0])*(w.b[0]-w.a[0])+(o.center[1]-w.a[1])*(w.b[1]-w.a[1]))/L;const a=c-o.width/2,z=c+o.width/2;spans=spans.flatMap(([u,v])=>z<=u||a>=v?[[u,v]]:[[u,Math.max(u,a)],[Math.min(v,z),v]].filter(([a,b])=>b>a));}
 for(const [a,z] of spans){const p=t=>[ox+(w.a[0]+(w.b[0]-w.a[0])*t/L)*sc,oz+(w.a[1]+(w.b[1]-w.a[1])*t/L)*sc];b+=`<path d="M${p(a)}L${p(z)}" stroke="#777c70" stroke-width="${(w.thickness||.16)*sc}" fill="none"/>`;}}
for(const o of m.openings.filter(o=>o.type==='window')){const w=m.walls.find(w=>w.id===o.wallId),L=Math.hypot(w.b[0]-w.a[0],w.b[1]-w.a[1]),dx=(w.b[0]-w.a[0])/L*o.width/2,dz=(w.b[1]-w.a[1])/L*o.width/2;b+=`<path d="M${ox+(o.center[0]-dx)*sc},${oz+(o.center[1]-dz)*sc}L${ox+(o.center[0]+dx)*sc},${oz+(o.center[1]+dz)*sc}" stroke="#8cb3b3" stroke-width="5"/>`;}
const types=new Set(['wall_storage','base_cabinet','cabinet_frame','bed','mattress','sofabed','sofa_bed','modular_sofa','mobile_tv','desk','wardrobe','fridge','washer','dryer','toilet','vanity','shower','reading_chair','lounge_chair','record_console','counter_stool','pegboard']);
for(const o of m.objects){if(!types.has(o.type)||o.rendererHidden)continue;const suspended=(o.y||0)>0.2&&o.type==='wall_storage';const islandTop=o.id==='s02-entry-return';const fill=suspended||islandTop?'none':o.id==='r3-entry-island-base'?'#8d6b45':o.r2Cabinet?'#c7b18b':o.type==='fridge'?'#9aa799':/sofa|chair/.test(o.type)?'#c3c8b8':'#d8cdb7';const dash=suspended||islandTop?' stroke-dasharray="6 4"':'';b+=`<g transform="translate(${ox+o.x*sc} ${oz+o.z*sc}) rotate(${o.rotation||0})">${rect(-o.w*sc/2,-o.d*sc/2,o.w*sc,o.d*sc,fill,suspended?'#6d5a3e':'#8f8d7c',suspended?1.4:1,dash)}</g>`;if(suspended)b+=text(ox+(o.x-o.w/2)*sc,oz+(o.z+o.d/2)*sc+16,`悬空 底标高 ${(o.y).toFixed(2)} m`,12,'#6d5a3e');}
const col=m.objects.find(o=>o.id==='column-handdrawn');b+=rect(ox+(col.x-col.w/2)*sc,oz+(col.z-col.d/2)*sc,col.w*sc,col.d*sc,'#38443c');b+=text(ox+col.x*sc-7,oz+col.z*sc+4,'柱',13,'#fff');
for(const [id,x,z] of [['guest',.5,2.5],['bath',5.35,1.65],['master',7.9,2.85],['kitchen',1.1,4.75],['bar',.55,6.1],['living',8.3,7.55],['hall',5.55,5.6],['balcony',11.75,6.8]])b+=text(ox+x*sc,oz+z*sc,names[id],14);
// SVG y grows with model +z. rotation is the closed-leaf heading in that frame (0 = +x, +angle toward +z).
for(const o of m.openings.filter(o=>o.type==='door')){const hinge=o.hinge||o.center,hx=ox+hinge[0]*sc,hz=oz+hinge[1]*sc,w=o.width*sc;const rot=(o.rotation||0)*Math.PI/180;const open=rot+(o.openAngle||0)*Math.PI/180;const cx=Math.cos(rot)*w,cy=Math.sin(rot)*w,ex=Math.cos(open)*w,ey=Math.sin(open)*w;const sweep=(o.openAngle||0)>=0?1:0;b+=`<path d="M${hx} ${hz}L${hx+cx} ${hz+cy}A${w} ${w} 0 0 ${sweep} ${hx+ex} ${hz+ey}Z" fill="#ffffff50" stroke="#9a9c87" stroke-width="1"/>`;}
b+=`<path d="M${ox+3.92*sc} ${oz+4.31*sc}V${oz+5.85*sc}H${ox+m.openings.find(o=>o.id==='kitchen-pass-window').width*sc}H${ox}" stroke="#719b99" stroke-width="3" fill="none"/>`;
b+=text(65,900,'岛台：500 mm 台面为虚线外轮廓，东侧 200 mm 为封闭浅柜；西侧 300 mm 为膝部悬挑，凳在台面外侧。',15);
b+=text(65,928,'电视侧柜为悬空虚线脚印加底标高，不是落地通柜。备用桌椅可移出。厨房玻璃可关闭。',15);
b+=text(65,956,'门扇按 opening.rotation 与 openAngle 的闭合向量、开启向量与弧向绘制。此图按最终模型外廓生成。',15);
await writeFile(resolve(out,'01_R3最终模型平面.svg'),svg(1240,1040,'MuKo Home R3 / 最终模型平面',b));
let e='';const ids=['r2-fridge-cabinet','r2-waterbar','r2-entry','r2-living-shallow','r2-living-deep','r2-guest-wardrobe','r2-master-wardrobe','r2-housekeeping','r3-entry-island-base'];
const floorH=2.7,es=62;
ids.forEach((id,index)=>{const o=m.objects.find(o=>o.id===id),x=40+(index%3)*460,y=100+Math.floor(index/3)*250;const top=y;const base=top+floorH*es;e+=text(x,top-8,o.label,15);e+=`<path d="M${x-8} ${base}H${x+Math.max(o.w*es,120)+8}" stroke="#687166" stroke-width="3"/>`;const cabTop=base-(o.y+o.h)*es;e+=rect(x,cabTop,o.w*es,o.h*es,'#a88866');for(const bay of o.r2Cabinet.bays){e+=rect(x+(bay.x+o.w/2-bay.w/2)*es+1,cabTop+(o.h-bay.y-bay.h)*es+1,bay.w*es-2,bay.h*es-2,bay.door==='open'?'#f0e7d6':'#cfd1bd');for(const shelf of bay.shelves??[])e+=rect(x+(bay.x+o.w/2-bay.w/2)*es+2,cabTop+(o.h-bay.y-shelf)*es,bay.w*es-4,2,'#9f8260');}const note=`${Math.round(o.w*1000)} × ${Math.round(o.d*1000)} × ${Math.round(o.h*1000)} mm · 底 ${(o.y||0).toFixed(2)} m`;e+=text(x,base+20,note,12);});
e+=text(40,860,'各柜底标高取对象 y。悬空柜与岛台封闭浅柜单独标出。层高 2.7 m 仅作参照，不是每柜都到顶。',15);
await writeFile(resolve(out,'02_R3柜体立面.svg'),svg(1400,980,'MuKo Home R3 / 柜体立面',e));
let c='',sx=165,sy=680,ss=190,zmin=3.4;const X=z=>sx+(z-zmin)*ss,Y=y=>sy-y*ss;
c+=`<path d="M${X(3.4)} ${Y(0)}H${X(8.45)}M${X(3.4)} ${Y(2.7)}H${X(8.45)}" stroke="#687166" stroke-width="7"/>`;
for(const o of m.objects.filter(o=>o.r2Cabinet))for(const p of r2CabinetPanels(o)){const a=o.rotation*Math.PI/180,cosa=Math.cos(a),sina=Math.sin(a),wx=o.x+cosa*p.x-sina*p.z,wz=o.z+sina*p.x+cosa*p.z,ww=Math.abs(cosa)*p.w+Math.abs(sina)*p.d,dd=Math.abs(sina)*p.w+Math.abs(cosa)*p.d;if(1.25<wx-ww/2||1.25>wx+ww/2)continue;const py=(o.y||0)+p.y;c+=rect(X(wz-dd/2),Y(py+p.h/2),dd*ss,p.h*ss,'#ac8b65');}
c+=rect(X(5.85)-2,Y(2.7),4,1.75*ss,'#b7d0cc','#6d9290');
for(const [z0,z1,label] of [[4.09,5.20,'后排—半岛 1.11m'],[5.85,7.61,'半岛—水吧 1.76m（名义）']]){const y=Y(.37);c+=`<path d="M${X(z0)} ${y}H${X(z1)}" stroke="#718775"/>`;c+=text((X(z0)+X(z1))/2-83,y-12,label,14);}
c+=text(75,90,'沿 x=1.25m 观察：厨房操作区 → 出品半岛 / 可关闭玻璃 → 咖啡壁龛',16);
c+=text(75,740,'净距为概念名义预算，滑轨、把手与设备开门另占空间；上柜空腔不等同于已核定可用容量。',15);
await writeFile(resolve(out,'03_R3餐厨水吧横切.svg'),svg(1240,840,'MuKo Home R3 / 餐厨水吧横切',c));
const island=m.objects.find(o=>o.id==='s02-entry-return');
const base=m.objects.find(o=>o.id==='r3-entry-island-base');
const stool=m.objects.find(o=>o.id==='entry-counter-stool-0');
const spec=m.homeDesign.entryIsland;
let s='';const is=320,ix0=120,iy0=620,xmin=4.05;const IX=x=>ix0+(x-xmin)*is,IY=y=>iy0-y*is;
const topX0=island.x-island.w/2,topX1=island.x+island.w/2,topY0=island.h-(spec.counterThicknessM||0.035),topY1=island.h;
const caseX0=base.x-base.d/2,caseX1=base.x+base.d/2;
s+=`<path d="M${IX(4.1)} ${IY(0)}H${IX(5.35)}" stroke="#687166" stroke-width="6"/>`;
s+=rect(IX(stool.x-stool.w/2),IY(stool.h),stool.w*is,stool.h*is,'#c3c8b8');
s+=rect(IX(caseX0),IY(base.h), (caseX1-caseX0)*is, base.h*is,'#8d6b45');
s+=rect(IX(topX0),IY(topY1),(topX1-topX0)*is,(topY1-topY0)*is,'#d7c4a4','#6d5a3e',2);
s+=text(IX(caseX0)+6,IY(base.h/2),'封闭浅储物',14,'#fff');
s+=text(IX(topX0)+8,IY(0.55),'膝部悬挑 300 mm',14);
s+=text(IX(stool.x-stool.w/2),IY(stool.h)+22,'凳整体在台面外侧',13);
const dim=(x0,x1,y,label)=>{s+=`<path d="M${IX(x0)} ${IY(y)}H${IX(x1)}" stroke="#718775" stroke-width="1.2"/>`;s+=text((IX(x0)+IX(x1))/2-70,IY(y)-8,label,13);};
dim(topX0,topX1,1.12,`台面 ${Math.round(island.w*1000)} mm · 完成高 ${island.h.toFixed(2)} m`);
dim(topX0,caseX0,0.72,'悬挑 300 mm');
dim(caseX0,caseX1,1.02,'柜深 200 mm');
s+=text(70,92,'剖面平行于进深（X）：西为用餐侧，东为靠过道的封闭柜。凳宽取模型 460 mm，整凳在台面西缘之外。',16);
s+=text(70,680,'台面 500 mm、膝净与 188 cm 使用者需实物样柜核对。虚拟预算，未实测，不能当施工图。',15);
await writeFile(resolve(out,'04_R3岛台横剖.svg'),svg(980,760,'MuKo Home R3 / 岛台横剖',s));
let bayNote='bay section skipped';
try{
  const THREE=await server.ssrLoadModule('three');
  const {buildBayLife}=await server.ssrLoadModule('/src/bay-life.ts');
  const reports=buildBayLife(new THREE.Group(),m,{},()=>{});
  const guest=reports.find(r=>r.roomId==='guest');
  const bay=m.homeDesign.bayWindows.find(b=>b.roomId==='guest');
  if(!guest?.components?.length) throw new Error('no bay-life diagnostic');
  const cushion=guest.components.find(p=>p.kind==='raised-ledge-cushion');
  const plane=cushion.center[0];
  let g='';const bs=150,bx0=160,by0=640,z0=bay.center[1]-bay.widthM/2-0.15;const BX=z=>bx0+(z-z0)*bs,BY=y=>by0-y*bs;
  g+=`<path d="M${BX(z0)} ${BY(0)}H${BX(bay.center[1]+bay.widthM/2+0.15)}" stroke="#687166" stroke-width="6"/>`;
  g+=rect(BX(bay.center[1]-bay.widthM/2),BY(bay.sillHeightM),(bay.widthM)*bs,bay.sillHeightM*bs,'#e2ede7','#91aaa2');
  g+=`<path d="M${BX(bay.center[1]-bay.widthM/2)} ${BY(bay.headHeightM)}H${BX(bay.center[1]+bay.widthM/2)}" stroke="#8cb3b3" stroke-width="3"/>`;
  const hit=guest.components.filter(p=>p.min[0]<plane&&p.max[0]>plane);
  if(hit.length<2) throw new Error('section plane missed bay pieces');
  for(const p of hit){const fill=p.kind==='raised-ledge-cushion'?'#d9cfc0':p.kind==='book'?'#8d7355':p.kind.includes('bracket')?'#8a7560':'#c4ad8c';g+=rect(BX(p.min[2]),BY(p.max[1]),(p.max[2]-p.min[2])*bs,(p.max[1]-p.min[1])*bs,fill);}
  g+=text(70,88,`影音客房飘窗，剖切 x=${plane.toFixed(3)} m（薄垫中心）。构件来自 buildBayLife 诊断盒，不是示意块。`,15);
  g+=text(70,118,guest.label,14);
  g+=text(70,700,'窗台结构、外凸与玻璃仍属虚拟预算。儿童与窗安全、结构承载力需现场核对。',15);
  await writeFile(resolve(out,'05_R3飘窗剖面.svg'),svg(1100,780,'MuKo Home R3 / 飘窗剖面',g));
  bayNote=`bay section ${guest.components.length} pieces, cut ${hit.length} at x=${plane.toFixed(3)}`;
}catch(err){bayNote=`bay section skipped: ${err.message}`;}
await server.close();
console.log(out);
console.log(bayNote);
