import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { legalAcceptanceGuard } from './core/guards/legal-acceptance.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/public-layout/public-layout.component').then((module) => module.PublicLayoutComponent),
    children: [
      { path: '', loadComponent: () => import('./pages/home/home.component').then((module) => module.HomeComponent) },
      {
        path: 'buscar',
        loadComponent: () => import('./pages/dashboard-maestro/dashboard-maestro.component').then((module) => module.DashboardMaestroComponent),
        data: { publicCatalog: true }
      },
  {
    path: 'dashboard/maestro',
    loadComponent: () => import('./pages/dashboard-maestro/dashboard-maestro.component').then((module) => module.DashboardMaestroComponent),
    canActivate: [authGuard, legalAcceptanceGuard, roleGuard],
    data: { role: 'maestro' }
  },
  {
    path: 'dashboard/maestro/producto-detalle',
    redirectTo: 'producto'
  },
  {
    path: 'dashboard/maestro/cotizaciones/nuevo',
    loadComponent: () => import('./pages/proyecto-detalle/proyecto-detalle.component').then((module) => module.ProyectoDetalleComponent),
    canActivate: [authGuard, legalAcceptanceGuard, roleGuard],
    data: { role: 'maestro' }
  },
  {
    path: 'dashboard/maestro/cotizaciones/:projectId',
    loadComponent: () => import('./pages/proyecto-detalle/proyecto-detalle.component').then((module) => module.ProyectoDetalleComponent),
    canActivate: [authGuard, legalAcceptanceGuard, roleGuard],
    data: { role: 'maestro' }
  },
  {
    path: 'dashboard/maestro/proyectos/nuevo',
    redirectTo: 'dashboard/maestro/cotizaciones/nuevo',
    pathMatch: 'full'
  },
  {
    path: 'dashboard/maestro/proyectos/:projectId',
    redirectTo: 'dashboard/maestro/cotizaciones/:projectId',
    pathMatch: 'full'
  },
      { path: 'producto', loadComponent: () => import('./pages/producto-detalle/producto-detalle.component').then((module) => module.ProductoDetalleComponent) },
      { path: 'productos/:slug', loadComponent: () => import('./pages/producto-detalle/producto-detalle.component').then((module) => module.ProductoDetalleComponent) },
      { path: 'maestros', loadComponent: () => import('./pages/public/maestros/maestros.component').then((module) => module.MaestrosComponent) },
      { path: 'ferreterias', loadComponent: () => import('./pages/public/ferreterias/ferreterias.component').then((module) => module.FerreteriasComponent) },
      { path: 'contacto', loadComponent: () => import('./pages/public/contacto/contacto.component').then((module) => module.ContactoComponent) },
      { path: 'terminos-condiciones', loadComponent: () => import('./pages/public/terminos/terminos.component').then((module) => module.TerminosComponent) },
      { path: 'privacidad', loadComponent: () => import('./pages/public/privacidad/privacidad.component').then((module) => module.PrivacidadComponent) },
      { path: 'propiedad-intelectual', loadComponent: () => import('./pages/public/propiedad-intelectual/propiedad-intelectual.component').then((module) => module.PropiedadIntelectualComponent) },
      { path: 'desuscribir', loadComponent: () => import('./pages/public/unsubscribe/unsubscribe.component').then((module) => module.UnsubscribeComponent) },
      { path: 'reportar-precio', loadComponent: () => import('./pages/public/price-report/price-report.component').then((module) => module.PriceReportComponent) },
      { path: 'preguntas-frecuentes', loadComponent: () => import('./pages/public/preguntas-frecuentes/preguntas-frecuentes.component').then((module) => module.PreguntasFrecuentesComponent) }
    ]
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/auth/login/login.component').then((module) => module.LoginComponent)
  },
  {
    path: 'registro',
    loadComponent: () => import('./pages/auth/register/register.component').then((module) => module.RegisterComponent)
  },
  {
    path: 'recuperar-clave',
    loadComponent: () => import('./pages/auth/forgot-password/forgot-password.component').then((module) => module.ForgotPasswordComponent)
  },
  {
    path: 'auth',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'cuenta/privacidad-datos',
    loadComponent: () => import('./pages/privacy-center/privacy-center.component').then((module) => module.PrivacyCenterComponent),
    canActivate: [authGuard]
  },
  {
    path: 'cuenta/cambiar-contrasena',
    loadComponent: () => import('./pages/auth/change-password/change-password.component').then((module) => module.ChangePasswordComponent),
    canActivate: [authGuard]
  },
  {
    path: 'cuenta/contrato-ferreteria',
    loadComponent: () => import('./pages/store-agreement/store-agreement.component').then((module) => module.StoreAgreementComponent),
    canActivate: [authGuard, legalAcceptanceGuard, roleGuard],
    data: { role: 'ferreteria' }
  },
  {
    path: 'dashboard/ferreteria',
    loadComponent: () => import('./pages/dashboard-ferreteria/dashboard-ferreteria.component').then((module) => module.DashboardFerreteriaComponent),
    canActivate: [authGuard, legalAcceptanceGuard, roleGuard],
    data: { role: 'ferreteria' }
  },
  {
    path: 'dashboard/admin',
    redirectTo: 'dashboard/admin/validaciones',
    pathMatch: 'full'
  },
  {
    path: 'dashboard/admin/validaciones',
    loadComponent: () => import('./pages/dashboard-admin-validaciones/dashboard-admin-validaciones.component').then((module) => module.DashboardAdminValidacionesComponent),
    canActivate: [authGuard, legalAcceptanceGuard, roleGuard],
    data: { role: 'admin' }
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found.component').then(m => m.NotFoundComponent)
  }
];
