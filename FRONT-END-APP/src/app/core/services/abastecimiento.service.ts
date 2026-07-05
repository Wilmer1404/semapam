import { Injectable } from '@angular/core';
import { Abastecimiento, LocationPoint, Product, Zone } from '../models/models';
import { APP_CONSTANTS } from '../../shared/constants/app.constants';
import { LocalStorageService } from './local-storage.service';
import { SyncService } from './sync.service';
import { ConnectivityService } from './connectivity.service';
import { GeolocationService } from './geolocation.service';
import { ZoneMatcherService } from './zone-matcher.service';
import { PrinterService } from './printer.service';
import { AuthService } from './auth.service';

export interface SaveAbastecimientoInput {
  cantidad: number;
  recibidoPor: string;
  importe: number;
  productId?: number;
  productName?: string;
  zonaManualId?: number;
  zonaManualNombre?: string;
}

export interface ZoneResolution {
  location: LocationPoint | null;
  zone: Zone | null;
  source: 'gps' | 'manual' | 'unresolved';
  reason?: 'matched' | 'no-zones' | 'gps-error' | 'no-polygon-match' | 'manual-selection';
  details?: string;
}

@Injectable({ providedIn: 'root' })
export class AbastecimientoService {
  private activeStart?: string;

  constructor(
    private readonly storage: LocalStorageService,
    private readonly syncService: SyncService,
    private readonly connectivity: ConnectivityService,
    private readonly geolocation: GeolocationService,
    private readonly zoneMatcher: ZoneMatcherService,
    private readonly printer: PrinterService,
    private readonly authService: AuthService
  ) {}

  iniciarOperacion(): void {
    this.activeStart = new Date().toISOString();
  }

  terminarOperacion(): void {
    if (!this.activeStart) {
      this.activeStart = new Date().toISOString();
    }
  }

  async captureGpsAndMatchZone(zonaManualNombre?: string): Promise<ZoneResolution> {
    const fallbackSource = zonaManualNombre?.trim() ? 'manual' : 'unresolved';

    const zones = await this.syncService.getZones();
    console.log('[ABASTECIMIENTO] Local zones loaded for matching', {
      total: zones.length,
      zones: zones.map((zone) => ({ id: zone.id, code: zone.code, name: zone.name, type: zone.polygon?.type }))
    });

    if (!zones.length) {
      console.warn('[ABASTECIMIENTO] Automatic match skipped: no zones in local cache. Run Sync first.');
      return {
        location: null,
        zone: null,
        source: fallbackSource,
        reason: 'no-zones',
        details: 'No hay zonas en caché local'
      };
    }

    try {
      const location = await this.geolocation.captureCurrentPosition();
      const zone = this.zoneMatcher.matchZone(location, zones);
      if (zone) {
        console.log('[ABASTECIMIENTO] Automatic zone match resolved', {
          source: 'gps',
          location,
          zone
        });
        return { location, zone, source: 'gps', reason: 'matched' };
      }

      console.warn('[ABASTECIMIENTO] No automatic zone match found', {
        source: fallbackSource,
        location,
        zonaManualNombre: zonaManualNombre?.trim() || null
      });

      return {
        location,
        zone: null,
        source: fallbackSource,
        reason: 'no-polygon-match',
        details: 'Coordenada capturada fuera de polígonos locales o geometría inválida'
      };
    } catch (error) {
      console.error('[ABASTECIMIENTO] GPS capture or zone match failed', error);
      return {
        location: null,
        zone: null,
        source: fallbackSource,
        reason: 'gps-error',
        details: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async saveAndPrint(input: SaveAbastecimientoInput): Promise<Abastecimiento> {
    const now = new Date().toISOString();
    const isOnline = this.connectivity.isOnline();
    const products = await this.syncService.getProducts();
    const zones = await this.syncService.getZones();
    const selectedProduct = this.resolveProduct(input.productId, products);
    const manualZone = this.resolveZone(input.zonaManualId, input.zonaManualNombre, zones);
    const currentUser = this.authService.getCurrentUser();
    const nextLocalId = await this.generateNextLocalId(currentUser?.id);
    const startedAt = this.activeStart ?? now;
    const fallbackLocation: LocationPoint = {
      lat: 0,
      lng: 0,
      accuracy: 0,
      capturedAt: now
    };

    // If manual zone is explicitly selected, keep MANUAL method but still capture GPS coordinates.
    let resolution: ZoneResolution;
    if (manualZone) {
      console.log('[ABASTECIMIENTO] Manual zone selected, skipping GPS matching', {
        zonaId: manualZone.id,
        zonaNombre: manualZone.name
      });

      let manualLocation: LocationPoint | null = null;
      try {
        manualLocation = await this.geolocation.captureCurrentPosition();
      } catch (error) {
        console.warn('[ABASTECIMIENTO] Manual zone selected but GPS capture failed. Using fallback location.', {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      resolution = {
        location: manualLocation,
        zone: manualZone,
        source: 'manual',
        reason: 'manual-selection'
      };
    } else {
      // No manual zone, attempt GPS matching
      resolution = await this.captureGpsAndMatchZone(input.zonaManualNombre);
    }

    const effectiveLocation = resolution.location ?? fallbackLocation;

    const item: Abastecimiento = {
      idLocal: nextLocalId,
      productId: selectedProduct?.id ?? input.productId ?? 0,
      productName: selectedProduct?.name ?? input.productName ?? 'Agua',
      conductor: currentUser?.name?.trim() || currentUser?.username?.trim() || 'Operador',
      cantidad: input.cantidad,
      recibidoPor: input.recibidoPor,
      importe: input.importe,
      zonaId: resolution.zone?.id,
      zonaNombre: resolution.zone?.name ?? 'Zona no detectada',
      metodoZona: this.resolveZoneMethod(resolution.source),
      ubicacion: effectiveLocation,
      horaInicio: this.formatTime(startedAt),
      horaFin: this.formatTime(now),
      estadoSincronizacion: 'PENDING',
      estadoImpresion: 'PENDING',
      creadoOffline: !isOnline,
      reintentos: 0,
      createdAt: startedAt,
      updatedAt: now
    };

    const all = await this.getAll();
    all.unshift(item);
    await this.storage.set(APP_CONSTANTS.storageKeys.abastecimientos, all);
    await this.syncService.refreshPendingCount();

    let printable = item;

    try {
      await this.printer.printAbastecimiento(printable);
      printable = (await this.updatePrintStatus(printable.idLocal, 'PRINTED')) ?? {
        ...printable,
        estadoImpresion: 'PRINTED'
      };
    } catch (error) {
      printable = (await this.updatePrintStatus(printable.idLocal, 'ERROR')) ?? {
        ...printable,
        estadoImpresion: 'ERROR'
      };
    }

    if (isOnline) {
      const synced = await this.syncService.syncAbastecimientoByLocalId(printable.idLocal);
      if (synced) {
        printable = synced;
      }
    }

    return printable;
  }

  private formatTime(isoDate: string): string {
    const date = new Date(isoDate);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  }

  async getAll(): Promise<Abastecimiento[]> {
    return (await this.storage.get<Abastecimiento[]>(APP_CONSTANTS.storageKeys.abastecimientos)) ?? [];
  }

  async getByLocalId(idLocal: string): Promise<Abastecimiento | null> {
    const all = await this.getAll();
    return all.find((item) => item.idLocal === idLocal) ?? null;
  }

  private async updatePrintStatus(idLocal: string, status: Abastecimiento['estadoImpresion']): Promise<Abastecimiento | null> {
    const all = await this.getAll();
    const target = all.find((item) => item.idLocal === idLocal);
    if (!target) {
      return null;
    }

    target.estadoImpresion = status;
    target.updatedAt = new Date().toISOString();
    await this.storage.set(APP_CONSTANTS.storageKeys.abastecimientos, all);
    return target;
  }

  private resolveZoneMethod(source: ZoneResolution['source']): Abastecimiento['metodoZona'] {
    if (source === 'gps') {
      return 'AUTO';
    }
    if (source === 'manual') {
      return 'MANUAL';
    }
    return 'UNRESOLVED';
  }

  private resolveProduct(productId: number | undefined, products: Product[]): Product | null {
    if (!products.length) {
      return null;
    }

    if (productId) {
      return products.find((item) => item.id === productId) ?? null;
    }

    return products[0];
  }

  private resolveZone(zoneId: number | undefined, zoneName: string | undefined, zones: Zone[]): Zone | null {
    if (zoneId) {
      return zones.find((item) => item.id === zoneId) ?? null;
    }

    const normalizedName = zoneName?.trim().toLowerCase();
    if (!normalizedName) {
      return null;
    }

    return zones.find((item) => item.name.trim().toLowerCase() === normalizedName) ?? null;
  }

  private async generateNextLocalId(userId: number | undefined): Promise<string> {
    const normalizedUserId = this.normalizeUserId(userId);
    const next = await this.authService.consumeNextCorrelativo(normalizedUserId);

    const userSegment = String(normalizedUserId).padStart(3, '0');
    const sequenceSegment = String(next).padStart(6, '0');
    return `AB-${userSegment}-${sequenceSegment}`;
  }

  private normalizeUserId(userId: number | undefined): number {
    if (typeof userId !== 'number' || !Number.isFinite(userId) || userId < 0) {
      return 0;
    }

    return Math.trunc(userId);
  }
}
