import { Component } from '@angular/core';

@Component({
  selector: 'app-reportes-page',
  templateUrl: './reportes-page.component.html',
  styleUrls: ['./reportes-page.component.scss']
})
export class ReportesPageComponent {
  reportCards = [
    'Abastecimientos por fecha',
    'Abastecimientos por zona',
    'Tickets por operador',
    'Montos por producto',
    'Distribución por asignación de zona',
    'Tasa de reimpresión',
    'Offline vs online'
  ];
}
