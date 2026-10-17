/** Opcje wyświetlania czasu; nie zmieniają znaczników czasu w danych. */
export interface ChartTimeOptions {
  mode?: 'utc'|'local'|'elapsed';
  origin?: number|string|Date;
  seconds?: boolean;
  milliseconds?: boolean;
  timeZone?: string;
  date?: boolean;
  locale?: string;
}
export declare function toUTCMilliseconds(value:number|string|Date):number;
export declare function formatChartTime(value:number|string|Date,options?:ChartTimeOptions):string;
export declare function closestUTCIndex(rows:Array<Record<string,number>>,time:number|string|Date,options?:{timeKey?:string;maxGap?:number}):number;
