import { formatChartTime } from './time.js';
/**
 * SpinakerCharts ReplayBar 0.4.0
 *
 * Uniwersalny, dostępny panel transportu telemetrii. Komponent nie zna NMEA,
 * Sailaway ani nazw pól prędkości. Otrzymuje kontroler czasowy i renderuje
 * odtwarzanie z zachowaniem jego aktualnego stanu.
 *
 * Każda instancja używa oddzielnego korzenia oraz oddzielnej subskrypcji.
 * destroy() kończy subskrypcję i nie niszczy kontrolera, który może należeć
 * również do mapy lub innych wykresów.
 */
const speedValues=[0.25,0.5,1,2,5,10,25,50,100];
function formatTime(ms,opts){return formatChartTime(Math.round(ms),opts);}
const icons={
 play:'<path d="m9 6 10 6-10 6z"/>',
 pause:'<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
 start:'<path d="M6 5v14M19 6l-10 6 10 6z"/>',
 end:'<path d="M18 5v14M5 6l10 6-10 6z"/>',
 back:'<path d="M11 6 5 12l6 6zM19 6l-6 6 6 6z"/>',
 stop:'<rect x="6.5" y="6.5" width="11" height="11" rx="2"/>',
 forward:'<path d="m5 6 6 6-6 6zM13 6l6 6-6 6z"/>'
};
function icon(name){return `<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${icons[name]}</svg>`;}
const styleId='spinaker-replay-styles-v060';
export function injectReplayStyles(doc=document){
 if(doc.getElementById(styleId))return;
 const css=`
 .spk-replay{--spk-accent:#58e0d0;--spk-panel:#14253a;--spk-border:#304258;--spk-text:#eff7ff;--spk-muted:#91a8c2;color:var(--spk-text);background:linear-gradient(140deg,#152940,#101d30);border:1px solid var(--spk-border);border-radius:20px;padding:19px 22px;box-shadow:0 14px 40px #0003;font:13px Inter,system-ui,sans-serif}
 .spk-replay *{box-sizing:border-box}.spk-replay-btn svg,.spk-replay-btn svg *{pointer-events:none}.spk-replay-top,.spk-replay-bottom{display:flex;align-items:center;justify-content:space-between;gap:18px;flex-wrap:wrap}
 .spk-replay-top{margin-bottom:19px}.spk-replay-id{display:flex;align-items:center;gap:9px;color:var(--spk-muted);font-size:11px;text-transform:uppercase;letter-spacing:1.4px;font-weight:700}
 .spk-replay-dot{width:7px;height:7px;border-radius:50%;background:var(--spk-accent);box-shadow:0 0 13px var(--spk-accent)}
 .spk-replay-badge{border-radius:100px;padding:6px 11px;background:#ffffff10;border:1px solid #ffffff14;color:var(--spk-muted);font-size:10px;letter-spacing:.9px;text-transform:uppercase}
 .spk-replay-timeline{width:100%;appearance:none;display:block;cursor:pointer;height:7px;border-radius:100px;background:linear-gradient(90deg,var(--spk-accent) 0%,var(--spk-accent) var(--spk-progress),#354b63 var(--spk-progress),#354b63 100%);margin:15px 0 9px;border:0;padding:0}
 .spk-replay-timeline::-webkit-slider-thumb{appearance:none;width:17px;height:17px;border:4px solid var(--spk-accent);background:#f7ffff;border-radius:50%;box-shadow:0 0 0 5px #58e0d025}
 .spk-replay-timeline::-moz-range-thumb{width:9px;height:9px;border:4px solid var(--spk-accent);background:#fff;border-radius:50%;box-shadow:0 0 0 5px #58e0d025}
 .spk-replay-time{display:flex;justify-content:space-between;color:var(--spk-muted);font-variant-numeric:tabular-nums;font-size:11px}
 .spk-replay-bottom{margin-top:19px}.spk-replay-actions{display:flex;align-items:center;gap:8px}
 .spk-replay-btn{width:39px;height:39px;display:grid;place-items:center;border:1px solid #405671;border-radius:11px;color:#c8d8e8;background:#203149;cursor:pointer;padding:0;transition:background .16s,border-color .16s,transform .16s}
 .spk-replay-btn:hover{background:#294460;border-color:#68d7cd;transform:translateY(-1px)}.spk-replay-btn:focus-visible,.spk-replay-timeline:focus-visible,.spk-replay-speed:focus-visible{outline:2px solid #58e0d0;outline-offset:3px}
 .spk-replay-btn[data-action=stop]{color:#ffb8aa}.spk-replay-btn[data-action=stop]:hover{border-color:#ffb8aa;background:#462d3a}
 .spk-replay-btn-primary{width:47px;height:47px;background:var(--spk-accent);color:#08232a;border-color:var(--spk-accent);box-shadow:0 5px 22px #58e0d02c}
 .spk-replay-btn-primary:hover{background:#8af9e8}.spk-replay-clock{font-weight:700;font-size:20px;letter-spacing:.4px;font-variant-numeric:tabular-nums}.spk-replay-clock small{font-size:11px;color:var(--spk-muted);font-weight:500;margin-left:8px}
 .spk-replay-speed-wrap{display:flex;align-items:center;gap:12px;color:var(--spk-muted);font-size:12px}.spk-replay-speed{background:#203149;border:1px solid #405671;border-radius:10px;color:#f1f7ff;padding:9px 12px;cursor:pointer}
 @media(max-width:690px){.spk-replay{padding:16px}.spk-replay-bottom{gap:14px}.spk-replay-clock{order:-1;width:100%}}
 @media(prefers-reduced-motion:reduce){.spk-replay-btn{transition:none}.spk-replay-btn:hover{transform:none}}
 `;
 const node=doc.createElement('style');node.id=styleId;node.textContent=css;doc.head.appendChild(node);
}
/**
 * Funkcja zwraca interfejs update/destroy. Wymaga kontrolera Studio 0.3+.
 * stepSeconds podaje długość skoku w sekundach czasu symulowanego (nie
 * rzeczywistego); speedOptions pozwala zdefiniować dowolne dodatnie prędkości.
 */
export function createReplayBar(target,{controller,stepSeconds=10,speedOptions=speedValues,accent='#58e0d0',title='SESSION REPLAY',time={mode:'utc'}}={}){
 if(typeof document==='undefined')throw new Error('ReplayBar wymaga przeglądarki');
 const host=typeof target==='string'?document.querySelector(target):target;
 if(!host||!controller)throw new Error('Wymagane host i controller');
 if(!Array.isArray(speedOptions)||!speedOptions.length||speedOptions.some(s=>!Number.isFinite(s)||s<=0))throw new TypeError('Nieprawidłowa lista speedOptions');
 injectReplayStyles();
 const root=document.createElement('section');root.className='spk-replay';root.setAttribute('aria-label','Telemetry playback controls');root.style.setProperty('--spk-accent',accent);
 root.innerHTML=`
 <div class="spk-replay-top"><span class="spk-replay-id"><span class="spk-replay-dot"></span><span class="spk-replay-name"></span></span><span class="spk-replay-badge" data-state>Ready</span></div>
 <input data-timeline class="spk-replay-timeline" type="range" min="0" max="1000" value="0" aria-label="Seek session time" style="--spk-progress:0%"/>
 <div class="spk-replay-time"><span data-start>00:00:00</span><span data-end>00:00:00</span></div>
 <div class="spk-replay-bottom"><div class="spk-replay-actions">
 <button class="spk-replay-btn" data-action="start" aria-label="Go to start" title="Go to start">${icon('start')}</button>
 <button class="spk-replay-btn" data-action="back" aria-label="Step backward" title="Back ${stepSeconds}s">${icon('back')}</button>
 <button class="spk-replay-btn" data-action="stop" aria-label="Stop playback" title="Stop and rewind">${icon('stop')}</button>
 <button class="spk-replay-btn spk-replay-btn-primary" data-action="toggle" aria-label="Play" title="Play">${icon('play')}</button>
 <button class="spk-replay-btn" data-action="forward" aria-label="Step forward" title="Forward ${stepSeconds}s">${icon('forward')}</button>
 <button class="spk-replay-btn" data-action="end" aria-label="Go to end" title="Go to end">${icon('end')}</button>
 </div><div class="spk-replay-clock" data-clock>00:00:00<small>UTC</small></div>
 <label class="spk-replay-speed-wrap">Playback speed <select class="spk-replay-speed" data-speed aria-label="Playback speed"></select></label></div>`;
 host.replaceChildren(root);
 root.querySelector('.spk-replay-name').textContent=title;
 const select=root.querySelector('[data-speed]');
 for(const speed of speedOptions){const option=document.createElement('option');option.value=String(speed);option.textContent=`${speed}×`;select.appendChild(option);}
 const slider=root.querySelector('[data-timeline]');
 let touching=false;
 const getBounds=()=>{const s=controller.getState();return s.range;};
 const seekFraction=f=>{const [a,b]=getBounds();controller.seek(a+(b-a)*Math.max(0,Math.min(1,f)));};
 slider.addEventListener('input',()=>{touching=true;seekFraction(Number(slider.value)/1000);});
 slider.addEventListener('change',()=>{touching=false;});
 select.addEventListener('change',()=>controller.setSpeed(Number(select.value)));
 root.addEventListener('click',e=>{
   // Obsługa zawsze na przycisku: SVG i jego path nie mogą zatrzymać kliknięcia.
   const button=e.target instanceof Element?e.target.closest('button[data-action]'):null;
   const name=button?.dataset.action;if(!name||!root.contains(button))return;
   const s=controller.getState();
   if(name==='stop') controller.stop();
   else if(name==='toggle'){
     if(s.playing)controller.pause();
     else {if(s.cursor>=s.range[1])controller.seek(s.range[0]);controller.play();}
   } else if(name==='start')controller.seek(s.range[0]);
   else if(name==='end')controller.seek(s.range[1]);
   else if(name==='back')controller.seek(s.cursor-stepSeconds*1000);
   else if(name==='forward')controller.seek(s.cursor+stepSeconds*1000);
 });
 const unsubscribe=controller.subscribe(s=>{
   const timeOptions={...time,origin:controller.rows[0]?.timestamp??0};
   const [a,b]=s.range;
   const fraction=b===a?0:(s.cursor-a)/(b-a);
   if(!touching)slider.value=String(Math.round(fraction*1000));
   slider.style.setProperty('--spk-progress',`${Math.max(0,Math.min(100,fraction*100)).toFixed(2)}%`);
   root.querySelector('[data-start]').textContent=formatTime(a,timeOptions);
   root.querySelector('[data-end]').textContent=formatTime(b,timeOptions);
   root.querySelector('[data-clock]').innerHTML=`${formatTime(s.cursor,timeOptions)}<small>${time.mode==='elapsed'?'ELAPSED':time.mode==='local'?'LOCAL':'UTC'}</small>`;
   root.querySelector('[data-state]').textContent=s.playing?'Playing':(s.cursor===a?'Stopped':'Paused');
   const btn=root.querySelector('[data-action="toggle"]');btn.innerHTML=icon(s.playing?'pause':'play');btn.setAttribute('aria-label',s.playing?'Pause':'Play');btn.title=s.playing?'Pause':'Play';
   // Nie zmieniamy speedOptions automatycznie: gdy wartość jest zewnętrzna,
   // dopisujemy ją do listy, aby użytkownik zawsze widział aktualną prędkość.
   if(![...select.options].some(o=>Number(o.value)===s.speed)){const option=document.createElement('option');option.value=String(s.speed);option.textContent=`${s.speed}×`;select.appendChild(option);}
   select.value=String(s.speed);
 });
 return {update({accent:nextAccent,title:nextTitle}={}){if(nextAccent)root.style.setProperty('--spk-accent',nextAccent);if(nextTitle)root.querySelector('.spk-replay-name').textContent=nextTitle;},destroy(){unsubscribe();root.remove();},element:root};
}
