import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ConfiguracionPage } from './configuracion.page';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: ConfiguracionPage }];
@NgModule({ declarations:[ConfiguracionPage], imports:[CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes), SharedModule] })
export class ConfiguracionModule {}
