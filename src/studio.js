/**
 * SpinakerCharts Studio 0.3.0
 *
 * Moduł nie zna formatu NMEA ani Sailaway. Otrzymuje wyłącznie uporządkowane
 * próbki {timestamp, ...pola} z warstwy aplikacji. Zapewnia to łatwą podmianę
 * źródła danych bez przepisywania grafiki.
 *
 * API celowo nie ma zależności: działa w przeglądarce ze standardowym SVG.
 */
import { chartThemes } from './index.js';
import { toUTCMilliseconds, formatChartTime } from './time.js';
import { normalizePolarData, computeVMG } from './sailing.js';
import { svgToPNG, downloadPNG, serializeSVG } from './export.js';

const NS = 'http://www.w3.org/2000/svg';
const DEFAULT_SERIES = ['#58e0d0','#89a8ff','#ffbf7a','#f48fb7','#b6a3ff','#a5e28b'];
const finite = v => typeof v === 'number' && Number.isFinite(v);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * Centralny system wyglądu. Wszystkie wartości można podmienić w options.style.
 * Styl wejściowy nie jest mutowany; ten sam obiekt można współdzielić.
 */
export const spinakerStyles = Object.freeze({
  midnight: Object.freeze({ background:'#0c1728',surface:'#15263c',text:'#f2f7ff',muted:'#96abc4',grid:'#2b3e56',accent:'#58e0d0',positive:'#6ee7c5',negative:'#ff8ba2',font:'Inter, system-ui, sans-serif',strokeWidth:2.8,pointRadius:3.7,gridDash:'3 6',radius:14,colors:DEFAULT_SERIES }),
  daylight: Object.freeze({ background:'#ffffff',surface:'#f3f7fc',text:'#14253b',muted:'#64748b',grid:'#dce5ef',accent:'#097e87',positive:'#087b64',negative:'#c94763',font:'Inter, system-ui, sans-serif',strokeWidth:2.8,pointRadius:3.7,gridDash:'3 6',radius:14,colors:['#087e89','#4667c9','#d18a30','#c15380'] }),
  slate: Object.freeze({ background:'#212936',surface:'#2b3647',text:'#f7f9ff',muted:'#a0b3cb',grid:'#405169',accent:'#9cc8ff',positive:'#7ddbbf',negative:'#ff9aaa',font:'Inter, system-ui, sans-serif',strokeWidth:2.8,pointRadius:3.7,gridDash:'3 6',radius:14,colors:DEFAULT_SERIES })
});
export function resolveStyle(theme='midnight', overrides={}) {
  // Kolory serii kopiujemy do nowej tablicy, aby unikać efektów ubocznych.
  const base = spinakerStyles[theme] || spinakerStyles.midnight;
  return {...base,...overrides,colors:[...(overrides.colors || base.colors)]};
}
function el(tag,attrs={},parent) {
  const e=document.createElementNS(NS,tag);
  Object.entries(attrs).forEach(([k,v]) => e.setAttribute(k,String(v)));
  if(parent)parent.appendChild(e);
  return e;
}
function txt(parent,x,y,value,style,extra={}) {
  const e=el('text',{x,y,fill:style.muted,'font-family':style.font,'font-size':11,...extra},parent);
  e.textContent=String(value);return e;
}

/**
 * Ujednolicenie czasu. Można używać znaczników Unix (ms), Date i ISO-8601.
 * Celowo nie interpretujemy małych liczb jako sekund: niejednoznaczne timestampy
 * potrafiłyby rozsunąć cały wykres o 1000x. Wymagamy milisekund.
 */
export function toTimestamp(value) {
  // Zachowujemy dawną nazwę funkcji dla istniejących integracji.
  // W odróżnieniu od Date.parse nie przyjmujemy dat bez strefy czasowej.
  return toUTCMilliseconds(value);
}
/**
 * Znormalizowane próbki porządkujemy chronologicznie. Równe timestampy
 * pozostają w kolejności wejściowej (Array.sort jest stabilne).
 */
export function normalizeTelemetry(records, timeKey='timestamp') {
  if (!Array.isArray(records)) throw new TypeError('records musi być tablicą');
  return records.map((r,index) => ({...r,timestamp:toTimestamp(r[timeKey]),__sampleIndex:index}))
    .sort((a,b) => a.timestamp-b.timestamp);
}
/** Wyszukiwanie binarne: czas O(log n), istotne przy wielogodzinnych sesjach. */
/**
 * Zwraca indeks pierwszej próbki z timestamp >= time, złożoność O(log n).
 * Dzięki temu przy milionie próbek nie przeglądamy całej sesji podczas zoomu.
 */
export function lowerBoundTime(rows,time) {
  let left=0,right=rows.length;
  while(left<right){const middle=(left+right)>>>1;
    if(rows[middle].timestamp<time)left=middle+1;else right=middle;}
  return left;
}
/** Pierwszy indeks timestamp > time; prawostronna granica widoczności. */
export function upperBoundTime(rows,time) {
  let left=0,right=rows.length;
  while(left<right){const middle=(left+right)>>>1;
    if(rows[middle].timestamp<=time)left=middle+1;else right=middle;}
  return left;
}
/**
 * Przedział [start,end) widocznych danych, bez alokowania dodatkowej tablicy.
 * Przydaje się również parserom telemetrii i zewnętrznym adapterom danych NMEA.
 */
export function visibleTimeBounds(rows,start,end){
  if(!rows.length||start>end)return [0,0];
  return [lowerBoundTime(rows,start),upperBoundTime(rows,end)];
}

export function closestSampleIndex(rows,time) {
  if (!rows.length) return -1;
  let l=0,r=rows.length;
  while(l<r){const m=(l+r)>>1;rows[m].timestamp < time ? l=m+1 : r=m;}
  if(l===0)return 0;if(l===rows.length)return rows.length-1;
  return Math.abs(rows[l].timestamp-time)<Math.abs(rows[l-1].timestamp-time)?l:l-1;
}

/**
 * Jeden współdzielony kontroler dla wielu wykresów i mapy rejsu.
 * Każdy subscriber dostaje kopię stanu i sam wyznacza najbliższy punkt.
 *
 * play/stop nie wymagają browser DOM; funkcja scheduler jest wstrzykiwalna,
 * co umożliwia deterministyczne testy i uruchomienie w różnych hostach.
 */
export function createTelemetryController(input,{timeKey='timestamp',speed=1,clock=()=>performance.now(),requestFrame=fn=>requestAnimationFrame(fn),cancelFrame=id=>cancelAnimationFrame(id)}={}) {
  const rows=normalizeTelemetry(input,timeKey);
  let state={cursor:rows[0]?.timestamp??0,range:[rows[0]?.timestamp??0,rows.at(-1)?.timestamp??0],playing:false,speed};
  const listeners=new Set();
  // Oddzielny, wspólny zakres widoku wszystkich wykresów danej sesji.
  // Replay nadal operuje na pełnym czasie sesji. Zoom nie przestawia zakresu odtwarzania.
  const viewListeners=new Set();
  const fullView=[rows[0]?.timestamp??0,rows.at(-1)?.timestamp??0];
  let viewRange=[...fullView];
  const notifyView=()=>{const snapshot=[...viewRange];for(const fn of [...viewListeners])fn(snapshot);};
  let frame=null,lastTime=null,destroyed=false;
  const emit=()=>{const snapshot=getState();for(const listener of [...listeners])listener(snapshot);};
  const getState=()=>({...state,range:[...state.range],index:closestSampleIndex(rows,state.cursor),sample:rows[closestSampleIndex(rows,state.cursor)]??null});
  const stopFrame=()=>{if(frame!==null){cancelFrame(frame);frame=null;}lastTime=null;};
  const tick=now=>{
    frame=null;if(!state.playing||destroyed)return;
    if(lastTime!==null){const next=state.cursor+Math.max(0,now-lastTime)*state.speed;
      if(next>=state.range[1]){state.cursor=state.range[1];state.playing=false;emit();stopFrame();return;}
      state.cursor=next;emit();}
    lastTime=now;frame=requestFrame(tick);
  };
  return {
    rows,
    getState,
    getViewRange(){return [...viewRange];},
    subscribeView(listener){if(destroyed)throw Error('Controller destroyed');viewListeners.add(listener);listener([...viewRange]);return()=>viewListeners.delete(listener);},
    setViewRange(start,end){
      if(destroyed)return;
      start=toTimestamp(start);end=toTimestamp(end);
      if(start>=end)throw new RangeError('View range must have positive duration');
      const width=Math.min(end-start,Math.max(1,fullView[1]-fullView[0]));
      const a=clamp(start,fullView[0],Math.max(fullView[0],fullView[1]-width));
      viewRange=[a,a+width];notifyView();
    },
    resetViewRange(){viewRange=[...fullView];notifyView();},
    subscribe(listener){if(destroyed)throw Error('Controller destroyed');listeners.add(listener);listener(getState());return()=>listeners.delete(listener);},
    seek(value){if(destroyed)return;state.cursor=clamp(toTimestamp(value),...state.range);lastTime=null;emit();},
    setRange(start,end){start=toTimestamp(start);end=toTimestamp(end);if(start>end)throw new RangeError('start > end');const lo=rows[0]?.timestamp??0,hi=rows.at(-1)?.timestamp??0;state.range=[clamp(start,lo,hi),clamp(end,lo,hi)];if(state.range[0]>state.range[1])state.range.reverse();state.cursor=clamp(state.cursor,...state.range);lastTime=null;emit();},
    setSpeed(value){if(!finite(value)||value<=0)throw new RangeError('speed musi być > 0');state.speed=value;emit();},
    play(){if(destroyed||state.playing||rows.length===0)return;state.playing=true;lastTime=clock();frame=requestFrame(tick);emit();},
    pause(){if(!state.playing)return;state.playing=false;stopFrame();emit();},
    /**
     * Stop różni się od Pause: anuluje klatkę animacji i cofa kursor
     * do początku aktywnego zakresu odtwarzania. Operacja jest idempotentna.
     * Pozostawiamy zoom użytkownika bez zmian.
     */
    stop(){if(destroyed)return;state.playing=false;stopFrame();state.cursor=state.range[0];emit();},
    destroy(){stopFrame();state.playing=false;destroyed=true;listeners.clear();viewListeners.clear();}
  };
}

/**
 * Interaktywny wykres telemetryczny z osią w czasie rzeczywistym.
 * - Ctrl nie jest wymagany do zoomu; scroll zmienia zakres pod kursorem.
 * - pointerdown + ruch pozwala przesuwać zakres (pan).
 * - shift + przeciągnięcie zaznacza zakres sesji.
 * - kliknięcie wybiera chwilę i synchronizuje pozostałe wykresy.
 * - redukcja pikselowa min/max ogranicza liczbę punktów renderowanych,
 *   zachowując charakterystyczne maksima i minima.
 */
export function createTelemetryChart(target,{controller,fields=[{key:'sog',label:'SOG'}],height=260,theme='midnight',style={},title='Telemetry',maxPoints=1000,onRangeSelected=()=>{},onCursorChange=()=>{},motion=true,syncZoom=true,time={mode:'utc'}}={}) {
  if(typeof document==='undefined')throw Error('Wykres wymaga środowiska browser DOM');
  const host=typeof target==='string'?document.querySelector(target):target;
  if(!host)throw Error('Nie znaleziono elementu docelowego');
  if(!controller)throw new TypeError('Wymagany controller');
  let config={height,theme,style,title,maxPoints,motion,fields,syncZoom,time};
  let rangeOverride=null,drag=null,raf=0,ro=null,unsub=null,unsubView=null,destroyed=false,animateNext=true;
  let cursorLine=null,cursorDot=null,cursorScale=null;
  const root=document.createElement('div');root.style.position='relative';root.style.width='100%';root.style.overflow='hidden';host.replaceChildren(root);
  const tip=document.createElement('div');tip.style.cssText='position:absolute;display:none;pointer-events:none;padding:8px 11px;border-radius:9px;z-index:3;font:12px system-ui';root.appendChild(tip);
  const schedule=()=>{if(raf||destroyed)return;raf=requestAnimationFrame(()=>{raf=0;draw();});};
  function draw(){
    root.querySelector('svg')?.remove();
    const S=resolveStyle(config.theme,config.style),W=Math.max(320,host.clientWidth||640),H=config.height;
    root.style.background=S.background;root.style.color=S.text;root.style.borderRadius=`${S.radius}px`;
    tip.style.background=S.surface;tip.style.color=S.text;tip.style.border=`1px solid ${S.grid}`;
    const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,width:'100%',height:H,role:'img','aria-label':config.title},root);
    const L=52,R=W-19,T=46,B=H-36,PW=R-L,PH=B-T;
    txt(svg,20,25,config.title,S,{'font-size':14,'font-weight':650,fill:S.text});
    const all=controller.rows,state=controller.getState(),view=(config.syncZoom&&controller.getViewRange?controller.getViewRange():rangeOverride)||state.range;
    const from=view[0],to=view[1],duration=Math.max(1,to-from);
    const [first,last]=visibleTimeBounds(all,from,to);
    const visible=all.slice(first,last);
    // Nie używamy Math.min(...dużaTablica): przy wielkich sesjach argumenty
    // rozbijają limit silnika JS. Liczymy ekstremum w pojedynczym przejściu.
    let lo=0,hi=1;
    for(const row of visible)for(const field of config.fields){const value=row[field.key];
      if(finite(value)){if(value<lo)lo=value;if(value>hi)hi=value;}}
    const delta=hi-lo||1;
    const sx=t=>L+(t-from)/duration*PW,sy=v=>B-(v-lo)/delta*PH;
    for(let i=0;i<5;i++){const y=T+i*PH/4;el('line',{x1:L,x2:R,y1:y,y2:y,stroke:S.grid,'stroke-dasharray':S.gridDash},svg);txt(svg,L-8,y+3,(hi-i*delta/4).toFixed(1),S,{'text-anchor':'end'});}
    const timeLabel=t=>formatChartTime(Math.round(t),{...config.time,origin:all[0]?.timestamp??0});
    for(let i=0;i<=4;i++)txt(svg,L+i*PW/4,B+20,timeLabel(from+i*duration/4),S,{'text-anchor':'middle','font-size':10});
    config.fields.forEach((field,fi)=>{
      // Dzielenie na koszyki ekranowe chroni przed przeciążeniem DOM.
      // Min/max per bucket: O(n) bez slice/filter/reduce na każdej grupie.
      // W efekcie zachowujemy piki i doliny, a SVG otrzymuje najwyżej ~maxPoints.
      const bucketWidth=Math.max(1,Math.ceil(visible.length/Math.max(2,config.maxPoints/2)));
      const candidates=[];
      for(let i=0;i<visible.length;i+=bucketWidth){
        let min=null,max=null;
        for(let j=i;j<Math.min(i+bucketWidth,visible.length);j++){
          const row=visible[j],value=row[field.key];if(!finite(value))continue;
          if(min===null||value<min[field.key])min=row;
          if(max===null||value>max[field.key])max=row;
        }
        if(min!==null){if(min===max)candidates.push(min);
          else if(min.timestamp<max.timestamp)candidates.push(min,max);
          else candidates.push(max,min);}
      }
      const pts=candidates.map(r=>[sx(r.timestamp),sy(r[field.key])]);
      const path=pts.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
      if(config.motion&&pts.length){el('path',{d:path,fill:'none',stroke:field.color||S.colors[fi%S.colors.length],'stroke-width':S.strokeWidth,'stroke-linejoin':'round','stroke-linecap':'round'},svg);}
      else el('path',{d:path,fill:'none',stroke:field.color||S.colors[fi%S.colors.length],'stroke-width':S.strokeWidth},svg);
      el('line',{x1:W-157,y1:22-fi*0,x2:W-141,y2:22,stroke:field.color||S.colors[fi%S.colors.length],'stroke-width':3},svg);
      txt(svg,W-135,26+fi*16,field.label||field.key,S,{'font-size':10});
    });
    // Aktualizacja kursora pozostaje natychmiastowa. Animujemy wejście wykresu
    // po zmianie konfiguracji, nie każdą klatkę replay (unika migotania).
    if(animateNext && config.motion && !(typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches)){
      // Klatki animacji tworzone są tylko po zmianie konfiguracji/zoomu.
      // Nie wykonujemy animacji podczas samego przesuwania kursora replay.
      for(const path of svg.querySelectorAll('path')){
        path.animate?.([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],
          {duration:480,easing:'cubic-bezier(.2,.75,.2,1)'});
      }
      animateNext=false;
    }
    // Oddzielna warstwa kursora nie wymaga przebudowy ścieżek przy replay.
    cursorLine=el('line',{x1:L,x2:L,y1:T,y2:B,stroke:S.accent,'stroke-dasharray':'5 4','stroke-width':1.4,'pointer-events':'none'},svg);
    cursorDot=el('circle',{cx:L,cy:B,r:3.5,fill:S.accent,'pointer-events':'none'},svg);
    cursorScale={from,to,L,R,B,span:duration};
    updateCursor(state.cursor);
    const hit=el('rect',{x:L,y:T,width:PW,height:PH,fill:'transparent',style:'cursor:crosshair;touch-action:none'},svg);
    function localX(event){const rect=svg.getBoundingClientRect();return clamp((event.clientX-rect.left)/rect.width*W,L,R);}
    function timeAt(x){return from+(x-L)/PW*duration;}
    hit.addEventListener('pointermove',e=>{
      const x=localX(e),t=timeAt(x),i=closestSampleIndex(all,t),sample=all[i];
      if(drag){if(drag.mode==='pan'){const moved=(x-drag.x)/PW*(drag.view[1]-drag.view[0]);const full=[all[0].timestamp,all.at(-1).timestamp];const span=drag.view[1]-drag.view[0];const start=clamp(drag.view[0]-moved,full[0],Math.max(full[0],full[1]-span));drag.pending=[start,start+span];}else{drag.end=x;const old=svg.querySelector('.spk-selection');old?.remove();el('rect',{class:'spk-selection',x:Math.min(x,drag.x),y:T,width:Math.abs(x-drag.x),height:PH,fill:S.accent,'fill-opacity':.12,stroke:S.accent,'stroke-dasharray':'5 4','pointer-events':'none'},svg);}return;}
      if(!sample)return;
      tip.style.display='block';tip.replaceChildren();
      // Tooltip składamy wyłącznie przez textContent: brak wstrzykiwania HTML z NMEA.
      const heading=document.createElement('div');heading.textContent=formatChartTime(sample.timestamp,{...config.time,origin:all[0]?.timestamp??0,date:true});
      heading.style.cssText='font-size:10px;opacity:.7;margin-bottom:7px';tip.appendChild(heading);
      for(const f of config.fields){const line=document.createElement('div');line.style.cssText='display:flex;justify-content:space-between;gap:24px;margin:3px 0';
        const label=document.createElement('span');label.textContent=f.label||f.key;
        const value=document.createElement('b');value.textContent=finite(sample[f.key])?sample[f.key].toFixed(2):'—';
        line.append(label,value);tip.appendChild(line);}
      tip.style.boxShadow='0 12px 35px #0006';
      tip.style.left=`${clamp(x+9,5,W-220)}px`;tip.style.top=`${T+8}px`;
    });
    hit.addEventListener('pointerleave',()=>{tip.style.display='none';});
    hit.addEventListener('pointerdown',e=>{if(!all.length)return;drag={x:localX(e),end:localX(e),view:[...view],mode:e.shiftKey?'select':'pan'};hit.setPointerCapture(e.pointerId);});
    hit.addEventListener('pointerup',e=>{if(!drag)return;const dx=Math.abs(localX(e)-drag.x),d=drag;drag=null;
      if(d.mode==='pan'&&dx>5&&d.pending){if(config.syncZoom&&controller.setViewRange)controller.setViewRange(...d.pending);else rangeOverride=d.pending;}
      if(d.mode==='select'&&dx>5){const a=timeAt(Math.min(d.x,localX(e))),b=timeAt(Math.max(d.x,localX(e)));onRangeSelected([a,b]);}
      else if(dx<=5){const t=timeAt(localX(e));controller.seek(t);onCursorChange(t);}
      schedule();
    });
    hit.addEventListener('pointercancel',()=>{drag=null;schedule();});
    hit.addEventListener('wheel',e=>{e.preventDefault();if(!all.length)return;const full=[all[0].timestamp,all.at(-1).timestamp],span=duration,minimum=Math.max(50,full[1]-full[0]>0?(full[1]-full[0])/10000:50);const next=clamp(span*(e.deltaY>0?1.25:.8),minimum,Math.max(minimum,full[1]-full[0]));const ratio=(localX(e)-L)/PW;const start=clamp(timeAt(localX(e))-next*ratio,full[0],Math.max(full[0],full[1]-next));if(config.syncZoom&&controller.setViewRange)controller.setViewRange(start,start+next);else rangeOverride=[start,start+next];schedule();},{passive:false});
    hit.addEventListener('dblclick',()=>{if(config.syncZoom&&controller.resetViewRange)controller.resetViewRange();else rangeOverride=null;schedule();});
  }
  // W typowym replay kursor przesuwa się 60 razy/s, ale same dane, skale i
  // ścieżki się nie zmieniają. Aktualizujemy tylko 2 atrybuty SVG kursora.
  function updateCursor(time){
    if(!cursorScale||!cursorLine||!cursorDot)return;
    const {from,L,R,B,span}=cursorScale,x=L+(time-from)/span*(R-L);
    const visible=x>=L&&x<=R;
    cursorLine.setAttribute('visibility',visible?'visible':'hidden');
    cursorDot.setAttribute('visibility',visible?'visible':'hidden');
    if(visible){cursorLine.setAttribute('x1',x);cursorLine.setAttribute('x2',x);cursorDot.setAttribute('cx',x);}
  }
  unsub=controller.subscribe(state=>{if(cursorScale)updateCursor(state.cursor);else schedule();});
  if(controller.subscribeView)unsubView=controller.subscribeView(schedule);
  if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(schedule);ro.observe(host);}
  function destroy(){destroyed=true;unsub?.();unsubView?.();ro?.disconnect();cancelAnimationFrame(raf);root.remove();}
  return {
    update(next={}){config={...config,...next,style:{...config.style,...(next.style||{})}};animateNext=true;schedule();},
    resetZoom(){if(config.syncZoom&&controller.resetViewRange)controller.resetViewRange();else rangeOverride=null;schedule();},
    destroy,
    toSVG(){return serializeSVG(root.querySelector('svg'));},
    toPNG(options={}){return svgToPNG(root.querySelector('svg'),{background:resolveStyle(config.theme,config.style).background,...options});},
    downloadPNG(filename='telemetry.png',options={}){return downloadPNG(root.querySelector('svg'),filename,{background:resolveStyle(config.theme,config.style).background,...options});}
  };
}

/**
 * Interpolacja liniowa prędkości pomiędzy znanymi punktami TWA i TWS.
 * Nie ekstrapolujemy poza tabelę polarów: brak danych zwraca null.
 * Jeśli brakuje jednego z narożników siatki TWS/TWA, również zwracamy null.
 */
export function interpolatePolar(data,tws,twa) {
  if(!finite(tws)||!finite(twa))return null;
  const groups=normalizePolarData(data),a=Math.abs(((twa+180)%360+360)%360-180);
  const along=group=>{
    if(!group)return null;const p=group.points;
    if(a<p[0]?.twa||a>p.at(-1)?.twa)return null;
    const right=p.findIndex(v=>v.twa>=a);if(right<0)return null;
    if(p[right].twa===a)return p[right].speed;
    if(right===0)return null;const l=p[right-1],r=p[right];return l.speed+(r.speed-l.speed)*(a-l.twa)/(r.twa-l.twa);
  };
  const upper=groups.findIndex(g=>g.tws>=tws);if(upper<0)return null;
  if(groups[upper].tws===tws)return along(groups[upper]);
  if(upper===0)return null;
  const g0=groups[upper-1],g1=groups[upper],v0=along(g0),v1=along(g1);
  if(v0===null||v1===null)return null;
  return v0+(v1-v0)*(tws-g0.tws)/(g1.tws-g0.tws);
}
/**
 * Target speed to prędkość referencyjna dla danego TWA/TWS.
 * Performance = measured/target*100. Gdy target=0 nie dzielimy przez zero.
 */
export function polarPerformance(records,reference,{twsKey='tws',twaKey='twa',speedKey='stw'}={}) {
  return records.map(row=>{const target=interpolatePolar(reference,row[twsKey],row[twaKey]);
    const actual=row[speedKey];const pct=target!==null&&target>0&&finite(actual)?actual/target*100:null;
    return {...row,targetSpeed:target,performancePercent:pct,deltaKnots:target!==null&&finite(actual)?actual-target:null,
      vmg:finite(actual)&&finite(row[twaKey])?computeVMG(actual,row[twaKey]):null};});
}
/** Przygotowanie porównania dowolnej liczby jachtów w tych samych punktach TWA. */
export function comparePolars(boats,{tws,angles=Array.from({length:19},(_,i)=>i*10)}={}) {
  if(!Array.isArray(boats))throw new TypeError('boats musi być tablicą');
  return angles.map(twa=>({twa,values:boats.map(boat=>({boat:boat.name,speed:interpolatePolar(boat.data,tws,twa)}))}));
}
/**
 * Rysowanie kilku polarów na wspólnej skali i przy ustalonym TWS.
 * style, labels, colors oraz wysokość pozostają konfigurowalne z poziomu API.
 */
export function createPolarComparison(target,{boats=[],tws=12,height=410,theme='midnight',style={},angles=Array.from({length:37},(_,i)=>i*5),mirror=true}={}) {
  if(typeof document==='undefined')throw Error('Wymaga browser DOM');
  const host=typeof target==='string'?document.querySelector(target):target;if(!host)throw Error('Brak kontenera');
  let cfg={boats,tws,height,theme,style,angles,mirror};const root=document.createElement('div');host.replaceChildren(root);let ro;
  function render(){
    root.replaceChildren();const S=resolveStyle(cfg.theme,cfg.style),W=Math.max(320,host.clientWidth||580),H=cfg.height,cx=W/2,cy=H/2+6,R=Math.min((W-150)/2,(H-85)/2);
    root.style.background=S.background;root.style.borderRadius=`${S.radius}px`;
    const svg=el('svg',{viewBox:`0 0 ${W} ${H}`,width:'100%',height:H,role:'img','aria-label':`Comparison of boat polars at TWS ${cfg.tws} knots`},root);
    const sampled=cfg.boats.map(boat=>({name:boat.name,values:cfg.angles.map(twa=>({twa,speed:interpolatePolar(boat.data,cfg.tws,twa)}))}));
    const max=Math.max(1,...sampled.flatMap(g=>g.values.map(v=>v.speed||0)));
    const polar=(radius,angle)=>[cx+radius*Math.sin(angle*Math.PI/180),cy-radius*Math.cos(angle*Math.PI/180)];
    for(let i=1;i<=4;i++){el('circle',{cx,cy,r:R*i/4,fill:'none',stroke:S.grid,'stroke-dasharray':S.gridDash},svg);txt(svg,cx+5,cy-R*i/4-4,(max*i/4).toFixed(1),S,{'font-size':10});}
    for(let a=0;a<360;a+=30){const p=polar(R,a);el('line',{x1:cx,y1:cy,x2:p[0],y2:p[1],stroke:S.grid},svg);}
    sampled.forEach((group,index)=>{
      const color=cfg.boats[index].color||S.colors[index%S.colors.length];
      for(const side of cfg.mirror?[1,-1]:[1]){
        // Luki w danych tworzą oddzielne ścieżki SVG: nie fałszujemy pomiarów.
        let chunks=[],current=[];
        for(const value of group.values){if(value.speed===null){if(current.length)chunks.push(current);current=[];}else current.push(polar(R*value.speed/max,value.twa*side));}
        if(current.length)chunks.push(current);
        for(const chunk of chunks){const d=chunk.map((p,i)=>`${i?'L':'M'}${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(' ');
          const path=el('path',{d,fill:'none',stroke:color,'stroke-width':S.strokeWidth,opacity:side===-1?.66:1,'stroke-linecap':'round','stroke-linejoin':'round'},svg);
          // Używamy animacji wyłącznie przy zmianach polarów, nie przy replay.
          if(!(typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches))
            path.animate?.([{opacity:0},{opacity:side===-1?.66:1}],{duration:450,easing:'ease-out'});
        }
      }
      const lx=14+(index%3)*Math.min(160,(W-28)/3),ly=H-30-Math.floor(index/3)*17;
      el('line',{x1:lx,x2:lx+17,y1:ly,y2:ly,stroke:color,'stroke-width':3},svg);txt(svg,lx+24,ly+4,group.name,S,{'font-size':11});
    });
    txt(svg,14,19,`TWS ${cfg.tws} kn · BOAT COMPARISON`,S,{fill:S.text,'font-size':13,'font-weight':650});
  }
  render();if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(render);ro.observe(host);}
  return {update(next){cfg={...cfg,...next,style:{...cfg.style,...(next.style||{})}};render();},render,destroy(){ro?.disconnect();root.remove();},toSVG(){return serializeSVG(root.querySelector('svg'));},toPNG(options={}){return svgToPNG(root.querySelector('svg'),{background:resolveStyle(cfg.theme,cfg.style).background,...options});},downloadPNG(filename='polar-comparison.png',options={}){return downloadPNG(root.querySelector('svg'),filename,{background:resolveStyle(cfg.theme,cfg.style).background,...options});}};
}
