import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createServer} from 'vite';
const out=resolve(process.argv[2]||'../../outputs/MuKo Home R2 实施与验证/最终二维图');
await mkdir(out,{recursive:true});
const m=JSON.parse(await readFile('src/generated-layout.json','utf8'));
const server=await createServer({configFile:false,root:process.cwd(),server:{middlewareMode:true},appType:'custom'});
const {r2CabinetPanels}=await server.ssrLoadModule('/src/r2-cabinet-mesh.ts');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;');
const text=(x,y,s,size=14,fill='#38413b')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${fill}">${esc(s)}</text>`;
const rect=(x,y,w,h,fill,stroke='#8f8d7c',sw=1)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
const svg=(w,h,title,body)=>`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#f5f2e9"/><g font-family="PingFang SC,Microsoft YaHei,sans-serif">${text(40,44,title,25)}${body}${text(40,h-30,'R2 / 12.0.0 · 统一虚拟模型 · 单位 m · 未实测，不用于施工',13,'#72766c')}</g></svg>`;
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
for(const o of m.objects){if(!types.has(o.type)||o.rendererHidden||o.type==='wall_storage'&&o.y>1.5)continue;const fill=o.r2Cabinet?'#c7b18b':o.type==='fridge'?'#9aa799':/sofa|chair/.test(o.type)?'#c3c8b8':'#d8cdb7';b+=`<g transform="translate(${ox+o.x*sc} ${oz+o.z*sc}) rotate(${o.rotation||0})">${rect(-o.w*sc/2,-o.d*sc/2,o.w*sc,o.d*sc,fill)}</g>`;}
const col=m.objects.find(o=>o.id==='column-handdrawn');b+=rect(ox+(col.x-col.w/2)*sc,oz+(col.z-col.d/2)*sc,col.w*sc,col.d*sc,'#38443c');b+=text(ox+col.x*sc-7,oz+col.z*sc+4,'柱',13,'#fff');
for(const [id,x,z] of [['guest',.5,2.5],['bath',5.35,1.65],['master',7.9,2.85],['kitchen',1.1,4.75],['bar',.55,6.1],['living',8.3,7.55],['hall',5.55,5.6],['balcony',11.75,6.8]])b+=text(ox+x*sc,oz+z*sc,names[id],14);
for(const o of m.openings.filter(o=>o.type==='door')){const a=(o.rotation||0)*Math.PI/180,p=o.hinge||o.center,x=ox+p[0]*sc,z=oz+p[1]*sc,w=o.width*sc;b+=`<g transform="translate(${x} ${z}) rotate(${o.rotation||0})"><path d="M0 0 L${w} 0 A${w} ${w} 0 0 0 0 ${-w} Z" fill="#ffffff50" stroke="#9a9c87" stroke-width="1"/></g>`;}
b+=`<path d="M${ox+3.92*sc} ${oz+4.31*sc}V${oz+5.85*sc}H${ox}" stroke="#719b99" stroke-width="3" fill="none"/>`;
b+=text(65,920,'厨房框线与柜体名义前缘：冰箱 z=4.31 / 客厅浅柜 z=4.81；把手、滑轨另有突出。',15);
b+=text(65,950,'备用桌椅默认收纳；厨房玻璃可关闭。此图按最终模型外廓生成，非以效果图反推尺度。',15);
await writeFile(resolve(out,'01_最终模型平面.svg'),svg(1240,1040,'MuKo Home / R2 最终模型平面',b));
let e='';const ids=['r2-fridge-cabinet','r2-waterbar','r2-entry','r2-living-shallow','r2-living-deep','r2-guest-wardrobe','r2-master-wardrobe','r2-housekeeping'];
ids.forEach((id,index)=>{const o=m.objects.find(o=>o.id===id),s=90,x=55+(index%3)*440,y=120+Math.floor(index/3)*350;e+=text(x,y-18,o.label,17);e+=rect(x,y,o.w*s,o.h*s,'#a88866');for(const bay of o.r2Cabinet.bays){e+=rect(x+(bay.x+o.w/2-bay.w/2)*s+1,y+(o.h-bay.y-bay.h)*s+1,bay.w*s-2,bay.h*s-2,bay.door==='open'?'#f0e7d6':'#cfd1bd');for(const shelf of bay.shelves??[])e+=rect(x+(bay.x+o.w/2-bay.w/2)*s+2,y+(o.h-bay.y-shelf)*s,bay.w*s-4,2,'#9f8260');}e+=text(x,y+o.h*s+24,`${Math.round(o.w*1000)} × ${Math.round(o.d*1000)} × ${Math.round(o.h*1000)} mm`,13);});
await writeFile(resolve(out,'02_八组通顶柜立面.svg'),svg(1400,1200,'MuKo Home / R2 通顶柜与开放格',e));
// A real x=1.25 m section from rear kitchen to the coffee cabinet; panels retain voids.
let c='',sx=165,sy=680,ss=190,zmin=3.4;const X=z=>sx+(z-zmin)*ss,Y=y=>sy-y*ss;
c+=`<path d="M${X(3.4)} ${Y(0)}H${X(8.45)}M${X(3.4)} ${Y(2.7)}H${X(8.45)}" stroke="#687166" stroke-width="7"/>`;
for(const o of m.objects.filter(o=>o.r2Cabinet))for(const p of r2CabinetPanels(o)){const a=o.rotation*Math.PI/180,cosa=Math.cos(a),sina=Math.sin(a),wx=o.x+cosa*p.x-sina*p.z,wz=o.z+sina*p.x+cosa*p.z,ww=Math.abs(cosa)*p.w+Math.abs(sina)*p.d,dd=Math.abs(sina)*p.w+Math.abs(cosa)*p.d;if(1.25<wx-ww/2||1.25>wx+ww/2)continue;c+=rect(X(wz-dd/2),Y(p.y+p.h/2),dd*ss,p.h*ss,'#ac8b65');}
c+=rect(X(5.85)-2,Y(2.7),4,1.75*ss,'#b7d0cc','#6d9290');
for(const [z0,z1,label] of [[4.09,5.20,'后排—半岛 1.11m'],[5.85,7.61,'半岛—水吧 1.76m（名义）']]){const y=Y(.37);c+=`<path d="M${X(z0)} ${y}H${X(z1)}" stroke="#718775"/>`;c+=text((X(z0)+X(z1))/2-83,y-12,label,14);}
c+=text(75,90,'沿 x=1.25m 观察：厨房操作区 → 出品半岛 / 可关闭玻璃 → 咖啡壁龛',16);
c+=text(75,740,'净距为概念名义预算，滑轨、把手与设备开门另占空间；上柜空腔不等同于已核定可用容量。',15);
await writeFile(resolve(out,'03_餐厨水吧横切.svg'),svg(1240,840,'MuKo Home / R2 餐厨水吧横切',c));
await server.close();console.log(out);
