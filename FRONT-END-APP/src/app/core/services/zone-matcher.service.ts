import { Injectable } from '@angular/core';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon, multiPolygon } from '@turf/helpers';
import { LocationPoint, Zone } from '../models/models';

@Injectable({ providedIn: 'root' })
export class ZoneMatcherService {
  matchZone(position: LocationPoint, zones: Zone[]): Zone | null {
    if (!zones.length || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
      console.warn('[ZONE] Match skipped', {
        hasZones: zones.length > 0,
        lat: position.lat,
        lng: position.lng
      });
      return null;
    }

    const p = point([position.lng, position.lat]);

    console.groupCollapsed('[ZONE] Matching position against local zones');
    console.log('[ZONE] Position', position);
    console.log(
      '[ZONE] Available zones',
      zones.map((zone) => ({ id: zone.id, code: zone.code, name: zone.name, type: zone.polygon?.type }))
    );

    for (const zone of zones) {
      const geometry = zone.polygon;
      if (!geometry || !geometry.coordinates) {
        console.warn('[ZONE] Zone skipped: missing geometry', { id: zone.id, name: zone.name });
        continue;
      }

      const match = this.evaluateZoneMatch(p, geometry);

      console.log('[ZONE] Polygon evaluation', {
        id: zone.id,
        name: zone.name,
        geometryType: geometry.type,
        firstCoordinate: Array.isArray(geometry.coordinates) ? geometry.coordinates[0] : null,
        isInside: match.isInside,
        usedSwappedCoordinates: match.usedSwappedCoordinates
      });

      if (match.isInside) {
        console.log('[ZONE] Match found', { id: zone.id, name: zone.name });
        console.groupEnd();
        return zone;
      }
    }

    console.warn('[ZONE] No polygon matched current position');
    console.groupEnd();
    return null;
  }

  private evaluateZoneMatch(
    p: ReturnType<typeof point>,
    geometry: Zone['polygon']
  ): { isInside: boolean; usedSwappedCoordinates: boolean } {
    const direct = this.isPointInsideGeometry(p, geometry.type, geometry.coordinates);
    if (direct) {
      return { isInside: true, usedSwappedCoordinates: false };
    }

    const swappedCoordinates = this.swapCoordinateOrder(geometry.coordinates);
    const swapped = this.isPointInsideGeometry(p, geometry.type, swappedCoordinates);
    if (swapped) {
      console.warn('[ZONE] Match resolved only after swapping coordinate order (lat/lng -> lng/lat).');
      return { isInside: true, usedSwappedCoordinates: true };
    }

    return { isInside: false, usedSwappedCoordinates: false };
  }

  private isPointInsideGeometry(
    p: ReturnType<typeof point>,
    type: Zone['polygon']['type'],
    coordinates: number[][][] | number[][][][]
  ): boolean {
    try {
      const feature = type === 'Polygon'
        ? polygon(coordinates as number[][][])
        : multiPolygon(coordinates as number[][][][]);

      return booleanPointInPolygon(p, feature as Parameters<typeof booleanPointInPolygon>[1]);
    } catch (error) {
      console.warn('[ZONE] Invalid geometry while evaluating polygon match', {
        type,
        error: error instanceof Error ? error.message : String(error)
      });
      return false;
    }
  }

  private swapCoordinateOrder(
    coordinates: number[][][] | number[][][][]
  ): number[][][] | number[][][][] {
    return this.swapCoordinateOrderRecursive(coordinates) as number[][][] | number[][][][];
  }

  private swapCoordinateOrderRecursive(input: unknown): unknown {
    if (!Array.isArray(input)) {
      return input;
    }

    if (input.length >= 2 && typeof input[0] === 'number' && typeof input[1] === 'number') {
      const [first, second, ...rest] = input as number[];
      return [second, first, ...rest];
    }

    return input.map((item) => this.swapCoordinateOrderRecursive(item));
  }
}
