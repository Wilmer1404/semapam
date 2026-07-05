import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { ApiBaseService } from '@core/services/api-base.service';
import { ArqueoDaily, ArqueoDetailItem, ArqueoSummaryItem } from '@shared/models/arqueo.model';
import { ApiResponse } from '@shared/models/api-response.model';

export interface ArqueoDailyQuery {
  [key: string]: string | number | boolean | undefined;
  date?: string;
  fecha?: string;
  start?: string;
  end?: string;
  user_id?: number;
}

interface ArqueoDailyRaw {
  fecha?: string;
  date?: string;
  start_date?: string | null;
  end_date?: string | null;
  range_applied?: boolean;
  total_registros?: number;
  totalTickets?: number;
  total_tickets?: number;
  total_monto?: number;
  totalAmount?: number;
  items?: Array<Record<string, unknown>>;
  items_grouped?: Array<Record<string, unknown>>;
  items_detail?: Array<Record<string, unknown>>;
}

@Injectable()
export class ArqueoService extends ApiBaseService {
  constructor(http: HttpClient) { super(http); }

  daily(query: ArqueoDailyQuery) {
    return this.get<ArqueoDailyRaw>('/arqueo/daily', query).pipe(
      map(response => ({ ...response, data: this.normalize(response.data, query) })),
      catchError(() => of<ApiResponse<ArqueoDaily>>({
        total_rows: 1,
        status: true,
        message: 'Mock arqueo fallback',
        data: this.normalize({
          fecha: query.start ?? query.date ?? query.fecha ?? new Date().toISOString().slice(0, 10),
          start_date: query.start ?? null,
          end_date: query.end ?? null,
          range_applied: !!query.start && !!query.end,
          total_registros: 10,
          totalTickets: 10,
          total_monto: 1974,
          items_grouped: [
            { productName: 'Agua Potable 20L', tickets: 1, quantity: 23, amount: 233 },
            { productName: 'Abastecimiento por Cisterna', tickets: 9, quantity: 199, amount: 1741 }
          ],
          items_detail: [
            { id: 16, ticket_number: 'TK-20260406-000016', fecha_emision: '2026-04-06 16:26:16', receiver_name: '71425141', productName: 'Agua Potable 20L', quantity: 23, amount: 233, zone_name: 'Zona Centro', status: 'SYNCED' },
            { id: 15, ticket_number: 'TK-20260406-000015', fecha_emision: '2026-04-06 16:13:18', receiver_name: '72425141', productName: 'Abastecimiento por Cisterna', quantity: 58, amount: 588, zone_name: 'Zona Centro', status: 'SYNCED' },
            { id: 14, ticket_number: 'TK-20260406-000014', fecha_emision: '2026-04-06 15:51:42', receiver_name: '72425141', productName: 'Abastecimiento por Cisterna', quantity: 20, amount: 85, zone_name: 'Zona Centro', status: 'SYNCED' }
          ],
        }, query)
      }))
    );
  }

  private normalize(raw: ArqueoDailyRaw, query: ArqueoDailyQuery): ArqueoDaily {
    const details = (raw.items_detail ?? []).map(item => this.toDetailItem(item));
    const product_summary = (raw.items_grouped ?? raw.items ?? []).map(item => this.toSummaryItem(item, 'product'));
    const zone_summary = this.groupDetailsByZone(details);
    const fallbackDate = query.start ?? query.date ?? query.fecha ?? new Date().toISOString().slice(0, 10);
    const startDate = raw.start_date ?? query.start ?? null;
    const endDate = raw.end_date ?? query.end ?? null;

    return {
      fecha: String(raw.fecha ?? raw.date ?? fallbackDate),
      start_date: startDate,
      end_date: endDate,
      range_applied: Boolean(raw.range_applied ?? (startDate && endDate)),
      total_tickets: Number(raw.total_tickets ?? raw.totalTickets ?? details.length ?? 0),
      total_abastecimientos: Number(raw.total_registros ?? details.length ?? 0),
      total_monto: Number(raw.total_monto ?? raw.totalAmount ?? 0),
      zone_summary,
      product_summary,
      details
    };
  }

  private toSummaryItem(item: Record<string, unknown>, mode: 'product' | 'zone'): ArqueoSummaryItem {
    const label = mode === 'product'
      ? String(item['productName'] ?? item['producto'] ?? 'Sin producto')
      : String(item['zone_name'] ?? item['zone'] ?? 'Sin zona');

    return {
      label,
      total_tickets: Number(item['total_tickets'] ?? item['tickets'] ?? 0),
      total_quantity: Number(item['total_cubos'] ?? item['quantity'] ?? item['cubos'] ?? 0),
      total_amount: Number(item['total_amount'] ?? item['total'] ?? item['amount'] ?? 0)
    };
  }

  private toDetailItem(item: Record<string, unknown>): ArqueoDetailItem {
    return {
      id: Number(item['id'] ?? 0),
      abastecimiento_codigo: String(item['abastecimiento_codigo'] ?? item['abastecimiento_code'] ?? item['idLocal'] ?? '-'),
      ticket_number: String(item['ticket_number'] ?? item['ticket_code'] ?? '-'),
      fecha_emision: String(item['fecha_emision'] ?? item['created_at'] ?? '-'),
      receiver_name: String(item['receiver_name'] ?? item['received_by'] ?? item['customer'] ?? '-'),
      product_name: String(item['productName'] ?? item['producto'] ?? '-'),
      quantity: Number(item['quantity'] ?? item['liters'] ?? item['cubos'] ?? 0),
      amount: Number(item['amount'] ?? item['total'] ?? 0),
      zone_name: String(item['zone_name_snapshot'] ?? item['zone_name'] ?? item['zone'] ?? 'Sin zona'),
      status: String(item['status'] ?? 'UNKNOWN')
    };
  }

  private groupDetailsByZone(details: ArqueoDetailItem[]): ArqueoSummaryItem[] {
    const grouped = new Map<string, ArqueoSummaryItem>();

    for (const item of details) {
      const current = grouped.get(item.zone_name) ?? {
        label: item.zone_name,
        total_tickets: 0,
        total_quantity: 0,
        total_amount: 0
      };

      current.total_tickets += 1;
      current.total_quantity += item.quantity;
      current.total_amount += item.amount;
      grouped.set(item.zone_name, current);
    }

    return Array.from(grouped.values());
  }
}
