import type { ChartTimeOptions } from './time.js';
import type {TelemetryController} from './studio.js';
/** Sterownik transportu telemetrii. Przeznaczony dla kontrolek DOM. */
export declare function createReplayBar(target:string|HTMLElement,options:{controller:TelemetryController;stepSeconds?:number;speedOptions?:number[];accent?:string;title?:string;time?:ChartTimeOptions}):{update(options?:{accent?:string;title?:string;time?:ChartTimeOptions}):void;destroy():void;element:HTMLElement};
export declare function injectReplayStyles(doc?:Document):void;
