import {Injectable} from '@angular/core';
import {ApiClientService} from './api-client.service';
export interface AdminMetrics {
 computedAt:string;timeZone:string;today:number;week:number;month:number;
 maestros:number;stores:number;demo_stores:number;products:number;offers:number;
 quotations:number;quotations_today:number;pending_requests:number;tracking_since:string|null;
 days:Array<{date:string;visits:number}>;
}
@Injectable({providedIn:'root'})
export class AdminMetricsService {
 constructor(private api:ApiClientService){}
 load():Promise<AdminMetrics>{return this.api.get<AdminMetrics>('/admin/dashboard',true);}
}
