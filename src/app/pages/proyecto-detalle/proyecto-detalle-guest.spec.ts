import { convertToParamMap, ActivatedRoute, Router } from '@angular/router';
import { vi } from 'vitest';
import { GuestQuotationService } from '../../core/services/guest-quotation.service';
import { ProyectoDetalleComponent } from './proyecto-detalle.component';
import { DataModeService } from '../../core/services/data-mode.service';
import { AuthService } from '../../core/services/auth.service';
import { FirebaseDataService } from '../../core/services/firebase-data.service';
const downloadQuotationPdf = vi.fn();
describe('guest quotation and PDF account requirement', () => {
  beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); });
  function setup(user: any = null, local = true, query: Record<string, string> = {}) {
    const guest = new GuestQuotationService();
    const api = { refreshPublicCatalogSection: vi.fn(async()=>{}), refreshMaestroData: vi.fn(async()=>{}),
      buildProjectQuotation: vi.fn((items)=>({ lines: items.map((item:any)=>({...item,unitPrice:5000})), optimalTotal:15000, mixedSaving:0 })),
      saveProject: vi.fn(async()=>({id:'cloud',verificationCode:'code',validUntil:'2026-10-20',pricingOffers:[]})) };
    const navigate=vi.fn(async()=>true);const navigateByUrl=vi.fn(async()=>true);
    const route={snapshot:{data:{localQuotation:local},queryParamMap:convertToParamMap(query)}};
    const component=new ProyectoDetalleComponent({mode:()=> 'real'} as unknown as DataModeService,route as unknown as ActivatedRoute,
      {navigate,navigateByUrl} as unknown as Router,{currentUser:()=>user} as unknown as AuthService,api as unknown as FirebaseDataService,
      undefined,null,null,guest,{download:downloadQuotationPdf,share:vi.fn()} as any) as any;
    return {component,guest,api,navigate,navigateByUrl};
  }
  it('allows guests to create, open and edit a quotation without navigating to registration',async()=>{
    const {component,guest,api,navigate}=setup();component.projectName='Cocina';component.projectItems=[{productName:'Cemento',quantity:3,storeId:'s'}];
    await component.saveProject();expect(api.saveProject).not.toHaveBeenCalled();
    const saved=guest.all()[0];expect(saved.name).toBe('Cocina');expect(navigate).toHaveBeenCalledWith(['/cotizaciones/local',saved.id]);
    await component.loadQuotation(saved.id);expect(api.refreshPublicCatalogSection).toHaveBeenCalledWith(true);
    component.projectItems[0].quantity=4;component.persistDraftIfNeeded();expect(new GuestQuotationService().get(saved.id)?.items[0].quantity).toBe(4);
    expect(downloadQuotationPdf).not.toHaveBeenCalled();
  });
  it('requires an account only on PDF download and preserves the quotation for the auth return',async()=>{
    const {component,guest,navigate}=setup();const quote=guest.create('Cocina','Dirección',[{productName:'Cemento',quantity:3,productoFerreteriaId:'o'}]);
    await component.loadQuotation(quote.id);await component.exportQuotation();
    expect(downloadQuotationPdf).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login'],{queryParams:{returnUrl:`/dashboard/maestro/cotizaciones/nuevo?cotizacionLocal=${quote.id}&descargar=1`}});
    expect(new GuestQuotationService().get(quote.id)?.items[0].quantity).toBe(3);
  });
  it('restores the local quotation after login, saves with server prices and then downloads the PDF once',async()=>{
    const guest=new GuestQuotationService();const quote=guest.create('Cocina','Dirección',[{productName:'Cemento',quantity:3,productoFerreteriaId:'o'}]);
    const {component,api}=setup({id:'maestro',role:'maestro'},false,{cotizacionLocal:quote.id,descargar:'1'});
    await component.loadQuotation('nuevo');
    expect(api.saveProject).toHaveBeenCalledWith('maestro','Cocina',quote.items,'Dirección',undefined,undefined,undefined,'');
    expect(downloadQuotationPdf).toHaveBeenCalledOnce();expect(downloadQuotationPdf).toHaveBeenCalledWith(expect.objectContaining({verificationCode:'code',validUntil:'2026-10-20'}));
    expect(new GuestQuotationService().get(quote.id)).toBeNull();
  });
  it('retains the local quotation and prevents download when account saving fails',async()=>{
    const guest=new GuestQuotationService();const quote=guest.create('Obra','',[{productName:'Cemento',quantity:3}]);
    const {component,api}=setup({id:'maestro',role:'maestro'},false,{cotizacionLocal:quote.id,descargar:'1'});api.saveProject.mockRejectedValueOnce(new Error('Límite de cotizaciones'));
    await component.loadQuotation('nuevo');expect(downloadQuotationPdf).not.toHaveBeenCalled();
    expect(new GuestQuotationService().get(quote.id)).not.toBeNull();expect(component.saveNotice).toContain('Límite');
  });
});
