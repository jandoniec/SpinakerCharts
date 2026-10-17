import type {ChartHandle,ThemeName,SpinakerStyle,PolarSample} from './studio.js';
export interface WindRoseBin {direction:number;count:number;percentage:number;avgSpeed:number|null}
export declare function windRoseBins(rows:Array<Record<string,any>>,options?:{directionKey?:string;speedKey?:string;sectors?:number}):WindRoseBin[];
export declare function polarVMGCurve(polar:PolarSample[],tws:number,options?:{step?:number}):Array<{twa:number;speed:number|null;vmg:number|null}>;
export declare function sampleScatter<T>(rows:T[],maxPoints?:number):T[];
export declare function createSailingChart(target:string|HTMLElement,options?:{
  type?:'windRose'|'vmgCurve'|'heelScatter';data?:Array<Record<string,any>>;polar?:PolarSample[];tws?:number;
  directionKey?:string;speedKey?:string;xKey?:string;yKey?:string;sectors?:number;maxPoints?:number;
  height?:number;theme?:ThemeName;style?:Partial<SpinakerStyle>;title?:string;
}):ChartHandle & {render():void};
