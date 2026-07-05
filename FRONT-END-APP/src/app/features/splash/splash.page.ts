import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { SyncService } from '../../core/services/sync.service';
import { TicketsService } from '../../core/services/tickets.service';

@Component({
  template: `
    <ion-content [fullscreen]="true">
      <div class="page-shell" style="display:flex; min-height:100%; align-items:center; justify-content:center;">
        <div class="glass-card section-card" style="width:100%; max-width:420px; text-align:center;">
          <img src="assets/logo-semapam.png" alt="Semapam" style="width:120px; height:auto; margin:8px auto 14px; display:block;" />
          <p class="eyebrow">SEMAPAM</p>
          <h1 class="page-title" style="margin-bottom:10px;">Inicializando</h1>
          <p class="page-subtitle" style="margin-bottom:14px;">{{ progressMessage }}</p>
          <ion-progress-bar [value]="progress"></ion-progress-bar>
          <p class="ticket-meta" style="margin-top:10px;">{{ progressPercent }}%</p>
        </div>
      </div>
    </ion-content>
  `
})
export class SplashPage {
  progress = 0;
  progressMessage = 'Validando sesión y disponibilidad local.';

  get progressPercent(): number {
    return Math.round(this.progress * 100);
  }

  constructor(
    private readonly auth: AuthService,
    private readonly syncService: SyncService,
    private readonly ticketsService: TicketsService,
    private readonly router: Router
  ) {}

  async ionViewDidEnter(): Promise<void> {
    this.progress = 0.1;
    this.progressMessage = 'Validando sesión local...';

    if (!this.auth.hasSession()) {
      this.progress = 1;
      await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
      return;
    }

    this.progress = 0.3;
    this.progressMessage = 'Validando sesión con servidor...';
    const user = await this.auth.me();
    if (user) {
      this.progress = 0.55;
      this.progressMessage = 'Descargando catálogos...';
      await this.syncService.downloadCatalogs().catch(() => undefined);

      this.progress = 0.8;
      this.progressMessage = 'Actualizando tickets locales...';
      await this.ticketsService.getTickets().catch(() => undefined);

      this.progress = 1;
      this.progressMessage = 'Listo. Ingresando...';
      await this.router.navigateByUrl('/tabs/sync', { replaceUrl: true });
      return;
    }

    this.progress = 1;
    await this.auth.clearSession();
    await this.router.navigateByUrl('/auth/login', { replaceUrl: true });
  }
}
