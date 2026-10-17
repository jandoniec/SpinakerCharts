export type ChartType = 'line'|'area'|'spline'|'step'|'scatter'|'bubble'|'bar'|'horizontalBar'|'stackedBar'|'histogram'|'waterfall'|'candlestick'|'pie'|'donut'|'gauge'|'polar'|'radar'|'radialBar'|'heatmap'|'treemap';
export type Theme = 'midnight'|'daylight'|'slate';
export interface Series {key:string;name?:string;color?:string}
export interface ChartOptions {type:ChartType;data:Record<string,any>[];x?:string;y?:string;value?:string;size?:string;series?:Series[];theme?:Theme;width?:number;height?:number;title?:string;ariaLabel?:string;min?:number;max?:number;legend?:boolean;xAxis?:boolean;yAxis?:boolean;centerLabel?:string;transparent?:boolean;crosshair?:boolean;zoom?:boolean;wheelZoom?:boolean;colors?:Partial<Record<'background'|'surface'|'text'|'muted'|'grid'|'accent',string>>;onRender?:(ctx:{svg:SVGSVGElement;root:HTMLDivElement})=>void}
export interface ChartInstance {update:(options:Partial<ChartOptions>)=>void;render:()=>void;resetZoom:()=>void;destroy:()=>void;toSVG:()=>string;toPNG:(scale?:number)=>Promise<string>}
export declare function createChart(target:string|HTMLElement,options:ChartOptions):ChartInstance;
export declare const chartTypes:readonly ChartType[];
export declare const chartThemes:Readonly<Record<Theme,Record<string,string>>>;
