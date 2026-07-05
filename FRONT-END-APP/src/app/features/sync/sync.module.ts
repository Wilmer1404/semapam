import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { SyncPage } from './sync.page';
import { SharedModule } from '../../shared/shared.module';

const routes: Routes = [{ path: '', component: SyncPage }];
@NgModule({ declarations:[SyncPage], imports:[CommonModule, IonicModule, RouterModule.forChild(routes), SharedModule] })
export class SyncModule {}
