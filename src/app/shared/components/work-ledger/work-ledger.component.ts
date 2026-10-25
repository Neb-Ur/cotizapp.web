import {apiErrorMessage} from '../../../core/utils/api-error.util';
import {Component,Input,OnChanges,ChangeDetectorRef,HostListener} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';
import {ApiClientService} from '../../../core/services/api-client.service';
import {normalizeWorkLedger,ledgerTotals,type WorkLedger,type LedgerEntry} from '../../../../../functions/src/domain/professional-tools';
@Component({selector:'app-work-ledger',standalone:true,imports:[CommonModule,FormsModule],templateUrl:'./work-ledger.component.html',styleUrl:'../professional-tools/professional-tools.component.scss'})
export class WorkLedgerComponent implements OnChanges {
 @Input() ownerId='';@Input() projectId='';@Input() total=0;@Input() budgetedCost=0;@Input() budgetDirty=false;
 private savedFingerprint='';
 public get dirty(){return this.loaded && JSON.stringify(this.ledger)!==this.savedFingerprint;}
 public canLeave(){return !this.dirty || (typeof window!=='undefined' && window.confirm('Hay movimientos de obra sin guardar. ¿Salir y descartarlos?'));}
 @HostListener('window:beforeunload',['$event']) beforeUnload(event:BeforeUnloadEvent){if(this.dirty){event.preventDefault();event.returnValue='';}}
 protected ledger:WorkLedger=normalizeWorkLedger(null);protected busy=false;protected loaded=false;protected error='';protected notice='';
 protected kinds=[{id:'purchase',name:'Compra de materiales'},{id:'labor',name:'Jornadas / mano de obra'},{id:'expense',name:'Otro gasto'},{id:'payment',name:'Abono / pago del cliente'}];
 constructor(private api:ApiClientService,private cdr:ChangeDetectorRef){}
 ngOnChanges(changes:any){if(changes.ownerId||changes.projectId)this.load();}
 private get path(){return `/maestros/${this.ownerId}/proyectos/${this.projectId}/movimientos`;}
 protected async load(){if(!this.ownerId||!this.projectId||this.busy)return;if(this.dirty&&!this.canLeave())return;const path=this.path;this.loaded=false;this.error='';try{const data=await this.api.get<WorkLedger>(path,true);if(path!==this.path)return;this.ledger=data;this.savedFingerprint=JSON.stringify(data);this.loaded=true;}catch{this.error='No se pudieron cargar los movimientos.';}finally{this.cdr.markForCheck();}}
 protected get totals(){try{return ledgerTotals(this.ledger,this.total,this.budgetedCost);}catch{return null;}}
 protected money(v:number){return new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0}).format(v);}
 protected add(){if(this.ledger.entries.length>=500)return;this.ledger.entries.push({id:crypto.randomUUID(),date:new Date().toLocaleDateString('sv-SE'),kind:'purchase',description:'',quantity:1,unitPrice:0});this.notice='';}
 protected remove(i:number){this.ledger.entries.splice(i,1);this.notice='';}
 protected async save(){if(this.budgetDirty||this.busy||!this.loaded)return;this.error='';this.notice='';try{const next=normalizeWorkLedger(this.ledger);this.busy=true;this.ledger=await this.api.put<WorkLedger>(this.path,next,true);this.savedFingerprint=JSON.stringify(this.ledger);this.notice='Movimientos guardados. El presupuesto y su código se mantienen.';}catch(e){this.error=apiErrorMessage(e,'No se pudieron guardar los movimientos.');}finally{this.busy=false;this.cdr.markForCheck();}}
}
