/** SpinakerCharts v0.2.0 | Copyright (c) 2026. All rights reserved. */
const NS = 'http://www.w3.org/2000/svg';
const palette = ['#59ded0','#80a6ff','#fabf77','#ee82af','#b89bfa','#91d97c','#ef8c72','#6fc9f7'];
const themes = {
  midnight:{background:'#101a2b',surface:'#142238',text:'#f0f5ff',muted:'#8ea2bd',grid:'#2b3c55',accent:'#59ded0'},
  daylight:{background:'#ffffff',surface:'#f6f8fc',text:'#17233a',muted:'#64748b',grid:'#dfe5ef',accent:'#087f84'},
  slate:{background:'#202630',surface:'#27303e',text:'#f4f6fb',muted:'#9baac0',grid:'#424f61',accent:'#8db9ff'}
};
const finite = n=>Number.isFinite(Number(n));
const num = n=>Number(n)||0;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const fmt=n=>Number.isFinite(n)?new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(n):'–';
const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const node=(tag,attrs={},parent)=>{const el=document.createElementNS(NS,tag); for(const [k,v] of Object.entries(attrs)){if(v!==undefined&&v!==null)el.setAttribute(k,String(v));}parent?.appendChild(el);return el;};
const text=(parent,x,y,value,color,size=12,anchor='start',weight='400')=>{const el=node('text',{x,y,fill:color,'font-size':size,'text-anchor':anchor,'font-weight':weight,'font-family':'Inter, ui-sans-serif, system-ui, sans-serif'},parent);el.textContent=String(value);return el;};
const niceMax=x=>{if(x<=0)return 1;const p=10**Math.floor(Math.log10(x));const s=x/p;return (s<=1?1:s<=2?2:s<=5?5:10)*p;};
const point=(cx,cy,r,a)=>[cx+Math.sin(a)*r,cy-Math.cos(a)*r];
const pathPoints=pts=>pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
function style(){if(typeof document==='undefined'||document.getElementById('spinakercharts-style'))return;const el=document.createElement('style');el.id='spinakercharts-style';el.textContent=`.spk-root{position:relative;width:100%;font-family:Inter,ui-sans-serif,system-ui,sans-serif}.spk-root svg{display:block;width:100%;height:auto;overflow:visible}.spk-root svg [data-tip]{cursor:crosshair;outline:none}.spk-root svg [data-tip]:focus-visible{stroke-width:3;stroke:#fff}.spk-tooltip{position:absolute;pointer-events:none;z-index:5;padding:9px 12px;border:1px solid rgba(145,168,199,.25);border-radius:9px;box-shadow:0 12px 35px rgba(0,0,0,.25);font-size:12px;line-height:1.5;white-space:nowrap;display:none;transform:translate(-50%,-110%)}.spk-tooltip b{font-weight:650}.spk-legend{display:flex;flex-wrap:wrap;justify-content:center;gap:14px;font-size:11px;margin-top:7px}.spk-legend>span{display:inline-flex;align-items:center;gap:6px}.spk-legend i{display:inline-block;width:9px;height:9px;border-radius:3px}.spk-root text{user-select:none}.spk-root [data-series]{transition:opacity .14s ease}.spk-root .spk-legend span{cursor:pointer}`;document.head.appendChild(el);}
/** Create a chart in an HTML container. Browser-only; SVG rendering, accessible marks and tooltips. */
export function createChart(target,options){
  if(typeof document==='undefined')throw Error('SpinakerCharts requires a browser DOM');
  style();const host=typeof target==='string'?document.querySelector(target):target;
  if(!host)throw Error('SpinakerCharts: target not found');
  let opt={...options};let active=new Set();let ro=null;const root=document.createElement('div');root.className='spk-root';root.setAttribute('role','img');root.setAttribute('aria-label',opt.ariaLabel||`${opt.type||'line'} chart`);host.replaceChildren(root);
  const tooltip=document.createElement('div');tooltip.className='spk-tooltip';tooltip.setAttribute('role','status');root.appendChild(tooltip);
  const getTheme=()=>({...themes[opt.theme]||themes.midnight,...opt.colors});
  const makeTip=(label,value)=>`${escapeHtml(label)}<br><b>${escapeHtml(value)}</b>`;
  let view=null;
  const resetZoom=()=>{view=null;render();};
  const render=()=>{
    root.querySelectorAll('svg,.spk-legend').forEach(el=>el.remove());
    const theme=getTheme(),W=Math.max(300,opt.width||host.clientWidth||620),H=opt.height||320;
    root.style.color=theme.text;root.style.background=opt.transparent?'transparent':theme.background;root.style.borderRadius='12px';
    tooltip.style.background=theme.surface;tooltip.style.color=theme.text;
    const svg=node('svg',{viewBox:`0 0 ${W} ${H}`,role:'presentation'},root),allData=Array.isArray(opt.data)?opt.data:[],type=opt.type||'line';
    const zoomable=['line','area','spline','step','scatter','bubble'].includes(type);
    const windowRange=view&&zoomable?[Math.min(view[0],Math.max(0,allData.length-2)),Math.min(view[1],allData.length)]:[0,allData.length];
    const data=zoomable?allData.slice(...windowRange):allData;
    const series=opt.series?.length?opt.series:[{key:opt.y||'value',name:opt.y||'Value'}];
    const colors=series.map((s,i)=>s.color||palette[i%palette.length]);
    const pad={l:opt.yAxis===false?22:55,r:24,t:opt.title?56:30,b:opt.xAxis===false?25:54};
    const L=pad.l,R=W-pad.r,T=pad.t,B=H-pad.b,PW=R-L,PH=B-T;
    if(opt.title)text(svg,24,30,opt.title,theme.text,17,'start','650');
    if(!data.length){text(svg,W/2,H/2,'No data',theme.muted,14,'middle');return;}
    const tip=(el,label,value)=>{el.setAttribute('data-tip','');el.setAttribute('tabindex','0');el.setAttribute('aria-label',`${label}: ${value}`);el.dataset.tip=makeTip(label,value);};
    const grid=(min,max,labels)=>{for(let j=0;j<=4;j++){const y=B-PH*j/4;node('line',{x1:L,y1:y,x2:R,y2:y,stroke:theme.grid,'stroke-dasharray':'3 5'},svg);if(opt.yAxis!==false)text(svg,L-9,y+4,fmt(min+(max-min)*j/4),theme.muted,10,'end');}if(opt.xAxis!==false){const n=labels.length;for(let i=0;i<n;i+=Math.max(1,Math.ceil(n/6))){text(svg,L+(i+.5)*PW/n,B+21,String(labels[i]).slice(0,13),theme.muted,10,'middle');}}};
    const xval=(d,i)=>opt.x?d[opt.x]:i+1;
    const labels=data.map(xval);
    const lineTypes=['line','area','spline','step','scatter','bubble','bar','horizontalBar','stackedBar','histogram','waterfall','candlestick'];
    if(lineTypes.includes(type)){
      const horizontal=type==='horizontalBar';const barTypes=['bar','horizontalBar','stackedBar','histogram','waterfall','candlestick'];
      const ys=data.flatMap(d=>series.map(s=>num(d[s.key])));
      const cumulative=type==='stackedBar'?data.map(d=>series.reduce((a,s)=>a+num(d[s.key]),0)):[];
      let min=opt.min??(type==='candlestick'?Math.min(...data.map(d=>num(d.low))):Math.min(0,...ys));
      let max=opt.max??(type==='candlestick'?Math.max(...data.map(d=>num(d.high))):Math.max(0,...ys,...cumulative));
      if(type==='waterfall'){let total=0;const vals=data.map(d=>{total+=num(d[series[0].key]);return total;});min=Math.min(0,...vals);max=Math.max(0,...vals);}
      if(min===max)max=min+1;
      if(opt.max===undefined)max=niceMax(max);
      const scale=v=>B-(v-min)/(max-min)*PH;
      const zero=scale(0),n=data.length,slot=PW/n;
      if(horizontal){for(let i=0;i<=4;i++){const x=L+PW*i/4;node('line',{x1:x,y1:T,x2:x,y2:B,stroke:theme.grid,'stroke-dasharray':'3 5'},svg);text(svg,x,B+18,fmt(min+(max-min)*i/4),theme.muted,10,'middle');}}
      else grid(min,max,labels);
      if(['line','area','spline','step','scatter','bubble'].includes(type)){
        for(let si=0;si<series.length;si++){
          const s=series[si];if(active.has(si))continue;
          const pts=data.map((d,i)=>[L+(i+.5)*slot,scale(num(d[s.key]))]);
          if(!['scatter','bubble'].includes(type)){
            let path=pathPoints(pts);
            if(type==='step')path=pts.map((p,i)=>i?`H${p[0]} V${p[1]}`:`M${p[0]} ${p[1]}`).join(' ');
            if(type==='area'){const gradId=`spk-grad-${Math.random().toString(36).slice(2)}`;const defs=node('defs',{},svg),gradient=node('linearGradient',{id:gradId,x1:'0',y1:'0',x2:'0',y2:'1'},defs);node('stop',{offset:'0%','stop-color':colors[si],'stop-opacity':'.38'},gradient);node('stop',{offset:'100%','stop-color':colors[si],'stop-opacity':'0'},gradient);node('path',{d:`${path} L${pts.at(-1)[0]} ${zero} L${pts[0][0]} ${zero} Z`,fill:`url(#${gradId})`},svg);}
            node('path',{d:path,fill:'none',stroke:colors[si],'stroke-width':2.5,'stroke-linejoin':'round','stroke-linecap':'round'},svg);
          }
          pts.forEach(([x,y],i)=>{const size=type==='bubble'?clamp(Math.sqrt(Math.max(0,num(data[i][opt.size||'size'])))*2.1,3,22):3.6;const circle=node('circle',{cx:x,cy:y,r:size,fill:colors[si],opacity: type==='bubble'?.63:1,stroke:theme.background,'stroke-width':type==='scatter'?0:1.4},svg);tip(circle,`${s.name||s.key} · ${labels[i]}`,fmt(data[i][s.key]));});
        }
      }else if(type==='candlestick'){
        data.forEach((d,i)=>{const x=L+(i+.5)*slot,up=num(d.close)>=num(d.open),color=up?'#59ded0':'#f07994';node('line',{x1:x,x2:x,y1:scale(num(d.high)),y2:scale(num(d.low)),stroke:color,'stroke-width':1.7},svg);const y=Math.min(scale(num(d.open)),scale(num(d.close))),h=Math.max(1,Math.abs(scale(num(d.open))-scale(num(d.close))));const rect=node('rect',{x:x-slot*.27,y,width:slot*.54,height:h,rx:1,fill:color},svg);tip(rect,labels[i],`O ${fmt(d.open)} · H ${fmt(d.high)} · L ${fmt(d.low)} · C ${fmt(d.close)}`);});
      }else if(type==='waterfall'){
        let total=0;data.forEach((d,i)=>{const v=num(d[series[0].key]),prev=total;total+=v;const y=Math.min(scale(prev),scale(total)),h=Math.max(1,Math.abs(scale(prev)-scale(total)));const el=node('rect',{x:L+i*slot+slot*.22,y,width:slot*.56,height:h,rx:3,fill:v>=0?palette[0]:palette[3]},svg);tip(el,labels[i],`${fmt(v)} · Total ${fmt(total)}`);});
      }else{
        data.forEach((d,i)=>{let accum=0;series.forEach((s,si)=>{if(active.has(si))return;const v=num(d[s.key]);const group=type==='bar'||type==='horizontalBar';const width=slot*(group?.68/series.length:.72);const shift=group?si*width:0;const low=type==='stackedBar'?accum:0;if(type==='stackedBar')accum+=v;
          let x=L+i*slot+slot*.15+shift,y=Math.min(scale(low),scale(low+v)),w=width,h=Math.max(1,Math.abs(scale(low)-scale(low+v)));
          if(horizontal){const row=PH/data.length;x=L+PW*(0-min)/(max-min);y=T+i*row+row*.16;w=PW*v/(max-min);h=row*.68;}
          const rect=node('rect',{x,y,width:Math.max(1,w),height:h,rx:Math.min(4,h/4),fill:colors[si]},svg);tip(rect,`${s.name||s.key} · ${labels[i]}`,fmt(v));});});
      }
    } else if(['pie','donut','gauge','polar','radar','radialBar'].includes(type)){
      const cx=W/2,cy=H/2+8,outer=Math.min(W*.38,H*.35),key=series[0].key;
      if(['pie','donut','gauge'].includes(type)){
        const vals=data.map(d=>Math.max(0,num(d[key]))),total=vals.reduce((a,b)=>a+b,0)||1;let theta=0;
        data.forEach((d,i)=>{const v=vals[i];if(!v)return;const end=theta+Math.PI*2*v/total,inner=type==='pie'?0:outer*.62;const p1=point(cx,cy,outer,theta),p2=point(cx,cy,outer,end-.000001),p3=point(cx,cy,inner,end-.000001),p4=point(cx,cy,inner,theta);const large=end-theta>Math.PI?1:0;let path=inner?`M${p1} A${outer} ${outer} 0 ${large} 1 ${p2} L${p3} A${inner} ${inner} 0 ${large} 0 ${p4} Z`:`M${cx} ${cy} L${p1} A${outer} ${outer} 0 ${large} 1 ${p2} Z`;const el=node('path',{d:path,fill:palette[i%palette.length],stroke:theme.background,'stroke-width':2},svg);tip(el,xval(d,i),`${fmt(v)} (${fmt(v/total*100)}%)`);theta=end;});
        if(type==='gauge'){node('circle',{cx,cy,r:outer*.43,fill:theme.background},svg);text(svg,cx,cy+8,`${fmt(vals[0]/total*100)}%`,theme.text,26,'middle','700');}
        else if(type==='donut'){text(svg,cx,cy-2,fmt(total),theme.text,25,'middle','700');text(svg,cx,cy+18,opt.centerLabel||'TOTAL',theme.muted,10,'middle');}
      }else{
        const n=data.length,values=data.map(d=>num(d[key])),top=niceMax(Math.max(...values,1));
        for(let j=1;j<=4;j++){const pts=data.map((_,i)=>point(cx,cy,outer*j/4,i/n*Math.PI*2));node('polygon',{points:pts.map(p=>p.join(',')).join(' '),fill:'none',stroke:theme.grid,'stroke-dasharray':'3 5'},svg);}
        data.forEach((d,i)=>{const a=i/n*2*Math.PI,p=point(cx,cy,outer+19,a);text(svg,p[0],p[1],String(xval(d,i)).slice(0,12),theme.muted,10,'middle');});
        const pts=data.map((d,i)=>point(cx,cy,outer*clamp(num(d[key])/top,0,1),i/n*2*Math.PI));
        if(type==='radialBar'){data.forEach((d,i)=>{const a=i/n*Math.PI*2,p=point(cx,cy,outer*clamp(num(d[key])/top,0,1),a);node('line',{x1:cx,y1:cy,x2:p[0],y2:p[1],stroke:palette[i%palette.length],'stroke-width':Math.max(5,outer/n*.35),'stroke-linecap':'round'},svg);});}
        else {node('polygon',{points:pts.map(p=>p.join(',')).join(' '),fill:theme.accent,'fill-opacity':.18,stroke:theme.accent,'stroke-width':2.5},svg);pts.forEach((p,i)=>{const el=node('circle',{cx:p[0],cy:p[1],r:4,fill:theme.accent},svg);tip(el,xval(data[i],i),fmt(values[i]));});}
      }
    } else if(type==='heatmap'){
      const xk=opt.x||'x',yk=opt.y||'y',vk=opt.value||'value';const xs=[...new Set(data.map(d=>d[xk]))],ys=[...new Set(data.map(d=>d[yk]))];const vals=data.map(d=>num(d[vk])),lo=Math.min(...vals),hi=Math.max(...vals),cellW=PW/xs.length,cellH=PH/ys.length;
      data.forEach(d=>{const v=num(d[vk]),t=hi===lo?.7:(v-lo)/(hi-lo),x=L+xs.indexOf(d[xk])*cellW,y=T+ys.indexOf(d[yk])*cellH;const el=node('rect',{x:x+2,y:y+2,width:Math.max(1,cellW-4),height:Math.max(1,cellH-4),rx:3,fill:theme.accent,'fill-opacity':.12+t*.87},svg);tip(el,`${d[xk]} / ${d[yk]}`,fmt(v));});
      xs.forEach((v,i)=>text(svg,L+(i+.5)*cellW,B+19,v,theme.muted,10,'middle'));ys.forEach((v,i)=>text(svg,L-9,T+(i+.5)*cellH+4,v,theme.muted,10,'end'));
    } else if(type==='treemap'){
      const key=series[0].key,total=data.reduce((a,d)=>a+Math.max(0,num(d[key])),0)||1;let current=L;data.forEach((d,i)=>{const w=PW*Math.max(0,num(d[key]))/total;const el=node('rect',{x:current+2,y:T+2,width:Math.max(0,w-4),height:PH-4,rx:5,fill:palette[i%palette.length],opacity:.9},svg);tip(el,xval(d,i),fmt(d[key]));if(w>58)text(svg,current+w/2,T+PH/2,String(xval(d,i)).slice(0,10),theme.background,11,'middle','700');current+=w;});
    }else throw Error(`SpinakerCharts: unsupported chart type "${type}"`);
    if(opt.legend!==false&&series.length>1&&type!=='heatmap'){
      const lg=document.createElement('div');lg.className='spk-legend';lg.style.color=theme.muted;series.forEach((s,i)=>{const el=document.createElement('span');el.innerHTML=`<i style="background:${colors[i]}"></i>${escapeHtml(s.name||s.key)}`;el.style.opacity=active.has(i)?'.4':'1';el.onclick=()=>{active.has(i)?active.delete(i):active.add(i);render();};lg.appendChild(el);});root.appendChild(lg);
    }
    const crosshair=zoomable&&opt.crosshair!==false?node('line',{x1:L,x2:L,y1:T,y2:B,stroke:theme.muted,'stroke-dasharray':'4 5',opacity:'0','pointer-events':'none'},svg):null;
    svg.addEventListener('pointermove',e=>{if(crosshair){const rect=svg.getBoundingClientRect(),mx=(e.clientX-rect.left)*W/rect.width;crosshair.setAttribute('x1',clamp(mx,L,R));crosshair.setAttribute('x2',clamp(mx,L,R));crosshair.setAttribute('opacity',mx>=L&&mx<=R?'0.7':'0');}const el=e.target.closest('[data-tip]');if(!el){tooltip.style.display='none';return;}tooltip.innerHTML=el.dataset.tip;tooltip.style.display='block';const bounds=root.getBoundingClientRect();tooltip.style.left=`${clamp(e.clientX-bounds.left,55,bounds.width-55)}px`;tooltip.style.top=`${e.clientY-bounds.top-10}px`;});
    if(zoomable&&opt.zoom!==false){svg.style.touchAction='pan-y';svg.addEventListener('wheel',e=>{if(!e.ctrlKey&&!opt.wheelZoom)return;e.preventDefault();const total=allData.length;if(total<5)return;const span=windowRange[1]-windowRange[0],next=clamp(Math.round(span*(e.deltaY>0?1.25:.8)),4,total);const bounds=svg.getBoundingClientRect(),relative=clamp(((e.clientX-bounds.left)*W/bounds.width-L)/PW,0,1),center=windowRange[0]+span*relative;const start=clamp(Math.round(center-next*relative),0,total-next);view=next===total?null:[start,start+next];render();},{passive:false});}
    if(zoomable&&opt.zoom!==false){svg.addEventListener('dblclick',resetZoom);}

    svg.addEventListener('pointerleave',()=>{tooltip.style.display='none';if(crosshair)crosshair.setAttribute('opacity',0);});
    svg.addEventListener('focusin',e=>{if(e.target.dataset.tip){tooltip.innerHTML=e.target.dataset.tip;tooltip.style.display='block';const bounds=e.target.getBoundingClientRect(),base=root.getBoundingClientRect();tooltip.style.left=`${bounds.left-base.left+bounds.width/2}px`;tooltip.style.top=`${bounds.top-base.top}px`;}});
    svg.addEventListener('focusout',()=>tooltip.style.display='none');
    opt.onRender?.({svg,root});
  };
  render();if(typeof ResizeObserver!=='undefined'&&!opt.width){ro=new ResizeObserver(()=>render());ro.observe(host);}
  return {update(next){opt={...opt,...next};view=null;active.clear();render();},resetZoom,render,destroy(){ro?.disconnect();root.remove();},toSVG(){const svg=root.querySelector('svg');return new XMLSerializer().serializeToString(svg);},toPNG(scale=2){const svg=root.querySelector('svg'),str=new XMLSerializer().serializeToString(svg),blob=new Blob([str],{type:'image/svg+xml'}),url=URL.createObjectURL(blob);return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>{const canvas=document.createElement('canvas');canvas.width=svg.viewBox.baseVal.width*scale;canvas.height=svg.viewBox.baseVal.height*scale;const ctx=canvas.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle=getTheme().background;ctx.fillRect(0,0,svg.viewBox.baseVal.width,svg.viewBox.baseVal.height);ctx.drawImage(image,0,0);URL.revokeObjectURL(url);resolve(canvas.toDataURL('image/png'));};image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('PNG export failed'));};image.src=url;});}};
}
export const chartTypes=Object.freeze(['line','area','spline','step','scatter','bubble','bar','horizontalBar','stackedBar','histogram','waterfall','candlestick','pie','donut','gauge','polar','radar','radialBar','heatmap','treemap']);
export const chartThemes=Object.freeze(themes);
