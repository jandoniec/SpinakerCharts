export interface SavedTheme {theme:'midnight'|'daylight'|'slate';accent:string;colors?:string[]}
export declare function validateThemePreset(preset:SavedTheme):SavedTheme;
export declare function saveThemePreset(name:string,preset:SavedTheme,storage?:Pick<Storage,'setItem'>):SavedTheme;
export declare function loadThemePreset(name:string,storage?:Pick<Storage,'getItem'>):SavedTheme|null;
