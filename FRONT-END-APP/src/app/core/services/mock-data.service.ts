import { Injectable } from '@angular/core';
import { Ticket } from '../models/models';

@Injectable({ providedIn: 'root' })
export class MockDataService {
  tickets: Ticket[] = [
    { id: 'TK-001245', customer: '71931714', zone: 'San Carlos', amount: 15, status: 'SYNCED', date: '2026-04-05 08:10' },
    { id: 'TK-001246', customer: '70111222', zone: 'Nueva Esperanza', amount: 20, status: 'PENDING', date: '2026-04-05 08:32' }
  ];
}
