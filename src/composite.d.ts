import type {ChartHandle} from './studio.js';
export interface DashboardExportOptions {columns?:number;gap?:number;padding?:number;background?:string;title?:string;scale?:number}
export declare function makeDashboardSVG(charts:Array<ChartHandle|SVGSVGElement|HTMLElement>,options?:DashboardExportOptions):string;
export declare function dashboardToPNG(charts:Array<ChartHandle|SVGSVGElement|HTMLElement>,options?:DashboardExportOptions):Promise<Blob>;
export declare function downloadDashboardPNG(charts:Array<ChartHandle|SVGSVGElement|HTMLElement>,filename?:string,options?:DashboardExportOptions):Promise<void>;
