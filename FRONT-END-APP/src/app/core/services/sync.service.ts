import { Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import { Abastecimiento, Product, Zone } from '../models/models';
import { ApiResponse } from '../../shared/interfaces/api-response.interface';
import {
  CatalogsApiData,
  RawProduct,
  RawZone,
  SyncAbastecimientoPayload,
  SyncAbastecimientoResult
} from '../../shared/interfaces/backend.interface';
import { APP_CONSTANTS } from '../../shared/constants/app.constants';
import { ApiConfigService } from './api-config.service';
import { LocalStorageService } from './local-storage.service';
import { ConnectivityService } from './connectivity.service';

interface SyncSummary {
  total: number;
  synced: number;
  failed: number;
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly pendingCountSubject = new BehaviorSubject<number>(0);
  private readonly lastSyncAtSubject = new BehaviorSubject<string | null>(null);

  readonly pendingCount$ = this.pendingCountSubject.asObservable();
  readonly lastSyncAt$ = this.lastSyncAtSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly apiConfig: ApiConfigService,
    private readonly storage: LocalStorageService,
    private readonly connectivity: ConnectivityService
  ) {
    this.bootstrapState().catch(() => undefined);
  }

  async downloadCatalogs(): Promise<{ products: number; zones: number; from: 'remote' | 'local' }> {
    if (!this.connectivity.isOnline()) {
      const products = await this.getProducts();
      const zones = await this.getZones();
      return { products: products.length, zones: zones.length, from: 'local' };
    }

    try {
      const combined = await this.getWithFallback<CatalogsApiData>('/sync/catalogs');

      if (combined.status && combined.data) {
        const products = this.normalizeProducts(combined.data.products ?? []);
        const zones = this.normalizeZones(combined.data.zones ?? []);
        await this.persistCatalogs(products, zones);
        return { products: products.length, zones: zones.length, from: 'remote' };
      }
    } catch {
      // Falls back to individual endpoints below.
    }

    const [productsResponse, zonesResponse] = await Promise.all([
      this.getWithFallback<Product[]>('/catalogs/products'),
      this.getWithFallback<Zone[]>('/catalogs/zones')
    ]);

    const products = productsResponse.status ? this.normalizeProducts(productsResponse.data ?? []) : [];
    const zones = zonesResponse.status ? this.normalizeZones(zonesResponse.data ?? []) : [];
    await this.persistCatalogs(products, zones);

    return { products: products.length, zones: zones.length, from: 'remote' };
  }

  async syncPendingAbastecimientos(): Promise<SyncSummary> {
    const all = await this.getAllAbastecimientos();
    const queue = all.filter(
      (item) => item.estadoSincronizacion === 'PENDING' || item.estadoSincronizacion === 'ERROR'
    );

    if (!queue.length || !this.connectivity.isOnline()) {
      this.pendingCountSubject.next(queue.length);
      return { total: queue.length, synced: 0, failed: 0 };
    }

    const payload: SyncAbastecimientoPayload[] = queue.map((item) =>
      this.mapAbastecimientoPayload(item, 'SYNCED')
    );

    let synced = 0;
    let failed = 0;

    try {
      const batchResponse = await this.postWithFallback<SyncAbastecimientoResult[], { items: SyncAbastecimientoPayload[] }>(
        '/sync/abastecimientos',
        { items: payload }
      );

      if (batchResponse.status && Array.isArray(batchResponse.data)) {
        const responseById = new Map(
          batchResponse.data
            .map((result) => {
              const idLocal = result.id_local ?? result.idLocal;
              if (!idLocal) {
                return null;
              }
              return [idLocal, result] as const;
            })
            .filter((entry): entry is readonly [string, SyncAbastecimientoResult] => entry !== null)
        );

        for (const item of queue) {
          const remote = responseById.get(item.idLocal);
          if (remote) {
            item.estadoSincronizacion = 'SYNCED';
            item.idRemoto = remote.id_remoto ?? remote.remoteId ?? item.idRemoto;
            item.ultimoError = undefined;
            synced += 1;
          } else {
            item.estadoSincronizacion = 'ERROR';
            item.reintentos += 1;
            item.ultimoError = 'No se pudo sincronizar el registro';
            failed += 1;
          }
          item.updatedAt = new Date().toISOString();
        }
      } else {
        throw new Error('Batch rejected');
      }
    } catch (error) {
      const batchError = this.extractErrorMessage(error);
      for (const item of queue) {
        try {
          const response = await this.postWithFallback<{ id: number }, SyncAbastecimientoPayload>(
            '/abastecimientos',
            this.mapAbastecimientoBody(item)
          );

          if (response.status) {
            item.estadoSincronizacion = 'SYNCED';
            item.idRemoto = response.data?.id ?? item.idRemoto;
            item.ultimoError = undefined;
            synced += 1;
          } else {
            item.estadoSincronizacion = 'ERROR';
            item.reintentos += 1;
            item.ultimoError = response.message || 'Error de sincronización';
            failed += 1;
          }
        } catch (error) {
          item.estadoSincronizacion = 'ERROR';
          item.reintentos += 1;
          item.ultimoError = this.extractErrorMessage(error, batchError);
          failed += 1;
        }

        item.updatedAt = new Date().toISOString();
      }
    }

    await this.storage.set(APP_CONSTANTS.storageKeys.abastecimientos, all);
    await this.updateLastSync();
    this.pendingCountSubject.next(all.filter((item) => item.estadoSincronizacion !== 'SYNCED').length);

    return { total: queue.length, synced, failed };
  }

  async getProducts(): Promise<Product[]> {
    const products = (await this.storage.get<Array<Product | RawProduct>>(APP_CONSTANTS.storageKeys.products)) ?? [];
    return this.normalizeProducts(products);
  }

  async getZones(): Promise<Zone[]> {
    const zones = (await this.storage.get<Array<Zone | RawZone>>(APP_CONSTANTS.storageKeys.zones)) ?? [];
    return this.normalizeZones(zones);
  }

  async getPendingCount(): Promise<number> {
    const items = await this.getAllAbastecimientos();
    return items.filter((item) => item.estadoSincronizacion !== 'SYNCED').length;
  }

  async refreshPendingCount(): Promise<void> {
    this.pendingCountSubject.next(await this.getPendingCount());
  }

  async syncAbastecimientoByLocalId(idLocal: string): Promise<Abastecimiento | null> {
    const all = await this.getAllAbastecimientos();
    const item = all.find((entry) => entry.idLocal === idLocal);
    if (!item) {
      return null;
    }

    if (!this.connectivity.isOnline()) {
      this.pendingCountSubject.next(all.filter((entry) => entry.estadoSincronizacion !== 'SYNCED').length);
      return item;
    }

    try {
      const response = await this.postWithFallback<{ id: number }, SyncAbastecimientoPayload>(
        '/abastecimientos',
        this.mapAbastecimientoBody(item)
      );

      if (response.status) {
        item.estadoSincronizacion = 'SYNCED';
        item.idRemoto = response.data?.id ?? item.idRemoto;
        item.ultimoError = undefined;
      } else {
        item.estadoSincronizacion = 'ERROR';
        item.reintentos += 1;
        item.ultimoError = response.message || 'Error de sincronización';
      }
    } catch (error) {
      item.estadoSincronizacion = 'ERROR';
      item.reintentos += 1;
      item.ultimoError = this.extractErrorMessage(error);
    }

    item.updatedAt = new Date().toISOString();
    await this.storage.set(APP_CONSTANTS.storageKeys.abastecimientos, all);
    await this.updateLastSync();
    this.pendingCountSubject.next(all.filter((entry) => entry.estadoSincronizacion !== 'SYNCED').length);
    return item;
  }

  private async getAllAbastecimientos(): Promise<Abastecimiento[]> {
    return (await this.storage.get<Abastecimiento[]>(APP_CONSTANTS.storageKeys.abastecimientos)) ?? [];
  }

  private mapAbastecimientoBody(item: Abastecimiento): SyncAbastecimientoPayload {
    return this.mapAbastecimientoPayload(item, 'SYNCED');
  }

  private mapAbastecimientoPayload(
    item: Abastecimiento,
    syncStatus: SyncAbastecimientoPayload['estadoSincronizacion'] = item.estadoSincronizacion
  ): SyncAbastecimientoPayload {
    const latitud = typeof item.ubicacion.lat === 'number' ? item.ubicacion.lat : 0;
    const longitud = typeof item.ubicacion.lng === 'number' ? item.ubicacion.lng : 0;
    const precisionGps = typeof item.ubicacion.accuracy === 'number' ? item.ubicacion.accuracy : 0;
    const fechaGps = item.ubicacion.capturedAt || item.updatedAt || item.createdAt;

    return {
      idLocal: item.idLocal,
      producto: item.productId,
      cantidad: item.cantidad,
      recibidoPor: item.recibidoPor,
      zonaNombreSnapshot: item.zonaNombre,
      metodoZona: item.metodoZona,
      latitud,
      longitud,
      precisionGps,
      fechaGps,
      importe: item.importe,
      zonaId: item.zonaId,
      conductor: item.conductor,
      horaInicio: item.horaInicio,
      horaFin: item.horaFin,
      estadoSincronizacion: syncStatus,
      estadoImpresion: item.estadoImpresion,
      creadoOffline: item.creadoOffline
    };
  }

  private async persistCatalogs(products: Product[], zones: Zone[]): Promise<void> {
    await this.storage.remove(APP_CONSTANTS.storageKeys.products);
    await this.storage.remove(APP_CONSTANTS.storageKeys.zones);
    await this.storage.set(APP_CONSTANTS.storageKeys.products, products);
    await this.storage.set(APP_CONSTANTS.storageKeys.zones, zones);
    await this.updateLastSync();
  }

  private normalizeProducts(items: Array<Product | RawProduct>): Product[] {
    return items
      .map((item) => this.normalizeProduct(item))
      .filter((item): item is Product => item !== null);
  }

  private normalizeZones(items: Array<Zone | RawZone>): Zone[] {
    return items
      .map((item) => this.normalizeZone(item))
      .filter((item): item is Zone => item !== null);
  }

  private normalizeProduct(item: Product | RawProduct | null | undefined): Product | null {
    if (!item || typeof item.id !== 'number') {
      return null;
    }

    const rawItem = item as any;

    const normalizedActive =
      item.active ?? (rawItem['is_active'] === 1 || rawItem['is_active'] === true || rawItem['estado'] === true);

    return {
      id: item.id,
      code: item.code ?? `PROD-${item.id}`,
      name: item.name ?? rawItem['nombre'] ?? 'Producto',
      price: item.price ?? rawItem['unit_price'] ?? rawItem['precio'] ?? 0,
      active: normalizedActive
    };
  }

  private normalizeZone(item: Zone | RawZone | null | undefined): Zone | null {
    if (!item || typeof item.id !== 'number') {
      return null;
    }

    const rawItem = item as any;
    const polygon = this.parsePolygonPayload(
      item.polygon ?? rawItem['polygon'] ?? rawItem['geometry'] ?? rawItem['geom'] ?? rawItem['geojson']
    );

    if (!polygon) {
      console.warn('[SYNC] Zone skipped: invalid polygon payload', {
        id: item.id,
        name: item.name ?? rawItem['nombre'] ?? 'Zona',
        payloadType: typeof (item as any).polygon
      });
      return null;
    }

    return {
      id: item.id,
      code: item.code ?? `ZONA-${item.id}`,
      name: item.name ?? rawItem['nombre'] ?? 'Zona',
      polygon
    };
  }

  private parsePolygonPayload(payload: unknown): Zone['polygon'] | null {
    let candidate: unknown = payload;

    if (typeof candidate === 'string') {
      try {
        candidate = JSON.parse(candidate);
      } catch {
        return null;
      }
    }

    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    const featureLike = candidate as { type?: unknown; geometry?: unknown; polygon?: unknown };
    if (featureLike.type === 'Feature' && featureLike.geometry) {
      candidate = featureLike.geometry;
    } else if (featureLike.polygon) {
      candidate = featureLike.polygon;
    }

    if (!candidate || typeof candidate !== 'object') {
      return null;
    }

    const geometry = candidate as { type?: unknown; coordinates?: unknown };
    if (typeof geometry.type !== 'string' || !Array.isArray(geometry.coordinates)) {
      return null;
    }

    const type = geometry.type.toLowerCase();
    if (type !== 'polygon' && type !== 'multipolygon') {
      return null;
    }

    return {
      type: type === 'polygon' ? 'Polygon' : 'MultiPolygon',
      coordinates: geometry.coordinates as number[][][] | number[][][][]
    };
  }

  private async updateLastSync(): Promise<void> {
    const stamp = new Date().toISOString();
    await this.storage.set(APP_CONSTANTS.storageKeys.lastSyncAt, stamp);
    this.lastSyncAtSubject.next(stamp);
  }

  private async bootstrapState(): Promise<void> {
    const pending = await this.getPendingCount();
    const lastSyncAt = await this.storage.get<string>(APP_CONSTANTS.storageKeys.lastSyncAt);
    this.pendingCountSubject.next(pending);
    this.lastSyncAtSubject.next(lastSyncAt);
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

  private async postWithFallback<TResponse, TBody>(path: string, body: TBody): Promise<ApiResponse<TResponse>> {
    let lastError: unknown;
    for (const url of this.apiConfig.getApiUrls(path)) {
      try {
        return await firstValueFrom(this.http.post<ApiResponse<TResponse>>(url, body));
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError;
  }

  private extractErrorMessage(error: unknown, fallback = 'Sin conexión o timeout'): string {
    if (error instanceof HttpErrorResponse) {
      const backendError = error.error as
        | { message?: string; errors?: Record<string, string[] | string>; data?: Record<string, string[] | string> }
        | string
        | null;

      if (typeof backendError === 'string' && backendError.trim()) {
        return backendError;
      }

      if (backendError && typeof backendError === 'object') {
        if (backendError.message?.trim()) {
          return backendError.message;
        }

        if (backendError.errors && typeof backendError.errors === 'object') {
          const messages = Object.values(backendError.errors)
          .flatMap((value) => (Array.isArray(value) ? value : [value]))
          .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

          if (messages.length) {
            return messages.join(' | ');
          }
        }

        if (backendError.data && typeof backendError.data === 'object') {
          const messages = Object.values(backendError.data)
            .flatMap((value) => (Array.isArray(value) ? value : [value]))
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0);

          if (messages.length) {
            return messages.join(' | ');
          }
        }
      }

      return error.message || fallback;
    }

    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return fallback;
  }
}
