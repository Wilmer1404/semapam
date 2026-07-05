import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-status-chip',
  templateUrl: './status-chip.component.html',
  styleUrls: ['./status-chip.component.scss']
})
export class StatusChipComponent {
  @Input() label = 'Activo';
  @Input() tone: 'success' | 'warning' | 'danger' | 'primary' = 'primary';
}
