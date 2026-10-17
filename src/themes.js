/**
 * SpinakerCharts 0.4: zapisywanie motywów graficznych.
 *
 * Funkcje walidują wartości jeszcze przed odczytem/zapisem. W środowiskach
 * prywatnych lub z blokadą pamięci localStorage rzuca wyjątek; świadomie
 * przekazujemy go wyżej, aby interfejs mógł pokazać odpowiedni komunikat.
 * W Node można wstrzyknąć obiekt o metodach getItem/setItem.
 */
const color=/^#[0-9a-fA-F]{6}$/;
const allowed=['midnight','daylight','slate'];
export function validateThemePreset(preset){
 if(!preset||typeof preset!=='object')throw new TypeError('Preset musi być obiektem');
 if(!allowed.includes(preset.theme))throw new RangeError('Nieznany motyw graficzny');
 if(!color.test(preset.accent))throw new TypeError('Accent musi mieć postać #RRGGBB');
 if(preset.colors!==undefined&&(!Array.isArray(preset.colors)||!preset.colors.length||preset.colors.some(v=>!color.test(v))))throw new TypeError('Niepoprawna paleta kolorów');
 return {theme:preset.theme,accent:preset.accent,...(preset.colors?{colors:[...preset.colors]}:{})};
}
export function saveThemePreset(name,preset,storage=globalThis.localStorage){
 if(typeof name!=='string'||!name.trim())throw new TypeError('Preset wymaga nazwy');
 const safe=validateThemePreset(preset);
 storage.setItem(`spinakercharts:preset:${name}`,JSON.stringify(safe));
 return safe;
}
export function loadThemePreset(name,storage=globalThis.localStorage){
 const raw=storage.getItem(`spinakercharts:preset:${name}`);
 return raw===null?null:validateThemePreset(JSON.parse(raw));
}
