import { Component, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs/operators';

@Component({
  selector: 'app-breadcrumbs',
  template: `
    <div class="breadcrumbs" *ngIf="trail$ | async as trail">
      <span>Inicio</span>
      <mat-icon>chevron_right</mat-icon>
      <span>{{ trail }}</span>
    </div>
  `,
  styles: [`
    .breadcrumbs{display:flex;align-items:center;gap:8px;padding:16px 24px 0;color:var(--text-muted);font-size:13px}
    .breadcrumbs mat-icon{font-size:16px;height:16px;width:16px}
  `]
})
export class BreadcrumbsComponent {
  private readonly router = inject(Router);

  trail$ = this.router.events.pipe(
    filter((e): e is NavigationEnd => e instanceof NavigationEnd),
    startWith(null),
    map(() => this.router.url.split('/').filter(Boolean).join(' / ') || 'dashboard')
  );
}
