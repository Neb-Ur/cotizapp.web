import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApiClientService } from '../../core/services/api-client.service';
import { SeoService } from '../../core/services/seo.service';
import { DashboardMaestroComponent } from '../dashboard-maestro/dashboard-maestro.component';
import { UiLoaderComponent } from '../../shared/components/ui-loader/ui-loader.component';
export interface CatalogLandingView {
  path: string; name: string; title: string; description: string; count: number;
  filters: Record<string,string>; related: {path:string;name:string}[];
}
@Component({
  selector:'app-catalog-landing', standalone:true,
  imports:[CommonModule,RouterLink,DashboardMaestroComponent,UiLoaderComponent],
  template:`
    <main class="dashboard dashboard--public" *ngIf="loading"><article class="panel"><app-ui-loader label="Cargando catálogo..." /></article></main>
    <main class="dashboard dashboard--public" *ngIf="error"><article class="panel"><h1>{{ missing ? 'Sección no encontrada' : 'No pudimos cargar esta sección' }}</h1><p>{{ error }}</p><button *ngIf="!missing" type="button" (click)="load()">Reintentar</button> <a routerLink="/buscar">Ver todos los productos</a></article></main>
    <app-dashboard-maestro *ngIf="!loading && landing" [landing]="landing" />
  `
})
export class CatalogLandingComponent implements OnInit,OnDestroy {
  protected landing?: CatalogLandingView;
  protected loading=true;
  protected error='';
  protected missing=false;
  private subscription?:Subscription;
  private request=0;
  constructor(private route:ActivatedRoute,private api:ApiClientService,private seo:SeoService,private cdr:ChangeDetectorRef) {}
  ngOnInit():void {this.subscription=this.route.paramMap.subscribe(()=>void this.load());}
  protected async load():Promise<void> {
    const request=++this.request;this.loading=true;this.error='';this.missing=false;this.landing=undefined;this.cdr.markForCheck();
    try {
      const kind=this.route.snapshot.data['catalogKind'];const slug=this.route.snapshot.paramMap.get('slug');
      const landing=await this.api.get<CatalogLandingView>(`/catalogo-seo/${kind}/${encodeURIComponent(slug || '')}`);
      if(request!==this.request)return;
      this.landing=landing;this.seo.updateCollection(landing);
    } catch(error:any) {
      if(request!==this.request)return;
      this.missing=error?.status===404;
      this.error=this.missing?'Explora las familias y marcas disponibles desde el menú de categorías.':'Intenta nuevamente en unos momentos.';
      if(this.missing)this.seo.markProductNotFound();
    } finally {if(request===this.request){this.loading=false;this.cdr.markForCheck();}}
  }
  ngOnDestroy():void {this.request++;this.subscription?.unsubscribe();}
}
