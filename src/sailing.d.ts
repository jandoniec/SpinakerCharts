import type {Theme} from './index.js';
export interface PolarSample {tws:number;twa:number;speed:number}
export interface PolarPoint {twa:number;speed:number;samples:number}
export interface PolarGroup {tws:number;points:PolarPoint[]}
export interface SailingPolarOptions {data:PolarSample[];theme?:Theme;mirror?:boolean;width?:number;height?:number;maxSpeed?:number;targetTWS?:number;showTargets?:boolean;ariaLabel?:string}
export interface SailingPolarInstance {update(options:Partial<SailingPolarOptions>):void;render():void;destroy():void;toSVG():string}
export declare function normalizePolarData(records:PolarSample[],options?:{mirror?:boolean}):PolarGroup[];
export declare function computeVMG(speed:number,twa:number):number;
export declare function findBestVMG(points:PolarPoint[],direction?:'upwind'|'downwind'):(PolarPoint&{vmg:number;rawVMG:number})|null;
export declare function createSailingPolar(target:string|HTMLElement,options:SailingPolarOptions):SailingPolarInstance;
export declare function buildPerformanceMatrix(records:Record<string,number>[],options?:{windSteps?:number[];angleSteps?:number[];value?:string;aggregate?:'mean'|'max'}):Array<{tws:number;twa:number;value:number|null;samples:number}>;
