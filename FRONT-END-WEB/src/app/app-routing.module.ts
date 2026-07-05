import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { AuthGuard } from './core/guards/auth.guard';
import { AdminLayoutComponent } from './core/layouts/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './core/layouts/auth-layout/auth-layout.component';

const routes: Routes = [
  { path:'', redirectTo:'auth/login', pathMatch:'full' },
  { path:'auth', component: AuthLayoutComponent, loadChildren:()=>import('./features/auth/auth.module').then(m=>m.AuthModule) },
  { path:'', component: AdminLayoutComponent, canActivate:[AuthGuard], children:[
    { path:'', redirectTo:'dashboard', pathMatch:'full' },
    { path:'dashboard', loadChildren:()=>import('./features/dashboard/dashboard.module').then(m=>m.DashboardModule) },
    { path:'usuarios', loadChildren:()=>import('./features/usuarios/usuarios.module').then(m=>m.UsuariosModule) },
    { path:'productos', loadChildren:()=>import('./features/productos/productos.module').then(m=>m.ProductosModule) },
    { path:'zonas', loadChildren:()=>import('./features/zonas/zonas.module').then(m=>m.ZonasModule) },
    { path:'abastecimientos', loadChildren:()=>import('./features/abastecimientos/abastecimientos.module').then(m=>m.AbastecimientosModule) },
    { path:'tickets', loadChildren:()=>import('./features/tickets/tickets.module').then(m=>m.TicketsModule) },
    { path:'arqueo', loadChildren:()=>import('./features/arqueo/arqueo.module').then(m=>m.ArqueoModule) },
    { path:'reportes', loadChildren:()=>import('./features/reportes/reportes.module').then(m=>m.ReportesModule) },
    { path:'configuracion', loadChildren:()=>import('./features/configuracion/configuracion.module').then(m=>m.ConfiguracionModule) }
  ]},
  { path:'**', redirectTo:'auth/login' }
];
@NgModule({imports:[RouterModule.forRoot(routes)],exports:[RouterModule]}) export class AppRoutingModule {}
