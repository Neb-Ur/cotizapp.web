import {Component,EventEmitter,Input,Output,OnChanges} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {quotationStatus,quotationStatuses,quotationStatusLabels,type QuotationStatus} from '../../../core/utils/quotation-workflow.util';
@Component({selector:'app-quotation-status',standalone:true,imports:[CommonModule,FormsModule],template:`
 <div class="tracking"><span class="status" [attr.data-status]="status">{{ labels[status] }}</span>
 <div class="controls"><label>Seguimiento<span class="visually-hidden"> de {{ name }}</span>
 <select [(ngModel)]="selection" [disabled]="disabled || busy"><option *ngFor="let option of options" [value]="option">{{ labels[option] }}</option></select></label>
 <button type="button" class="btn btn-outline" [disabled]="disabled || busy || selection === status" (click)="statusChange.emit(selection)">{{ busy ? 'Guardando…' : 'Actualizar' }}<span class="visually-hidden"> estado de {{ name }}</span></button></div></div>`,styles:[`
 :host{display:block;margin-block:.65rem}.tracking{display:grid;justify-items:start;gap:var(--space-2)}.status{padding:.3rem .65rem;border-radius:var(--r-full);font-size:var(--text-xs);font-weight:800;background:var(--surface-2);color:var(--ink-700)}.status[data-status=sent]{background:var(--info-50);color:var(--info-700)}.status[data-status=accepted]{background:var(--success-50);color:var(--success-700)}.status[data-status=rejected]{background:var(--danger-50);color:var(--danger-700)}.controls{display:flex;align-items:end;gap:var(--space-2);flex-wrap:wrap}label{display:grid;gap:var(--space-1);font-size:var(--text-xs);color:var(--ink-700)}select{min-height:44px;max-width:100%;padding:.5rem .6rem;border:1px solid var(--border-med);border-radius:var(--r-sm);background:var(--surface-0);color:var(--ink-900);font:inherit;font-size:var(--text-sm)}button{min-height:44px;font-size:var(--text-xs);padding:.5rem .75rem}select:focus-visible,button:focus-visible{outline:3px solid var(--orange);outline-offset:3px}
 `]})
export class QuotationStatusComponent implements OnChanges {
 @Input() value?:QuotationStatus;
 @Input() name='cotización';
 @Input() busy=false;
 @Input() disabled=false;
 @Output() statusChange=new EventEmitter<QuotationStatus>();
 protected readonly options=quotationStatuses;
 protected readonly labels=quotationStatusLabels;
 protected selection:QuotationStatus='draft';
 protected get status(){return quotationStatus(this.value);}
 ngOnChanges(){this.selection=this.status;}
}
