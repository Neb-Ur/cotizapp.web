import { Injectable, computed, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from './auth.service';

export interface WorkspaceLink { label: string; icon: string; section: string; accion?: string; }
export const ADMIN_WORKSPACE_LINKS: WorkspaceLink[] = [
  {section:'inicio',label:'Resumen',icon:'pi pi-chart-bar'},
  {section:'ferreterias',label:'Locales',icon:'pi pi-shop'},
  {section:'productos',label:'Catálogo maestro',icon:'pi pi-box'},
  {section:'solicitudes',label:'Validaciones',icon:'pi pi-check-circle'},
  {section:'usuarios',label:'Usuarios',icon:'pi pi-users'},
  {section:'contacto',label:'Mensajes de contacto',icon:'pi pi-envelope'},
  {section:'precios',label:'Reclamos de precios',icon:'pi pi-tag'},
  {section:'privacidad',label:'Derechos de datos',icon:'pi pi-lock'},
  {section:'propiedad',label:'Propiedad intelectual',icon:'pi pi-file'},
  {section:'gobierno',label:'Gobierno y seguridad',icon:'pi pi-shield'}
];
@Injectable({providedIn:'root'})
export class WorkspaceNavigationService {
  private readonly url = signal('');
  readonly active = computed(() => {
    const role=this.auth.currentUser()?.role, path=this.url().split(/[?#]/)[0];
    return (role==='admin' && path.startsWith('/dashboard/admin')) ||
      (role==='ferreteria' && (path==='/dashboard/ferreteria' || path==='/cuenta/contrato-ferreteria'));
  });
  readonly admin = computed(()=>this.auth.currentUser()?.role==='admin');
  readonly links = computed<WorkspaceLink[]>(()=> {
    if(this.admin()) return ADMIN_WORKSPACE_LINKS;
    const items:WorkspaceLink[]=[{section:'inicio',label:'Resumen',icon:'pi pi-chart-bar'},{section:'catalogo',label:'Mi catálogo',icon:'pi pi-box'}];
    return [...items,{section:'catalogo',accion:'agregar',label:'Agregar productos',icon:'pi pi-plus'},{section:'catalogo',accion:'archivo',label:'Carga por Excel',icon:'pi pi-upload'},
      {section:'cotizaciones',label:'Cotizaciones',icon:'pi pi-file-check'},{section:'perfil',label:'Mi perfil',icon:'pi pi-user'}];
  });
  readonly base = computed(()=>this.admin()?'/dashboard/admin/validaciones':'/dashboard/ferreteria');
  constructor(private readonly auth:AuthService, private readonly router:Router) {
    this.url.set(router.url);
    router.events.pipe(takeUntilDestroyed()).subscribe(event=>{if(event instanceof NavigationEnd)this.url.set(event.urlAfterRedirects);});
  }
  isActive(item:WorkspaceLink):boolean {
    const query=new URLSearchParams(this.url().split('?')[1]?.split('#')[0] || '');
    return this.url().split(/[?#]/)[0]===this.base() && (query.get('section') || 'inicio')===item.section && (query.get('accion') || '')===(item.accion || '');
  }
}
