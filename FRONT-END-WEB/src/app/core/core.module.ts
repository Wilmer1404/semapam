import { NgModule, Optional, SkipSelf } from '@angular/core';
import { SharedModule } from '../shared/shared.module';
import { RouterModule } from '@angular/router';
import { AdminLayoutComponent } from './layouts/admin-layout/admin-layout.component';
import { AuthLayoutComponent } from './layouts/auth-layout/auth-layout.component';
import { TopbarComponent } from './layouts/topbar/topbar.component';
import { BreadcrumbsComponent } from './layouts/breadcrumbs/breadcrumbs.component';

@NgModule({declarations:[AdminLayoutComponent,AuthLayoutComponent,TopbarComponent,BreadcrumbsComponent],imports:[SharedModule,RouterModule],exports:[AdminLayoutComponent,AuthLayoutComponent]})
export class CoreModule { constructor(@Optional() @SkipSelf() parent:CoreModule|null){ if(parent) throw new Error('CoreModule ya fue cargado'); } }
