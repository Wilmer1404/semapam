import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [{
  path: '', component: TabsPage, children: [
    { path: 'sync', loadChildren: () => import('../features/sync/sync.module').then(m => m.SyncModule) },
    { path: 'abastecimiento', loadChildren: () => import('../features/abastecimiento/abastecimiento.module').then(m => m.AbastecimientoModule) },
    { path: 'tickets', loadChildren: () => import('../features/tickets/tickets.module').then(m => m.TicketsModule) },
    { path: 'arqueo', loadChildren: () => import('../features/arqueo/arqueo.module').then(m => m.ArqueoModule) },
    { path: 'configuracion', loadChildren: () => import('../features/configuracion/configuracion.module').then(m => m.ConfiguracionModule) },
    { path: '', redirectTo: 'sync', pathMatch: 'full' }
  ]
}];

@NgModule({ declarations:[TabsPage], imports:[CommonModule, IonicModule, RouterModule.forChild(routes)] })
export class TabsModule {}
