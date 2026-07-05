import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  syncOutline,
  waterOutline,
  receiptOutline,
  calculatorOutline,
  settingsOutline,
  checkmarkCircleOutline,
  hourglassOutline,
  calendarOutline
} from 'ionicons/icons';
import { AuthService } from './core/services/auth.service';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  template: '<ion-app><div class="environment-ribbon" *ngIf="environmentLabel">{{ environmentLabel }}</div><ion-router-outlet></ion-router-outlet></ion-app>'
})
export class AppComponent implements OnInit {
  readonly environmentLabel = environment.environmentLabel || '';

  constructor(private readonly auth: AuthService, private readonly router: Router) {
    addIcons({
      syncOutline,
      waterOutline,
      receiptOutline,
      calculatorOutline,
      settingsOutline,
      checkmarkCircleOutline,
      hourglassOutline,
      calendarOutline
    });
  }

  async ngOnInit(): Promise<void> {
    if (!this.auth.hasSession()) {
      return;
    }

    await this.router.navigateByUrl('/splash', { replaceUrl: true });
  }
}
