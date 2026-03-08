import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { PublicLayoutComponent } from './layouts/public-layout/public-layout.component';
import { ForgotPasswordComponent } from './pages/auth/forgot-password/forgot-password.component';
import { LoginComponent } from './pages/auth/login/login.component';
import { RegisterComponent } from './pages/auth/register/register.component';
import { DashboardFerreteriaComponent } from './pages/dashboard-ferreteria/dashboard-ferreteria.component';
import { DashboardAdminValidacionesComponent } from './pages/dashboard-admin-validaciones/dashboard-admin-validaciones.component';
import { DashboardMaestroComponent } from './pages/dashboard-maestro/dashboard-maestro.component';
import { HomeComponent } from './pages/home/home.component';
import { ProductoDetalleComponent } from './pages/producto-detalle/producto-detalle.component';
import { ProyectoDetalleComponent } from './pages/proyecto-detalle/proyecto-detalle.component';
import { ContactoComponent } from './pages/public/contacto/contacto.component';
import { FerreteriasComponent } from './pages/public/ferreterias/ferreterias.component';
import { MaestrosComponent } from './pages/public/maestros/maestros.component';
import { PreguntasFrecuentesComponent } from './pages/public/preguntas-frecuentes/preguntas-frecuentes.component';
import { PrivacidadComponent } from './pages/public/privacidad/privacidad.component';
import { TerminosComponent } from './pages/public/terminos/terminos.component';

export const routes: Routes = [
  {
    path: '',
    component: PublicLayoutComponent,
    children: [
      { path: '', component: HomeComponent },
      { path: 'maestros', component: MaestrosComponent },
      { path: 'ferreterias', component: FerreteriasComponent },
      { path: 'contacto', component: ContactoComponent },
      { path: 'terminos-condiciones', component: TerminosComponent },
      { path: 'privacidad', component: PrivacidadComponent },
      { path: 'preguntas-frecuentes', component: PreguntasFrecuentesComponent }
    ]
  },
  {
    path: 'login',
    component: LoginComponent
  },
  {
    path: 'registro',
    component: RegisterComponent
  },
  {
    path: 'recuperar-clave',
    component: ForgotPasswordComponent
  },
  {
    path: 'auth',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  {
    path: 'dashboard/maestro',
    component: DashboardMaestroComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'maestro' }
  },
  {
    path: 'dashboard/maestro/producto-detalle',
    component: ProductoDetalleComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'maestro' }
  },
  {
    path: 'dashboard/maestro/cotizaciones/nuevo',
    component: ProyectoDetalleComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'maestro' }
  },
  {
    path: 'dashboard/maestro/cotizaciones/:projectId',
    component: ProyectoDetalleComponent,
    canActivate: [authGuard, roleGuard],
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
  {
    path: 'dashboard/ferreteria',
    component: DashboardFerreteriaComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'ferreteria' }
  },
  {
    path: 'dashboard/admin',
    redirectTo: 'dashboard/admin/validaciones',
    pathMatch: 'full'
  },
  {
    path: 'dashboard/admin/validaciones',
    component: DashboardAdminValidacionesComponent,
    canActivate: [authGuard, roleGuard],
    data: { role: 'admin' }
  },
  {
    path: '**',
    redirectTo: ''
  }
];
