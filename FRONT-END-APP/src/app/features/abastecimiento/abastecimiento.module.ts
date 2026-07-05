import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { AbastecimientoPage } from './abastecimiento.page';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: AbastecimientoPage }];
@NgModule({ declarations:[AbastecimientoPage], imports:[CommonModule, IonicModule, FormsModule, RouterModule.forChild(routes), SharedModule] })
export class AbastecimientoModule {}
