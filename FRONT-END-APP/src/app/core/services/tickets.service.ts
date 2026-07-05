import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Abastecimiento, Ticket } from '../models/models';
import { ApiResponse } from '../../shared/interfaces/api-response.interface';
import { APP_CONSTANTS } from '../../shared/constants/app.constants';
import { TicketApiItem, TicketsLocalCache } from '../../shared/interfaces/backend.interface';
import { getLocalDateKey } from '../../shared/utils/date.utils';
import { ApiConfigService } from './api-config.service';
import { ConnectivityService } from './connectivity.service';
import { LocalStorageService } from './local-storage.service';
import { PrinterService } from './printer.service';

type TicketsApiPayload = TicketApiItem[] | { items?: TicketApiItem[] };

@Injectable({ providedIn: 'root' })
export class TicketsService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiConfig: ApiConfigService,
    private readonly connectivity: ConnectivityService,
    private readonly storage: LocalStorageService,
    private readonly printer: PrinterService
  ) {}

  async getTickets(date?: string): Promise<Ticket[]> {
    const targetDate = this.toDateKey(date);
    const today = this.todayKey();
    const localItems = await this.mapLocalAbastecimientosToTickets(targetDate, {
      includeSynced: !this.connectivity.isOnline()
    });

    if (this.connectivity.isOnline()) {
      try {
        const response = await this.getWithFallback<TicketsApiPayload>(this.buildTicketsPath(targetDate));

        if (response.status) {
          const ticketItems = this.extractTicketItems(response.data);
          const rawItems = ticketItems.map((item) => this.normalizeTicket(item));

          // Replace ticket ids with the original AB-... idLocal when the record
          // was created locally (match via idRemoto ↔ ticket.remoteId).
          const abastecimientos =
            (await this.storage.get<Abastecimiento[]>(APP_CONSTANTS.storageKeys.abastecimientos)) ?? [];
          const remoteToLocal = new Map<number, string>(
            abastecimientos
              .filter((a) => a.idRemoto != null)
              .map((a) => [a.idRemoto!, a.idLocal])
          );
          const items = rawItems.map((t) =>
            t.remoteId != null && remoteToLocal.has(t.remoteId)
              ? { ...t, id: remoteToLocal.get(t.remoteId)! }
              : t
          );

          const merged = this.mergeTickets(items, localItems);

          await this.storage.remove(APP_CONSTANTS.storageKeys.tickets);
          await this.storage.set<TicketsLocalCache>(APP_CONSTANTS.storageKeys.tickets, {
            items: merged,
            date: targetDate,
            updatedAt: new Date().toISOString()
          });
          return merged;
        }
      } catch {
        // Falls back to local.
      }
    }

    if (targetDate !== today) {
      throw new Error('Solo se puede buscar otra fecha si hay conexión a internet.');
    }

    const cached = await this.storage.get<TicketsLocalCache>(APP_CONSTANTS.storageKeys.tickets);
    const cachedItems = cached?.date === targetDate ? (cached.items ?? []) : [];
    if (cachedItems.length || localItems.length) {
      return this.mergeTickets(cachedItems, localItems);
    }

    return localItems;
  }

  async reprint(ticket: Ticket): Promise<void> {
    if (this.connectivity.isOnline() && ticket.remoteId) {
      try {
        await firstValueFrom(
          this.http.post<ApiResponse<unknown>>(
            this.apiConfig.getApiUrl(`/tickets/${ticket.remoteId}/reprint`),
            {}
          )
        );
      } catch {
        // Local print is still attempted if backend reprint callback fails.
      }
    }

    await this.printer.reprintTicket(ticket);
  }

  private normalizeTicket(item: TicketApiItem): Ticket {
    const statusRaw = (item.status ?? 'SYNCED').toUpperCase();
    const status = statusRaw === 'PENDING' || statusRaw === 'ERROR' ? statusRaw : 'SYNCED';

    return {
      id: item.abastecimiento_codigo ?? item.abastecimiento_code ?? item.idLocal ?? item.ticket_number ?? item.ticket_code ?? String(item.id),
      remoteId: typeof item.id === 'number' ? item.id : undefined,
      customer: item.receiver_name ?? item.customer ?? item.received_by ?? '-',
      zone: item.zone_name_snapshot ?? item.zone ?? item.zone_name ?? 'Sin zona',
      amount: Number(item.amount ?? item.total ?? 0),
      liters: Number(item.quantity ?? item.liters ?? 0),
      productName: item.producto ?? 'Agua',
      status,
      date: item.fecha_emision ?? item.created_at ?? item.date ?? new Date().toISOString()
    };
  }

  private extractTicketItems(payload: TicketsApiPayload | null | undefined): TicketApiItem[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (payload && Array.isArray(payload.items)) {
      return payload.items;
    }

    return [];
  }

  private async mapLocalAbastecimientosToTickets(
    date: string,
    options: { includeSynced: boolean }
  ): Promise<Ticket[]> {
    const abastecimientos =
      (await this.storage.get<Abastecimiento[]>(APP_CONSTANTS.storageKeys.abastecimientos)) ?? [];

    return abastecimientos
      .filter((item) => this.toDateKey(item.createdAt) === date)
      .filter((item) => options.includeSynced || item.estadoSincronizacion !== 'SYNCED')
      .map((item) => ({
        id: item.idLocal,
        remoteId: item.idRemoto,
        customer: item.recibidoPor,
        zone: item.zonaNombre,
        amount: item.importe,
        liters: item.cantidad,
        productName: item.productName ?? 'Agua',
        status: item.estadoSincronizacion,
        date: item.createdAt
      }));
  }

  private async getWithFallback<T>(path: string): Promise<ApiResponse<T>> {
    let lastError: unknown;
    for (const url of this.apiConfig.getApiUrls(path)) {
      try {
        return await firstValueFrom(this.http.get<ApiResponse<T>>(url));
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private mergeTickets(primary: Ticket[], local: Ticket[]): Ticket[] {
    const merged: Ticket[] = [];
    const seenLocalIds = new Set<string>();
    const seenRemoteIds = new Set<number>();

    for (const ticket of primary) {
      merged.push(ticket);
      seenLocalIds.add(ticket.id);
      if (ticket.remoteId != null) {
        seenRemoteIds.add(ticket.remoteId);
      }
    }

    const pendingFirst = [...local].sort((a, b) => {
      const rank = (status: Ticket['status']) => (status === 'PENDING' || status === 'ERROR' ? 0 : 1);
      const statusDiff = rank(a.status) - rank(b.status);
      if (statusDiff !== 0) {
        return statusDiff;
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    for (const localTicket of pendingFirst) {
      const duplicateByLocalId = seenLocalIds.has(localTicket.id);
      const duplicateByRemoteId = localTicket.remoteId != null && seenRemoteIds.has(localTicket.remoteId);

      if (duplicateByLocalId || duplicateByRemoteId) {
        continue;
      }

      merged.unshift(localTicket);
      seenLocalIds.add(localTicket.id);
      if (localTicket.remoteId != null) {
        seenRemoteIds.add(localTicket.remoteId);
      }
    }

    return merged;
  }

  private buildTicketsPath(date: string): string {
    if (date === this.todayKey()) {
      return '/tickets';
    }
    return `/tickets?date=${encodeURIComponent(date)}`;
  }

  private todayKey(): string {
    return getLocalDateKey();
  }

  private toDateKey(value?: string): string {
    if (!value || value.trim().length < 10) {
      return getLocalDateKey();
    }
    return value.slice(0, 10);
  }

}
