import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { SplashPage } from './splash.page';

const routes: Routes = [{ path: '', component: SplashPage }];

@NgModule({
  declarations: [SplashPage],
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)]
})
export class SplashModule {}
