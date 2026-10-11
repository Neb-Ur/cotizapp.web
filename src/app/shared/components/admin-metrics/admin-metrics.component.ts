import {CommonModule} from '@angular/common';
import {Component,Input,Output,EventEmitter} from '@angular/core';
import {AdminMetrics} from '../../../core/services/admin-metrics.service';
@Component({selector:'app-admin-metrics',standalone:true,imports:[CommonModule],templateUrl:'./admin-metrics.component.html',styleUrl:'./admin-metrics.component.scss'})
export class AdminMetricsComponent {
 @Input() metrics:AdminMetrics|null=null;
 @Input() loading=false;
 @Output() refresh=new EventEmitter<void>();
 @Output() sectionSelected=new EventEmitter<string>();
 protected get metricsUpdatedAt():string {return this.metrics ? new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',dateStyle:'short',timeStyle:'short'}).format(new Date(this.metrics.computedAt)) : '';}
 protected get visitChartMax():number {return Math.max(1,...(this.metrics?.days.map(day=>day.visits)||[]));}
}
