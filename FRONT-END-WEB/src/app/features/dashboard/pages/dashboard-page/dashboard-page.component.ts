import { Component, inject } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';

@Component({
  selector: 'app-dashboard-page',
  templateUrl: './dashboard-page.component.html',
  styleUrls: ['./dashboard-page.component.scss'],
  providers: [DashboardService]
})
export class DashboardPageComponent {
  private readonly svc = inject(DashboardService);
  summary$ = this.svc.getSummary();

  quickAccess = [
    { label: 'Usuarios', route: '/usuarios', icon: 'group', helper: 'Gestión de operadores, roles y estados.' },
    { label: 'Zonas', route: '/zonas', icon: 'map', helper: 'Polígonos, publicación y cobertura.' },
    { label: 'Tickets', route: '/tickets', icon: 'receipt_long', helper: 'Consulta y reimpresiones.' },
    { label: 'Arqueo', route: '/arqueo', icon: 'point_of_sale', helper: 'Resumen diario y conciliación.' }
  ];

  timeline = [
    { time: '07:15', title: 'Sincronización de catálogos completada', detail: '58 dispositivos recibieron productos y zonas vigentes.' },
    { time: '08:03', title: 'Abastecimiento registrado en Zona Centro', detail: 'Ticket TK-1001 impreso sin incidencias.' },
    { time: '10:46', title: 'Reimpresión autorizada', detail: 'Ticket TK-1042 reimpreso por supervisor de turno.' }
  ];

  zoneHealth = [
    { zone: 'Zona Centro', percent: 96 },
    { zone: 'Zona Norte', percent: 89 },
    { zone: 'Zona Sur', percent: 74 },
    { zone: 'Zona Rural', percent: 67 }
  ];

}
