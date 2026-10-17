/**
 * SpinakerCharts 0.5.0: kompozycja wykresów do jednego obrazu.
 *
 * Zamiast robić zrzut całego ekranu, eksportujemy konkretne elementy SVG.
 * Dzięki temu otrzymujemy wyłącznie wybrane wykresy, bez przycisków i innych
 * elementów aplikacji. Każdy wykres może mieć inny rozmiar.
 *
 * Wszystkie teksty z danych pozostają zawartością SVG, nie HTML strony.
 * Funkcja toPNG zwraca Blob, który aplikacja może wysłać na serwer.
 */
import {svgToPNG,downloadPNG,serializeSVG} from './export.js';
const NS='http://www.w3.org/2000/svg';
function cssEscape(text){return String(text).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[x]));}
export function makeDashboardSVG(charts,{columns=2,gap=20,padding=28,background='#091522',title='SpinakerCharts Report'}={}){
  if(!Array.isArray(charts)||charts.length===0)throw new TypeError('Wymagana niepusta lista wykresów');
  if(!Number.isInteger(columns)||columns<1||columns>12)throw new RangeError('columns musi mieścić się w [1, 12]');
  if(!Number.isFinite(gap)||gap<0||!Number.isFinite(padding)||padding<0)throw new RangeError('Nieprawidłowy odstęp');
  const items=charts.map(item=>{
    // Obsługujemy uchwyt biblioteki lub bezpośredni węzeł SVG.
    const svg=item?.tagName?.toLowerCase()==='svg'?item:item?.element?.querySelector?.('svg')||item?.querySelector?.('svg');
    const markup=svg?serializeSVG(svg):item?.toSVG?.();
    if(!markup)throw new TypeError('Każdy element musi posiadać toSVG() albo element SVG');
    const vb=markup.match(/viewBox="[\d.\-]+ [\d.\-]+ ([\d.]+) ([\d.]+)"/);
    if(!vb)throw new Error('Wykres nie ma prawidłowego viewBox');
    return {svg:markup,width:Number(vb[1]),height:Number(vb[2])};
  });
  const cellW=Math.max(...items.map(i=>i.width)),cellH=Math.max(...items.map(i=>i.height));
  const rows=Math.ceil(items.length/columns),header=title?58:0;
  const width=padding*2+columns*cellW+(columns-1)*gap;
  const height=padding*2+header+rows*cellH+(rows-1)*gap;
  const cells=items.map(({svg,width:w,height:h},i)=>{
    const x=padding+(i%columns)*(cellW+gap),y=padding+header+Math.floor(i/columns)*(cellH+gap);
    // Oryginalne SVG zagnieżdżamy zamiast usuwać ich defs, clipPath i gradienty.
    // UWAGA: powtarzające się identyfikatory definicji SVG mogą kolidować;
    // przed użyciem w złożonych własnych wykresach należy nadawać im unikalne ID.
    return `<svg x="${x}" y="${y}" width="${cellW}" height="${cellH}" viewBox="0 0 ${w} ${h}">${svg.replace(/^<svg[^>]*>/,'').replace(/<\/svg>\s*$/,'')}</svg>`;
  }).join('');
  return `<svg xmlns="${NS}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><rect width="100%" height="100%" fill="${cssEscape(background)}"/>${title?`<text x="${padding}" y="${padding+26}" font-family="system-ui,sans-serif" font-size="22" font-weight="700" fill="#e8f6ff">${cssEscape(title)}</text>`:''}${cells}</svg>`;
}
export async function dashboardToPNG(charts,options={}){
  const markup=makeDashboardSVG(charts,options);
  const parser=new DOMParser();const doc=parser.parseFromString(markup,'image/svg+xml');
  if(doc.querySelector('parsererror'))throw Error('Niepoprawny SVG kompozycji');
  return svgToPNG(doc.documentElement,{scale:options.scale??2,background:options.background??'#091522'});
}
export async function downloadDashboardPNG(charts,filename='spinaker-dashboard.png',options={}){
  const svg=new DOMParser().parseFromString(makeDashboardSVG(charts,options),'image/svg+xml').documentElement;
  return downloadPNG(svg,filename,{scale:options.scale??2,background:options.background??'#091522'});
}
