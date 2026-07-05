import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ArqueoDaily, ArqueoItem, Ticket } from '../models/models';
import { ApiResponse } from '../../shared/interfaces/api-response.interface';
import { APP_CONSTANTS } from '../../shared/constants/app.constants';
import { ArqueoApiData, ArqueoLocalCache } from '../../shared/interfaces/backend.interface';
import { getLocalDateKey } from '../../shared/utils/date.utils';
import { ApiConfigService } from './api-config.service';
import { ConnectivityService } from './connectivity.service';
import { LocalStorageService } from './local-storage.service';
import { PrinterService } from './printer.service';
import { TicketsService } from './tickets.service';

@Injectable({ providedIn: 'root' })
export class ArqueoService {
  constructor(
    private readonly http: HttpClient,
    private readonly apiConfig: ApiConfigService,
    private readonly connectivity: ConnectivityService,
    private readonly storage: LocalStorageService,
    private readonly printer: PrinterService,
    private readonly ticketsService: TicketsService
  ) {}

  async getDailyArqueo(date?: string): Promise<ArqueoDaily> {
    const targetDate = this.toDateKey(date);

    if (this.connectivity.isOnline()) {
      try {
        const today = this.toDateKey();
        const arqueoPath = targetDate === today ? '/arqueo/daily' : `/arqueo/daily?date=${encodeURIComponent(targetDate)}`;
        const response = await this.getWithFallback<ArqueoApiData>(arqueoPath);

        if (response.status) {
          const data = await this.resolveArqueoData(targetDate, response.data);
          await this.persistArqueoByDate(targetDate, data);

          return data;
        }
      } catch {
        // Falls back to local cache below.
      }
    }

    const cached = await this.storage.get<ArqueoLocalCache>(APP_CONSTANTS.storageKeys.arqueoDaily);
    const fromCache = cached?.byDate?.[targetDate] ?? (cached?.data?.date === targetDate ? cached.data : undefined);
    if (fromCache) {
      return fromCache;
    }

    return this.buildLocalArqueo(targetDate);
  }

  async printDailyArqueo(arqueo: ArqueoDaily): Promise<void> {
    await this.printer.printArqueo(arqueo);
  }

  private async buildLocalArqueo(date: string): Promise<ArqueoDaily> {
    return this.buildArqueoFromTickets(date);
  }

  private async resolveArqueoData(date: string, raw?: ArqueoApiData): Promise<ArqueoDaily> {
    const normalized = this.normalizeArqueo(raw, date);
    if ((normalized.items?.length ?? 0) > 0) {
      return normalized;
    }

    return this.buildArqueoFromTickets(date, normalized);
  }

  private async buildArqueoFromTickets(date: string, raw?: ArqueoApiData): Promise<ArqueoDaily> {
    const tickets = await this.ticketsService.getTickets(date);
    const items = this.mapDetailItemsFromTickets(tickets);
    const totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
    const normalized = this.normalizeArqueo(raw, date);

    return {
      date,
      totalTickets: items.length || normalized.totalTickets,
      totalAmount: items.length ? totalAmount : normalized.totalAmount,
      items: items.length ? items : (normalized.items ?? []),
      syncedAt: normalized.syncedAt
    };
  }

  private normalizeArqueo(raw: ArqueoApiData | undefined, fallbackDate: string): ArqueoDaily {
    const date = this.toDateKey(raw?.fecha ?? raw?.date ?? fallbackDate);
    const rawItems = raw?.items_detail ?? raw?.itemsDetail ?? raw?.items ?? [];
    const items = rawItems
      .map((item): ArqueoItem => ({
        customerName: String(item.receiver_name ?? item.received_by ?? item.customer ?? '').trim(),
        productName: String(item.producto ?? item.productName ?? 'AGUA'),
        tickets: Number(item.total_tickets ?? item.tickets ?? 1),
        cubos: Number(item.total_cubos ?? item.quantity ?? item.liters ?? item.cubos ?? 0),
        amount: Number(item.total_amount ?? item.total ?? item.amount ?? 0)
      }))
      .filter((item) => item.productName.trim().length > 0);

    const totalTicketsFromItems = items.reduce((sum, item) => sum + item.tickets, 0);
    const totalAmountFromItems = items.reduce((sum, item) => sum + item.amount, 0);
    const totalTickets = Number(raw?.total_registros ?? raw?.totalTickets ?? totalTicketsFromItems);
    const totalAmount = Number(raw?.total_monto ?? raw?.totalAmount ?? totalAmountFromItems);

    return {
      date,
      totalTickets,
      totalAmount,
      items,
      syncedAt: new Date().toISOString()
    };
  }

  private mapDetailItemsFromTickets(tickets: Ticket[]): ArqueoItem[] {
    return tickets.map((ticket) => ({
      customerName: ticket.customer,
      productName: (ticket.productName ?? 'Agua').trim() || 'Agua',
      tickets: 1,
      cubos: Number(ticket.liters ?? 0),
      amount: Number(ticket.amount ?? 0)
    }));
  }

  private async persistArqueoByDate(date: string, data: ArqueoDaily): Promise<void> {
    const current = (await this.storage.get<ArqueoLocalCache>(APP_CONSTANTS.storageKeys.arqueoDaily)) ?? {};
    const byDate = {
      ...(current.byDate ?? {}),
      [date]: data
    };

    await this.storage.set<ArqueoLocalCache>(APP_CONSTANTS.storageKeys.arqueoDaily, {
      data,
      byDate,
      updatedAt: new Date().toISOString()
    });
  }

  private toDateKey(value?: string): string {
    if (!value || value.trim().length < 10) {
      return getLocalDateKey();
    }
    return value.slice(0, 10);
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
}
