import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { GuestQuotationService } from '../services/guest-quotation.service';
import { publicQuotationGuard } from './public-quotation.guard';
describe('quotation quota route access', () => {
  let user: any;
  beforeEach(()=>{localStorage.clear();user=null;TestBed.configureTestingModule({providers:[provideRouter([]),{provide:AuthService,useValue:{verifiedUser:async()=>user,dashboardRouteForUser:()=>'/dashboard/ferreteria'}}]});});
  afterEach(()=>TestBed.resetTestingModule());
  async function navigate(path:string,params:Record<string,string>={}) {
    const result=await TestBed.runInInjectionContext(()=>publicQuotationGuard({routeConfig:{path},params,queryParams:{}} as unknown as ActivatedRouteSnapshot,{} as RouterStateSnapshot));
    return result instanceof UrlTree ? TestBed.inject(Router).serializeUrl(result) : result;
  }
  it('permits a first guest quotation and blocks both ways of opening a second editor',async()=>{
    expect(await navigate('cotizaciones/nueva')).toBe(true);
    const quote=TestBed.inject(GuestQuotationService).create('Obra');
    expect(await navigate('cotizaciones/nueva')).toBe('/cotizaciones?limite=1');
    expect(await navigate('cotizaciones/local/:projectId',{projectId:'nuevo'})).toBe('/cotizaciones?limite=1');
    expect(await navigate('cotizaciones/local/:projectId',{projectId:quote.id})).toBe(true);
  });
  it('routes authenticated maestros through account quotation quotas instead of creating more browser quotations',async()=>{
    user={id:'master',role:'maestro'};
    expect(await navigate('cotizaciones/nueva')).toBe('/dashboard/maestro/cotizaciones/nuevo');
    expect(await navigate('cotizaciones/local/:projectId',{projectId:'nuevo'})).toBe('/dashboard/maestro/cotizaciones/nuevo');
    expect(await navigate('cotizaciones')).toBe('/dashboard/maestro?section=cotizaciones');
  });
});
