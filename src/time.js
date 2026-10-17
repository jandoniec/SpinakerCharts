/**
 * SpinakerCharts UTC Time Core.
 *
 * Wszystkie znaczniki czasu wewnątrz silnika są liczbami Unix epoch w milisekundach.
 * Biblioteka NIE parsuje NMEA i NIE próbuje zgadywać strefy czasowej.
 * Tekstowe daty ISO muszą posiadać jawne Z lub offset ±HH:MM.
 * Dzięki temu dane pochodzące z różnych urządzeń trafiają na tę samą oś czasu.
 */
const ISO_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/i;

/** Nie należy konwertować sekund na milisekundy automatycznie: grozi to błędami 1000x. */
export function toUTCMilliseconds(value) {
  let ms;
  if (value instanceof Date) ms = value.getTime();
  else if (typeof value === 'number') ms = value;
  else if (typeof value === 'string') {
    if (!ISO_WITH_ZONE.test(value)) throw new TypeError('ISO date must include Z or explicit timezone offset');
    ms = Date.parse(value);
  } else throw new TypeError('Expected epoch milliseconds, Date, or ISO string with timezone');
  if (!Number.isFinite(ms) || !Number.isSafeInteger(ms) || Math.abs(ms) > 8.64e15)
    throw new RangeError('Invalid Unix epoch milliseconds');
  return ms;
}

/**
 * Wyświetlanie nie zmienia oryginalnego timestampu.
 * - utc: uniwersalny czas obserwacji;
 * - local: lokalna strefa odbiorcy (lub jawnie podana strefa IANA);
 * - elapsed: czas od początku sesji. Działa poprawnie także dla sesji >24 h.
 */
export function formatChartTime(value, { mode='utc', origin=0, seconds=true, milliseconds=false, timeZone, date=false, locale='en-GB' }={}) {
  const ms=toUTCMilliseconds(value);
  if (mode==='elapsed') {
    const delta=ms-toUTCMilliseconds(origin);
    const sign=delta<0?'-':'';
    const absolute=Math.abs(delta), hours=Math.floor(absolute/3600000);
    const minutes=Math.floor(absolute%3600000/60000), secs=Math.floor(absolute%60000/1000);
    return `${sign}${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}${seconds?`:${String(secs).padStart(2,'0')}`:''}${milliseconds?`.${String(absolute%1000).padStart(3,'0')}`:''}`;
  }
  if (mode!=='utc' && mode!=='local') throw new RangeError('Time mode must be utc, local or elapsed');
  const zone=mode==='utc'?'UTC':timeZone;
  const opts={hour:'2-digit',minute:'2-digit',hourCycle:'h23', ...(seconds?{second:'2-digit'}:{}),...(date?{year:'numeric',month:'2-digit',day:'2-digit'}:{}), ...(zone?{timeZone:zone}:{})};
  let result=new Intl.DateTimeFormat(locale,opts).format(ms);
  if(milliseconds) result+=`.${String(new Date(ms).getUTCMilliseconds()).padStart(3,'0')}`;
  return result;
}

/** Zwraca indeks najbliższej próbki w uporządkowanej osi UTC, bez interpolacji. */
export function closestUTCIndex(rows,value,{timeKey='timestamp',maxGap=Infinity}={}) {
  if(!rows.length)return -1;
  const time=toUTCMilliseconds(value);let lo=0,hi=rows.length;
  while(lo<hi){const mid=(lo+hi)>>>1;rows[mid][timeKey]<time?lo=mid+1:hi=mid;}
  const index=lo===0?0:lo===rows.length?rows.length-1:
    Math.abs(rows[lo][timeKey]-time)<Math.abs(rows[lo-1][timeKey]-time)?lo:lo-1;
  return Math.abs(rows[index][timeKey]-time)<=maxGap?index:-1;
}
