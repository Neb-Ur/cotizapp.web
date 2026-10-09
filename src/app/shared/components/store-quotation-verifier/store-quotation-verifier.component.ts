import { Component, Input, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FirebaseDataService } from '../../../core/services/firebase-data.service';
import { StoreQuotationVerification } from '../../../core/models/app.models';
@Component({selector:'app-store-quotation-verifier',standalone:true,imports:[CommonModule,FormsModule],
 templateUrl:'./store-quotation-verifier.component.html',styleUrl:'./store-quotation-verifier.component.scss'})
export class StoreQuotationVerifierComponent {
 @Input() storeId='';
 protected quotationCode='';
 protected quotationResult:StoreQuotationVerification|null=null;
 protected quotationLookupError='';
 protected isLookingUpQuotation=false;
 constructor(private readonly apiService:FirebaseDataService,private readonly changeDetector:ChangeDetectorRef){}
 protected async lookupQuotation():Promise<void>{
  if(!this.storeId||!this.quotationCode.trim()||this.isLookingUpQuotation)return;
  this.isLookingUpQuotation=true;this.quotationResult=null;this.quotationLookupError='';
  try{this.quotationResult=await this.apiService.getStoreQuotation(this.storeId,this.quotationCode);}
  catch(error){this.quotationLookupError=error instanceof Error?error.message:'No pudimos verificar el código.';}
  finally{this.isLookingUpQuotation=false;this.changeDetector.markForCheck();}
 }
}
