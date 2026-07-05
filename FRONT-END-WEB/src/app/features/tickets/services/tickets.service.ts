import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { ApiBaseService } from '@core/services/api-base.service';
import {
  Ticket,
  TicketDetail,
  TicketsListData,
  TicketsListQuery,
  TicketStatus
} from '@shared/models/ticket.model';

@Injectable()
export class TicketsService extends ApiBaseService {
  constructor(http: HttpClient) { super(http); }

  list(query: TicketsListQuery) {
    return this.get<TicketsListData>('/tickets', query).pipe(
      map((response) => {
        const rawData = response.data as unknown;

        const isPaginatedShape = !!rawData && !Array.isArray(rawData) && typeof rawData === 'object' && 'items' in rawData;
        const rawItems = isPaginatedShape
          ? ((rawData as { items?: unknown[] }).items || [])
          : (Array.isArray(rawData) ? rawData : []);

        const normalizedItems = rawItems.map((item) => this.normalizeItem(item as TicketDetail));
        const rawTotal = isPaginatedShape
          ? Number((rawData as { pagination?: { total?: number } }).pagination?.total || response.total_rows || normalizedItems.length)
          : Number(response.total_rows || normalizedItems.length);

        return {
          ...response,
          data: {
            items: normalizedItems,
            pagination: {
              offset: isPaginatedShape
                ? Number((rawData as { pagination?: { offset?: number } }).pagination?.offset || query.offset || 0)
                : Number(query.offset || 0),
              limit: isPaginatedShape
                ? Number((rawData as { pagination?: { limit?: number } }).pagination?.limit || query.limit || normalizedItems.length)
                : Number(query.limit || normalizedItems.length),
              total: rawTotal,
              has_more: isPaginatedShape
                ? Boolean((rawData as { pagination?: { has_more?: boolean } }).pagination?.has_more)
                : (Number(query.offset || 0) + normalizedItems.length) < rawTotal
            }
          }
        };
      })
    );
  }

  detail(id: number) {
    return this.get<TicketDetail>(`/tickets/${id}`).pipe(
      map((response) => ({
        ...response,
        data: this.normalizeItem(response.data)
      }))
    );
  }

  reprint(id: number) { return this.post<void>(`/tickets/${id}/reprint`); }

  private normalizeItem(item: TicketDetail): TicketDetail {
    const raw = item as TicketDetail & {
      idLocal?: string;
      idlocal?: string;
      localId?: string;
      abastecimiento_codigo?: string;
      ticket_code?: string;
      fecha_emision?: string;
      date?: string;
      producto?: string;
      zone?: string;
      operator?: string;
      driver_name?: string;
      total?: number | string;
      liters?: number | string;
      received_by?: string;
      customer?: string;
    };

    const rawStatus = String(raw?.status || 'PENDING').toUpperCase();
    const statusMap: Record<string, TicketStatus> = {
      PRINTED: 'SYNCED',
      FAILED: 'ERROR',
      ERROR: 'ERROR',
      SYNCED: 'SYNCED',
      PENDING: 'PENDING'
    };

    return {
      ...raw,
      local_id: raw.local_id || raw.idLocal || raw.idlocal || raw.localId || raw.abastecimiento_codigo,
      ticket_number: raw.ticket_number || raw.ticket_code,
      printed_at: raw.printed_at || raw.fecha_emision || raw.date,
      product_name: raw.product_name || raw.producto,
      zone_name: raw.zone_name || raw.zone,
      full_name: raw.full_name || raw.operator || raw.driver_name,
      receiver_name: raw.receiver_name || raw.customer || raw.received_by,
      amount: Number(raw?.amount ?? raw?.total ?? 0),
      quantity: raw?.quantity == null ? (raw?.liters == null ? undefined : Number(raw.liters)) : Number(raw.quantity),
      status: statusMap[rawStatus] || 'PENDING'
    };
  }
}
