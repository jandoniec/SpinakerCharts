/** SpinakerCharts Sailing v0.2.0: independent of data-source and NMEA vendor. */
import {chartThemes} from './index.js';
const NS='http://www.w3.org/2000/svg';
const COLORS=['#59ded0','#82a6ff','#f6be78','#ee86b0','#a99dfa','#98d682'];
const dom=(tag,attrs={},parent)=>{const el=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));parent?.appendChild(el);return el;};
const label=(svg,x,y,s,color,size=11,anchor='middle')=>{const t=dom('text',{x,y,fill:color,'font-size':size,'text-anchor':anchor,'font-family':'Inter,system-ui,sans-serif'},svg);t.textContent=s;return t;};
const polarPoint=(x,y,r,angle)=>[x+r*Math.sin(angle*Math.PI/180),y-r*Math.cos(angle*Math.PI/180)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const valid=n=>typeof n==='number'&&Number.isFinite(n);
/** Convert records {tws,twa,speed} into one curve per wind speed. 0 bow, 180 stern. */
export function normalizePolarData(records,{mirror=true}={}){
  if(!Array.isArray(records))throw new TypeError('Polar records must be an array');
  const groups=new Map();
  for(const row of records){if(!valid(row?.tws)||!valid(row?.twa)||!valid(row?.speed)||row.tws<0||row.speed<0||row.twa < -180||row.twa>360)continue;
    const twa=mirror?Math.abs(((row.twa+180)%360+360)%360-180):row.twa;
    if(twa<0||twa>180)continue;
    const key=row.tws;let angles=groups.get(key);if(!angles){angles=new Map();groups.set(key,angles);}
    const arr=angles.get(twa)||[];arr.push(row.speed);angles.set(twa,arr);
  }
  return [...groups.entries()].sort(([a],[b])=>a-b).map(([tws,angles])=>({tws,points:[...angles].sort(([a],[b])=>a-b).map(([twa,values])=>({twa,speed:values.reduce((a,b)=>a+b,0)/values.length,samples:values.length}))}));
}
export function computeVMG(speed,twa){if(!valid(speed)||!valid(twa))return NaN;return speed*Math.cos(twa*Math.PI/180);}
export function findBestVMG(points,direction='upwind'){
  if(!['upwind','downwind'].includes(direction))throw new TypeError('direction must be upwind or downwind');
  const candidates=points.filter(p=>valid(p.speed)&&valid(p.twa)&&p.twa>=0&&p.twa<=180&&(direction==='upwind'?p.twa<=90:p.twa>=90));
  if(!candidates.length)return null;
  return candidates.reduce((best,p)=>{const v=computeVMG(p.speed,p.twa)*(direction==='upwind'?1:-1);return v>best.vmg?{...p,vmg:v,rawVMG:computeVMG(p.speed,p.twa)}:best;},{vmg:-Infinity});
}
/** Precise true-wind-angle polar with mirrored port/starboard performance curves. */
export function createSailingPolar(target,options){
  if(typeof document==='undefined')throw Error('SpinakerCharts Sailing requires a browser DOM');
  const host=typeof target==='string'?document.querySelector(target):target;if(!host)throw Error('Target not found');
  let opt={mirror:true,theme:'midnight',height:400,...options};let ro;const root=document.createElement('div');root.style.position='relative';root.style.fontFamily='Inter,system-ui,sans-serif';host.replaceChildren(root);
  const tooltip=document.createElement('div');tooltip.style.cssText='position:absolute;display:none;pointer-events:none;border-radius:9px;padding:8px 12px;font:12px Inter,system-ui,sans-serif;box-shadow:0 12px 40px #0006;z-index:5';root.appendChild(tooltip);
  const render=()=>{
    root.querySelector('svg')?.remove();const theme=chartThemes[opt.theme]||chartThemes.midnight;const W=Math.max(330,opt.width||host.clientWidth||560),H=opt.height;const cx=W/2,cy=H/2+8,R=Math.min((W-115)/2,(H-78)/2);root.style.background=theme.background;root.style.borderRadius='12px';root.style.color=theme.text;tooltip.style.background=theme.surface;tooltip.style.color=theme.text;
    const svg=dom('svg',{viewBox:`0 0 ${W} ${H}`,width:'100%',role:'img','aria-label':opt.ariaLabel||'Sailing polar boat speed by true wind angle and wind speed'},root);
    const groups=normalizePolarData(opt.data||[],{mirror:opt.mirror});const max=opt.maxSpeed&&opt.maxSpeed>0?opt.maxSpeed:Math.max(1,Math.ceil(Math.max(0,...groups.flatMap(g=>g.points.map(p=>p.speed)))/2)*2);
    for(let j=1;j<=4;j++){dom('circle',{cx,cy,r:R*j/4,stroke:theme.grid,fill:'none','stroke-dasharray':'3 5'},svg);label(svg,cx+7,cy-R*j/4-5,(max*j/4).toFixed(1),theme.muted,10,'start');}
    for(let a=0;a<360;a+=30){const [x,y]=polarPoint(cx,cy,R,a);dom('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:theme.grid,'stroke-width':a%90===0?1.2:.6},svg);const [lx,ly]=polarPoint(cx,cy,R+19,a);label(svg,lx,ly+3,`${a<=180?a:360-a}°`,theme.muted,10);}
    label(svg,cx,15,'BOW · TWA 0°',theme.muted,10);label(svg,cx,H-7,'STERN · TWA 180°',theme.muted,10);
    const defs=dom('defs',{},svg);
    for(const [index,group]of groups.entries()){
      const color=COLORS[index%COLORS.length];const gradName=`spk-polar-${index}-${Math.random().toString(36).slice(2)}`;const gradient=dom('linearGradient',{id:gradName,x1:0,y1:0,x2:1,y2:1},defs);dom('stop',{offset:'0%','stop-color':color,'stop-opacity':'.14'},gradient);dom('stop',{offset:'100%','stop-color':color,'stop-opacity':'.03'},gradient);
      for(const side of [1,-1]){
        const points=group.points.map(p=>polarPoint(cx,cy,R*p.speed/max,p.twa*side));if(!points.length)continue;
        const d=points.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
        dom('path',{d,stroke:color,'stroke-width':2.4,'stroke-linecap':'round','stroke-linejoin':'round',fill:'none',opacity:side===1?1:.66},svg);
        group.points.forEach((p,i)=>{const [x,y]=points[i],hit=dom('circle',{cx:x,cy:y,r:6,fill:color,'fill-opacity':'.06',stroke:'none',tabindex:0,'aria-label':`TWS ${group.tws} kn, TWA ${p.twa}°, speed ${p.speed.toFixed(2)} kn`},svg);hit.addEventListener('pointerenter',e=>showTip(e,group,p));hit.addEventListener('pointermove',e=>showTip(e,group,p));hit.addEventListener('pointerleave',hide);hit.addEventListener('focus',e=>showTip(e,group,p));hit.addEventListener('blur',hide);});
      }
    }
    if(opt.showTargets!==false&&groups.length){const group=groups.find(g=>g.tws===opt.targetTWS)||groups[0];for(const direction of ['upwind','downwind']){const best=findBestVMG(group.points,direction);if(best){const [x,y]=polarPoint(cx,cy,R*best.speed/max,best.twa);dom('circle',{cx:x,cy:y,r:6,fill:theme.background,stroke:'#ffffff','stroke-width':2},svg);}}}
    const legend=dom('g',{},svg);groups.forEach((g,i)=>{const x=16+(i%5)*Math.min(106,(W-32)/5),y=H-23+Math.floor(i/5)*14;dom('line',{x1:x,y1:y,x2:x+13,y2:y,stroke:COLORS[i%COLORS.length],'stroke-width':3},legend);label(legend,x+18,y+4,`${g.tws} kn`,theme.muted,10,'start');});
    function showTip(e,g,p){const box=root.getBoundingClientRect();tooltip.textContent=`TWS ${g.tws} kn · TWA ${p.twa}° · Speed ${p.speed.toFixed(2)} kn · VMG ${computeVMG(p.speed,p.twa).toFixed(2)} kn`;tooltip.style.display='block';tooltip.style.left=`${clamp((e.clientX||box.left+box.width/2)-box.left+12,0,box.width-180)}px`;tooltip.style.top=`${clamp((e.clientY||box.top+box.height/2)-box.top-40,0,box.height-30)}px`;}
    function hide(){tooltip.style.display='none';}
  };render();if(typeof ResizeObserver!=='undefined'&&!opt.width){ro=new ResizeObserver(render);ro.observe(host);}return{update(next){opt={...opt,...next};render();},render,destroy(){ro?.disconnect();root.remove();},toSVG(){return new XMLSerializer().serializeToString(root.querySelector('svg'));}};
}
/** Boat efficiency samples grouped into a TWS x TWA matrix, missing cells remain null. */
export function buildPerformanceMatrix(records,{windSteps,angleSteps,value='speed',aggregate='mean'}={}){
  if(!Array.isArray(records))throw new TypeError('records must be an array');
  const validRows=records.filter(r=>valid(r?.tws)&&valid(r?.twa)&&valid(r?.[value]));
  const winds=windSteps||[...new Set(validRows.map(x=>x.tws))].sort((a,b)=>a-b);
  const angles=angleSteps||[...new Set(validRows.map(x=>Math.abs(x.twa)))].sort((a,b)=>a-b);
  return winds.flatMap(tws=>angles.map(twa=>{const vals=validRows.filter(r=>r.tws===tws&&Math.abs(r.twa)===twa).map(r=>r[value]);return{tws,twa,value:vals.length?(aggregate==='max'?Math.max(...vals):vals.reduce((a,b)=>a+b,0)/vals.length):null,samples:vals.length};}));
}
