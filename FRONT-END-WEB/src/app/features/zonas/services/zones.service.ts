import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { ApiBaseService } from '@core/services/api-base.service';
import { Zone } from '@shared/models/zone.model';
import { ApiResponse } from '@shared/models/api-response.model';

type ZonePolygonGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

@Injectable()
export class ZonesService extends ApiBaseService {
  constructor(http: HttpClient) { super(http); }

  list() {
    return this.get<ZoneAdmin[]>('/zones').pipe(
      map((response) => ({
        ...response,
        data: (response.data || []).map((item) => this.toZone(item))
      })),
      catchError(() => of<ApiResponse<Zone[]>>({
        total_rows: 3,
        status: true,
        message: 'Mock zones fallback',
        data: [
          { id: 1, code: 'ZN-CENTRO', name: 'Zona Centro', district: 'Huánuco', province: 'Huánuco', department: 'Huánuco', is_published: true, is_active: true },
          { id: 2, code: 'ZN-NORTE', name: 'Zona Norte', district: 'Pillco Marca', province: 'Huánuco', department: 'Huánuco', is_published: true, is_active: true },
          { id: 3, code: 'ZN-RURAL', name: 'Zona Rural', district: 'Santa María del Valle', province: 'Huánuco', department: 'Huánuco', is_published: false, is_active: false }
        ]
      }))
    );
  }

  getById(id: number) {
    return this.get<ZoneAdmin>(`/zones/${id}`).pipe(
      map((response) => ({ ...response, data: this.toZone(response.data) }))
    );
  }

  create(payload: Zone) {
    return this.post<ZoneAdmin>('/zones', this.toZonePayload(payload)).pipe(
      map((response) => ({ ...response, data: this.toZone(response.data) }))
    );
  }

  update(id: number, payload: Partial<Zone>) {
    return this.put<ZoneAdmin>(`/zones/${id}`, this.toZonePayload(payload)).pipe(
      map((response) => ({ ...response, data: this.toZone(response.data) }))
    );
  }

  deleteZone(id: number) {
    return this.delete<void>(`/zones/${id}`);
  }

  private toZone(admin: ZoneAdmin): Zone {
    const rawName = admin.name ?? admin.nombre ?? '';
    const rawActive = admin.is_active ?? admin.estado;
    const polygonGeometry = this.normalizePolygon(admin.polygon ?? admin.geojson);

    return {
      id: admin.id,
      code: admin.code,
      name: rawName,
      district: admin.district || '',
      province: admin.province || '',
      department: admin.department || '',
      is_published: admin.is_published === undefined ? true : Number(admin.is_published) === 1,
      is_active: rawActive === undefined ? true : Number(rawActive) === 1,
      geojson: polygonGeometry ? { type: 'Feature', properties: {}, geometry: polygonGeometry } : undefined
    };
  }

  private toZonePayload(payload: Partial<Zone>): Record<string, unknown> {
    const polygon = this.normalizePolygon(payload.geojson);
    const geojsonFeature = polygon
      ? { type: 'Feature', properties: {}, geometry: polygon }
      : undefined;

    return {
      ...(payload.code !== undefined ? { code: payload.code } : {}),
      ...(payload.name !== undefined ? { nombre: payload.name } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.district !== undefined ? { district: payload.district } : {}),
      ...(payload.province !== undefined ? { province: payload.province } : {}),
      ...(payload.department !== undefined ? { department: payload.department } : {}),
      ...(polygon && this.hasCoordinates(polygon.coordinates) ? { polygon } : {}),
      ...(geojsonFeature ? { geojson: geojsonFeature } : {}),
      ...(payload.is_active !== undefined ? { estado: payload.is_active ? 1 : 0 } : {}),
      ...(payload.is_published !== undefined ? { is_published: payload.is_published ? 1 : 0 } : {}),
      ...(payload.is_active !== undefined ? { is_active: payload.is_active ? 1 : 0 } : {})
    };
  }

  private normalizePolygon(value: unknown): ZonePolygonGeometry | undefined {
    const data = value as {
      type?: string;
      geometry?: { type?: string; coordinates?: unknown };
      coordinates?: unknown;
    };

    if (!data || typeof data !== 'object') {
      return undefined;
    }

    if ((data.type === 'Polygon' || data.type === 'MultiPolygon') && data.coordinates !== undefined) {
      return {
        type: data.type,
        coordinates: data.coordinates as number[][][] | number[][][][]
      };
    }

    const geom = data.geometry;
    if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon') && geom.coordinates !== undefined) {
      return {
        type: geom.type,
        coordinates: geom.coordinates as number[][][] | number[][][][]
      };
    }

    return undefined;
  }

  private hasCoordinates(coords: unknown): boolean {
    if (!Array.isArray(coords) || coords.length === 0) {
      return false;
    }

    if (typeof coords[0] === 'number') {
      return coords.length >= 2;
    }

    return coords.some((item) => this.hasCoordinates(item));
  }
}

interface ZoneAdmin {
  id: number;
  code: string;
  name?: string;
  nombre?: string;
  district: string | null;
  province: string | null;
  department: string | null;
  polygon?: ZonePolygonGeometry;
  geojson?: Zone['geojson'];
  estado?: number | boolean;
  is_published?: number | boolean;
  is_active?: number | boolean;
}
