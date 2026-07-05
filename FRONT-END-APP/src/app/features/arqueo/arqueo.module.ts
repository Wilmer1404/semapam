import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { ArqueoPage } from './arqueo.page';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: ArqueoPage }];
@NgModule({ declarations:[ArqueoPage], imports:[CommonModule, FormsModule, IonicModule, RouterModule.forChild(routes), SharedModule] })
export class ArqueoModule {}
