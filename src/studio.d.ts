import type { ChartTimeOptions } from './time.js';
/** Publiczne typy API SpinakerCharts Studio. Komentarze objaśniają kontrakt. */
export interface SpinakerStyle {
  background: string;surface:string;text:string;muted:string;grid:string;accent:string;
  positive:string;negative:string;font:string;strokeWidth:number;pointRadius:number;
  gridDash:string;radius:number;colors:string[];
}
export type ThemeName='midnight'|'daylight'|'slate';
export interface TelemetryRow {timestamp:number;__sampleIndex:number;[key:string]:unknown}
export interface TelemetryState {cursor:number;range:[number,number];playing:boolean;speed:number;index:number;sample:TelemetryRow|null}
export interface TelemetryController {
  rows:TelemetryRow[];
  getState():TelemetryState;
  getViewRange():[number,number];
  subscribeView(callback:(range:[number,number])=>void):()=>void;
  setViewRange(start:number,end:number):void;
  resetViewRange():void;
  subscribe(callback:(state:TelemetryState)=>void):()=>void;
  seek(value:number|string|Date):void;
  setRange(start:number|string|Date,end:number|string|Date):void;
  setSpeed(value:number):void;
  play():void;pause():void;stop():void;destroy():void;
}
export interface ChartHandle {update(options:Record<string,unknown>):void;destroy():void;toSVG():string;toPNG(options?:{scale?:number;background?:string}):Promise<Blob>;downloadPNG(filename?:string,options?:{scale?:number;background?:string}):Promise<void>}
export interface TelemetryChartOptions {
  controller:TelemetryController;
  fields?:Array<{key:string;label?:string;color?:string}>;
  title?:string;height?:number;theme?:ThemeName;style?:Partial<SpinakerStyle>;
  maxPoints?:number;motion?:boolean;syncZoom?:boolean;time?:ChartTimeOptions;
  onRangeSelected?:(range:[number,number])=>void;
  onCursorChange?:(time:number)=>void;
}
export interface PolarSample {tws:number;twa:number;speed:number}
export interface PolarBoat {name:string;data:PolarSample[];color?:string}
export interface PolarComparisonOptions {
  boats?:PolarBoat[];tws?:number;height?:number;theme?:ThemeName;
  style?:Partial<SpinakerStyle>;angles?:number[];mirror?:boolean;
}
export declare const spinakerStyles:Readonly<Record<ThemeName,Readonly<SpinakerStyle>>>;
export declare function resolveStyle(theme?:ThemeName,overrides?:Partial<SpinakerStyle>):SpinakerStyle;
export declare function toTimestamp(value:number|string|Date):number;
export declare function normalizeTelemetry(records:Record<string,any>[],timeKey?:string):TelemetryRow[];
export declare function closestSampleIndex(rows:TelemetryRow[],time:number):number;
export declare function createTelemetryController(records:Record<string,any>[],options?:{
  timeKey?:string;speed?:number;clock?:()=>number;
  requestFrame?:(fn:(now:number)=>void)=>any;cancelFrame?:(id:any)=>void;
}):TelemetryController;
export declare function createTelemetryChart(target:string|HTMLElement,options:TelemetryChartOptions):ChartHandle & {resetZoom():void};
export declare function interpolatePolar(data:PolarSample[],tws:number,twa:number):number|null;
export declare function polarPerformance<T extends Record<string,any>>(records:T[],reference:PolarSample[],options?:{twsKey?:string;twaKey?:string;speedKey?:string}):Array<T & {targetSpeed:number|null;performancePercent:number|null;deltaKnots:number|null;vmg:number|null}>;
export declare function comparePolars(boats:PolarBoat[],options:{tws:number;angles?:number[]}):Array<{twa:number;values:Array<{boat:string;speed:number|null}>}>;
export declare function createPolarComparison(target:string|HTMLElement,options:PolarComparisonOptions):ChartHandle & {render():void};

export declare function lowerBoundTime(rows:TelemetryRow[],time:number):number;
export declare function upperBoundTime(rows:TelemetryRow[],time:number):number;
export declare function visibleTimeBounds(rows:TelemetryRow[],start:number,end:number):[number,number];
