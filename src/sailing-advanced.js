/**
 * SpinakerCharts: specjalistyczne wizualizacje żeglarskie.
 *
 * Cel architektury:
 * - niezależność od transportu NMEA, Sailaway i formatu plików;
 * - wejście jako zwykłe tablice próbek, które można przekazać z dowolnego adaptera;
 * - brak zewnętrznych zależności (korzystamy wyłącznie z SVG i DOM);
 * - kolory, opisy i rozmiary wyłącznie przez opcje przekazywane w kodzie.
 *
 * API nie wykonuje interpolacji przez brakujące dane pomiarowe. Dla krzywej VMG
 * korzystamy z jawnie podanego polara, nie z fikcyjnych szacunków jachtu.
 */
import {resolveStyle,interpolatePolar} from './studio.js';
import {svgToPNG,downloadPNG,serializeSVG} from './export.js';
const NS='http://www.w3.org/2000/svg';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function node(tag,attributes={},parent){const item=document.createElementNS(NS,tag);for(const [key,val] of Object.entries(attributes))item.setAttribute(key,String(val));parent?.appendChild(item);return item;}
function label(svg,text,x,y,style,attrs={}){const t=node('text',{x,y,fill:style.muted,'font-family':style.font,'font-size':11,...attrs},svg);t.textContent=text;return t;}
/**
 * Agregacja kierunków i prędkości wiatru do róży wiatru.
 * Kąt wejściowy jest kierunkiem stopniowym 0..360, sektor 0 ma środek na północy.
 * Wartości spoza dziedziny oraz rekordy bez poprawnego kierunku są ignorowane.
 * Wynik zawiera count, avgSpeed i udział w procentach ważny dla danego sektora.
 */
export function windRoseBins(rows,{directionKey='twd',speedKey='tws',sectors=16}={}){
  if(!Number.isInteger(sectors)||sectors<4||sectors>72)throw new RangeError('sectors must be 4..72');
  const bins=Array.from({length:sectors},(_,i)=>({direction:i*360/sectors,count:0,speedSum:0,speedCount:0}));
  let total=0;
  for(const row of rows){const d=row[directionKey];if(!finite(d))continue;
    const normalized=((d%360)+360)%360;
    const k=Math.floor(((normalized+180/sectors)%360)/(360/sectors));
    const b=bins[k];b.count++;total++;
    if(finite(row[speedKey])){b.speedSum+=row[speedKey];b.speedCount++;}}
  return bins.map(b=>({direction:b.direction,count:b.count,percentage:total?100*b.count/total:0,avgSpeed:b.speedCount?b.speedSum/b.speedCount:null}));
}
/**
 * Krzywa VMG względem TWA na jednym ustalonym TWS.
 * Zachowujemy znaki VMG: dodatni przy kursach na wiatr, ujemny z wiatrem.
 */
export function polarVMGCurve(polar,tws,{step=5}={}){
  if(!finite(step)||step<=0||step>90)throw new RangeError('step must be in (0,90]');
  const output=[];
  for(let angle=0;angle<=180;angle+=step){const speed=interpolatePolar(polar,tws,angle);
    output.push({twa:angle,speed,vmg:speed===null?null:speed*Math.cos(angle*Math.PI/180)});}
  if(output.at(-1)?.twa!==180){const speed=interpolatePolar(polar,tws,180);output.push({twa:180,speed,vmg:speed===null?null:-speed});}
  return output;
}
/**
 * Próbki heel angle / boat speed podawane są bez grupowania: punkty rozrzutu
 * pokazują tylko obserwacje. Na poziomie SVG ograniczamy liczbę elementów,
 * wybierając deterministycznie punkty równomiernie w czasie (limit maxPoints).
 */
export function sampleScatter(rows,maxPoints=1200){
  if(!Number.isInteger(maxPoints)||maxPoints<1)throw new RangeError('maxPoints must be positive integer');
  if(rows.length<=maxPoints)return rows;
  if(maxPoints===1)return [rows[0]];
  const out=[];for(let i=0;i<maxPoints;i++)out.push(rows[Math.round(i*(rows.length-1)/(maxPoints-1))]);return out;
}
/** Wspólny adapter dla trzech rodzajów wizualizacji. */
export function createSailingChart(target,{type='windRose',data=[],polar=[],tws=12,directionKey='twd',speedKey='tws',xKey='heel',yKey='stw',sectors=16,maxPoints=1200,height=350,theme='midnight',style={},title}={}){
  if(typeof document==='undefined')throw new Error('Sailing charts require browser DOM');
  const host=typeof target==='string'?document.querySelector(target):target;if(!host)throw new Error('Target element not found');
  let cfg={type,data,polar,tws,directionKey,speedKey,xKey,yKey,sectors,maxPoints,height,theme,style,title};
  const root=document.createElement('div');host.replaceChildren(root);let ro;
  function render(){
    root.replaceChildren();const c=cfg,S=resolveStyle(c.theme,c.style),W=Math.max(320,host.clientWidth||640),H=c.height;
    root.style.cssText=`width:100%;background:${S.background};border-radius:${S.radius}px;overflow:hidden`;
    const svg=node('svg',{viewBox:`0 0 ${W} ${H}`,width:'100%',height:H,role:'img','aria-label':c.title||c.type},root);
    label(svg,c.title||({windRose:'True wind rose',vmgCurve:'VMG polar curve',heelScatter:'Heel / boat speed'}[c.type]||c.type),20,27,S,{'font-size':15,'font-weight':650,fill:S.text});
    if(c.type==='windRose'){
      const bins=windRoseBins(c.data,{directionKey:c.directionKey,speedKey:c.speedKey,sectors:c.sectors});
      const cx=W/2,cy=H/2+12,R=Math.min((W-90)/2,(H-85)/2),max=Math.max(1,...bins.map(x=>x.count));
      for(let k=1;k<=4;k++)node('circle',{cx,cy,r:R*k/4,stroke:S.grid,fill:'none','stroke-dasharray':S.gridDash},svg);
      const step=2*Math.PI/c.sectors;
      for(const bin of bins){if(bin.count===0)continue;
        const radius=R*bin.count/max,angle=bin.direction*Math.PI/180-Math.PI/2;
        const a=angle-step*.42,b=angle+step*.42;
        const x1=cx+radius*Math.cos(a),y1=cy+radius*Math.sin(a),x2=cx+radius*Math.cos(b),y2=cy+radius*Math.sin(b);
        const path=node('path',{d:`M${cx} ${cy}L${x1} ${y1}A${radius} ${radius} 0 0 1 ${x2} ${y2}Z`,fill:S.accent,'fill-opacity':.23+bin.count/max*.65,stroke:S.accent,'stroke-width':.8},svg);
        node('title',{},path).textContent=`${bin.direction}° · ${bin.count} samples · ${bin.percentage.toFixed(1)}% · avg wind ${bin.avgSpeed?.toFixed(1)??'—'} kn`;
      }
      for(const [d,t] of [[0,'N'],[90,'E'],[180,'S'],[270,'W']]){const a=d*Math.PI/180-Math.PI/2;label(svg,t,cx+(R+18)*Math.cos(a),cy+(R+18)*Math.sin(a)+4,S,{'text-anchor':'middle'});}
    }else if(c.type==='vmgCurve'||c.type==='heelScatter'){
      const L=55,R=W-23,T=53,B=H-39,PW=R-L,PH=B-T;
      let points;
      if(c.type==='vmgCurve')points=polarVMGCurve(c.polar,c.tws).filter(p=>finite(p.vmg)).map(p=>({x:p.twa,y:p.vmg}));
      else points=sampleScatter(c.data.filter(row=>finite(row[c.xKey])&&finite(row[c.yKey])),c.maxPoints).map(row=>({x:row[c.xKey],y:row[c.yKey]}));
      if(!points.length){label(svg,'No data available',W/2,H/2,S,{'text-anchor':'middle'});return;}
      let xmin=Infinity,xmax=-Infinity,ymin=Infinity,ymax=-Infinity;
      for(const p of points){xmin=Math.min(xmin,p.x);xmax=Math.max(xmax,p.x);ymin=Math.min(ymin,p.y);ymax=Math.max(ymax,p.y);}
      if(xmin===xmax){xmin-=1;xmax+=1;}if(ymin===ymax){ymin-=1;ymax+=1;}
      const sx=x=>L+(x-xmin)/(xmax-xmin)*PW,sy=y=>B-(y-ymin)/(ymax-ymin)*PH;
      for(let i=0;i<=4;i++){const y=T+i*PH/4;node('line',{x1:L,x2:R,y1:y,y2:y,stroke:S.grid,'stroke-dasharray':S.gridDash},svg);label(svg,(ymax-i*(ymax-ymin)/4).toFixed(1),L-9,y+4,S,{'text-anchor':'end'});}
      if(c.type==='vmgCurve'){
        let d='';for(const p of points)d+=`${d?'L':'M'}${sx(p.x).toFixed(2)} ${sy(p.y).toFixed(2)} `;
        node('path',{d,fill:'none',stroke:S.accent,'stroke-width':S.strokeWidth,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
        label(svg,`TWS ${c.tws} kn · TWA (°)`,R,B+26,S,{'text-anchor':'end'});
      }else{
        for(const p of points)node('circle',{cx:sx(p.x),cy:sy(p.y),r:2.5,fill:S.accent,'fill-opacity':.5},svg);
        label(svg,`${c.xKey} / ${c.yKey}`,R,B+26,S,{'text-anchor':'end'});
      }
    }else throw new RangeError(`Unknown sailing chart type: ${c.type}`);
  }
  render();if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(render);ro.observe(host);}
  return {update(next={}){cfg={...cfg,...next,style:{...cfg.style,...(next.style||{})}};render();},render,destroy(){ro?.disconnect();root.remove();},toSVG(){return serializeSVG(root.querySelector('svg'));},toPNG(options={}){return svgToPNG(root.querySelector('svg'),{background:resolveStyle(cfg.theme,cfg.style).background,...options});},downloadPNG(filename='sailing-chart.png',options={}){return downloadPNG(root.querySelector('svg'),filename,{background:resolveStyle(cfg.theme,cfg.style).background,...options});}};
}
