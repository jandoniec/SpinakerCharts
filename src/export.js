/**
 * SpinakerCharts: eksport wykresu do formatów wektorowych i rastrowych.
 *
 * Mechanizm eksportu nie zależy od konkretnego rodzaju wykresu. Każdy
 * komponent posiadający element <svg> może skorzystać z tych funkcji.
 *
 * Uwaga: przeglądarka nie pozwala wyeksportować do PNG zasobów z serwerów,
 * które nie udostępniają odpowiednich nagłówków CORS. Nie maskujemy takiego
 * błędu, aby użytkownik nie pobierał pustego lub błędnego obrazu.
 */
export function serializeSVG(svg) {
  if (!svg) throw new Error('Brak elementu SVG do eksportu');
  const clone = svg.cloneNode(true);
  clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
  return new XMLSerializer().serializeToString(clone);
}
/**
 * Zwraca Blob (image/png), a nie ogromny ciąg base64. Pozwala to wydajnie
 * pobierać obraz, przekazać go do API albo umieszczać w raportach.
 * Domyślnie renderujemy w skali 2x; wyższe skale dają ostrzejsze obrazy.
 */
export async function svgToPNG(svg,{scale=2,background='#0c1728'}={}) {
  if (!svg) throw new Error('Brak elementu SVG do eksportu');
  if (!Number.isFinite(scale)||scale<=0||scale>8) throw new RangeError('Skala PNG musi należeć do (0, 8]');
  const vb=svg.viewBox.baseVal;
  const width=vb?.width || Number(svg.getAttribute('width'));
  const height=vb?.height || Number(svg.getAttribute('height'));
  if (!width||!height) throw new Error('SVG musi mieć wymiary lub viewBox');
  const canvas=document.createElement('canvas');
  canvas.width=Math.round(width*scale);canvas.height=Math.round(height*scale);
  const context=canvas.getContext('2d');
  if(!context)throw new Error('Nie można utworzyć Canvas 2D');
  const blob=new Blob([serializeSVG(svg)],{type:'image/svg+xml;charset=utf-8'});
  const url=URL.createObjectURL(blob);
  try {
    const bitmap=new Image();
    await new Promise((resolve,reject)=>{bitmap.onload=resolve;bitmap.onerror=()=>reject(new Error('Nie można odczytać SVG do eksportu PNG'));bitmap.src=url;});
    context.scale(scale,scale);
    context.fillStyle=background;context.fillRect(0,0,width,height);
    context.drawImage(bitmap,0,0,width,height);
    return await new Promise((resolve,reject)=>canvas.toBlob(out=>out?resolve(out):reject(new Error('Eksport PNG nie powiódł się')),'image/png'));
  } finally {URL.revokeObjectURL(url);}
}
/**
 * Pobiera wyłącznie wskazany wykres. Tworzymy tymczasowy adres blob:,
 * wywołujemy kliknięcie i zwalniamy pamięć po zakończeniu operacji.
 */
export async function downloadPNG(svg,filename='spinaker-chart.png',options={}){
  const blob=await svgToPNG(svg,options);
  const link=document.createElement('a'),url=URL.createObjectURL(blob);
  link.href=url;link.download=filename.endsWith('.png')?filename:`${filename}.png`;
  document.body.appendChild(link);link.click();link.remove();
  // Zwolnienie w kolejnym cyklu, aby silnik pobierania zdążył otworzyć URL.
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
