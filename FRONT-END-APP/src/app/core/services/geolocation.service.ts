import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { LocationPoint } from '../models/models';

@Injectable({ providedIn: 'root' })
export class GeolocationService {
  private readonly isAndroidLowApi: boolean;

  constructor() {
    this.isAndroidLowApi = this.detectLegacyAndroid();
  }

  async captureCurrentPosition(): Promise<LocationPoint> {
    await this.ensurePermissions();

    const preciseTimeout = this.isAndroidLowApi ? 25000 : 12000;
    const fallbackTimeout = this.isAndroidLowApi ? 35000 : 20000;

    try {
      const precisePosition = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: preciseTimeout,
        maximumAge: 0
      });
      return this.toLocationPoint(precisePosition);
    } catch (preciseError) {
      console.warn('[GPS] High-accuracy attempt failed. Retrying with relaxed settings.', {
        error: this.extractErrorMessage(preciseError)
      });

      try {
        const fallbackPosition = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: fallbackTimeout,
          maximumAge: 30000
        });
        return this.toLocationPoint(fallbackPosition);
      } catch (fallbackError) {
        const combined =
          'No se pudo obtener ubicacion. ' +
          `Intento preciso: ${this.extractErrorMessage(preciseError)}. ` +
          `Intento alternativo: ${this.extractErrorMessage(fallbackError)}`;
        console.error('[GPS] Location capture failed after retries', combined);
        throw new Error(combined);
      }
    }
  }

  private async ensurePermissions(): Promise<void> {
    let current: Awaited<ReturnType<typeof Geolocation.checkPermissions>> | null = null;

    try {
      current = await Geolocation.checkPermissions();
    } catch (error) {
      // Some POS builds can fail permission introspection even when GPS is usable.
      console.warn('[GPS] Could not check permissions. Proceeding to location request.', {
        error: this.extractErrorMessage(error)
      });
      return;
    }

    const hasPermission = current.location === 'granted' || current.coarseLocation === 'granted';

    if (hasPermission) {
      return;
    }

    let requested: Awaited<ReturnType<typeof Geolocation.requestPermissions>> | null = null;
    try {
      requested = await Geolocation.requestPermissions();
    } catch (error) {
      console.warn('[GPS] Permission request call failed. Proceeding to location request.', {
        error: this.extractErrorMessage(error)
      });
      return;
    }

    const granted = requested.location === 'granted' || requested.coarseLocation === 'granted';

    const denied = requested.location === 'denied' && requested.coarseLocation === 'denied';

    if (!granted && denied) {
      throw new Error('Permiso de ubicación denegado');
    }
  }

  private toLocationPoint(position: Awaited<ReturnType<typeof Geolocation.getCurrentPosition>>): LocationPoint {
    const captured: LocationPoint = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy,
      capturedAt: new Date().toISOString()
    };

    console.log('[GPS] Captured position', captured);
    return captured;
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
      return error.message;
    }

    return String(error);
  }

  private detectLegacyAndroid(): boolean {
    if (Capacitor.getPlatform() !== 'android') {
      return false;
    }

    try {
      const userAgent = navigator.userAgent || '';
      const match = userAgent.match(/Android\s+(\d+)/i);
      if (match && match[1]) {
        const apiLevel = parseInt(match[1], 10);
        return apiLevel > 0 && apiLevel <= 28;
      }
    } catch {
    }

    return false;
  }
}
