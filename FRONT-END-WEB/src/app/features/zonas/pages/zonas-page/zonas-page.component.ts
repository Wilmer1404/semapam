import { AfterViewInit, Component, DestroyRef, ElementRef, OnInit, ViewChild, inject } from '@angular/core';
import { BehaviorSubject, switchMap } from 'rxjs';
import mapboxgl from 'mapbox-gl';
import MapboxDraw from '@mapbox/mapbox-gl-draw';
import { ZonesService } from '../../services/zones.service';
import { MapConfigService } from '@core/services/map-config.service';
import { Zone } from '@shared/models/zone.model';
import { NotificationService } from '@core/services/notification.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';

type ZoneGeometry = {
  type: 'Polygon' | 'MultiPolygon';
  coordinates: number[][][] | number[][][][];
};

@Component({
  selector: 'app-zonas-page',
  templateUrl: './zonas-page.component.html',
  styleUrls: ['./zonas-page.component.scss'],
  providers: [ZonesService]
})
export class ZonasPageComponent implements OnInit, AfterViewInit {
  private static readonly ZONES_SOURCE_ID = 'zones-catalog-source';
  private static readonly ZONES_FILL_LAYER_ID = 'zones-catalog-fill';
  private static readonly ZONES_LINE_LAYER_ID = 'zones-catalog-line';

  private readonly svc = inject(ZonesService);
  readonly mapConfig = inject(MapConfigService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  @ViewChild('mapContainer') mapContainer?: ElementRef<HTMLDivElement>;
  displayedColumns = ['code', 'name', 'district', 'province', 'department', 'is_published', 'is_active', 'actions'];
  allZones: Zone[] = [];
  filteredZones: Zone[] = [];
  pagedZones: Zone[] = [];
  totalZones = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];
  departmentOptions: string[] = ['ALL'];
  filters = {
    search: '',
    department: 'ALL',
    published: 'ALL',
    status: 'ALL'
  };
  editingId: number | null = null;
  formVisible = false;

  selectedZone: Zone = {
    code: '',
    name: '',
    district: '',
    province: '',
    department: '',
    is_published: true,
    is_active: true
  };

  private map?: mapboxgl.Map;
  private draw?: MapboxDraw;
  private selectedDrawFeatureId: string | null = null;
  private mapLoaded = false;
  private initialFitDone = false;
  private zonesCatalog: Zone[] = [];

  ngOnInit(): void {
    this.reload$.pipe(
      switchMap(() => this.svc.list()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        const zones = response.data || [];
        this.allZones = zones;
        this.zonesCatalog = zones;
        this.departmentOptions = ['ALL', ...Array.from(new Set(
          zones
            .map((z) => (z.department || '').trim())
            .filter((value) => !!value)
        )).sort((a, b) => a.localeCompare(b))];
        this.applyFilters();
        this.renderCatalogZones();
      },
      error: (error) => {
        this.notification.error(error?.error?.message || 'No se pudo cargar el listado de zonas.');
      }
    });
  }

  ngAfterViewInit(): void {
    this.mapConfig.applyToken();
    if (!this.mapContainer || !this.mapConfig.tokenReady) return;

    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-76.2422, -9.9306],
      zoom: 11
    });

    this.draw = new MapboxDraw({
      displayControlsDefault: false,
      controls: { polygon: true, trash: true }
    });

    this.map.addControl(this.draw);
    this.map.addControl(new mapboxgl.NavigationControl());
    this.map.on('load', () => {
      this.mapLoaded = true;
      this.ensureCatalogLayers();
      this.renderCatalogZones();
    });
  }

  startDraw(): void {
    if (!this.draw) return;
    this.selectedDrawFeatureId = null;
    this.draw.deleteAll();
    this.draw.changeMode('draw_polygon');
  }

  startEdit(): void {
    if (!this.draw) return;
    if (this.selectedDrawFeatureId) {
      this.draw.changeMode('direct_select', { featureId: this.selectedDrawFeatureId });
      return;
    }
    const selected = this.draw.getSelectedIds();
    if (selected.length > 0) {
      this.draw.changeMode('direct_select', { featureId: selected[0] });
      return;
    }
    this.draw.changeMode('simple_select');
    this.notification.success('Selecciona un poligono para editarlo.');
  }

  deleteSelected(): void {
    if (!this.draw) return;
    const selected = this.draw.getSelectedIds();
    if (selected.length === 0) {
      this.notification.error('No hay poligonos seleccionados para eliminar.');
      return;
    }
    this.draw.delete(selected);
    this.selectedDrawFeatureId = null;
    this.notification.success('Poligono eliminado del editor.');
  }

  saveZone(): void {
    if (!this.selectedZone.code?.trim() || !this.selectedZone.name?.trim()) {
      this.notification.error('Código y nombre son obligatorios.');
      return;
    }

    const payload: Zone = { ...this.selectedZone };
    if (this.draw) {
      const selectedIds = this.draw.getSelectedIds();
      if (selectedIds.length > 0) {
        this.selectedDrawFeatureId = selectedIds[0];
      }
    }

    const drawGeometry = this.getGeometryFromDraw();
    if (drawGeometry) {
      payload.geojson = {
        type: 'Feature',
        properties: {},
        geometry: drawGeometry
      };
    } else if (!this.editingId) {
      this.notification.error('Debes dibujar un polígono válido antes de guardar la zona.');
      return;
    } else if (!this.extractZoneGeometry(this.selectedZone.geojson)) {
      this.notification.error('La zona no tiene un polígono válido para guardar.');
      return;
    }

    const request$ = this.editingId
      ? this.svc.update(this.editingId, payload)
      : this.svc.create(payload);

    request$.subscribe({
      next: () => {
        this.notification.success(this.editingId ? 'Zona actualizada.' : 'Zona creada.');
        this.cancelZoneForm();
        this.reload$.next();
      },
      error: (error) => this.notification.error(error?.error?.message || 'No se pudo guardar la zona.')
    });
  }

  private getGeometryFromDraw(): ZoneGeometry | undefined {
    if (!this.draw) {
      return undefined;
    }

    const allFeatures = this.draw.getAll().features as Array<{ id?: string | number; geometry?: ZoneGeometry }>;
    const selectedId = this.selectedDrawFeatureId;
    const selectedFeature = selectedId
      ? allFeatures.find((feature) => String(feature.id) === String(selectedId))
      : undefined;

    const selectedGeometry = selectedFeature?.geometry;
    if (selectedGeometry && this.hasCoordinates(selectedGeometry.coordinates)) {
      return selectedGeometry;
    }

    const firstValidGeometry = allFeatures
      .map((feature) => feature.geometry)
      .find((geometry) => !!geometry && this.hasCoordinates(geometry.coordinates));

    return firstValidGeometry;
  }

  private extractZoneGeometry(value: unknown): ZoneGeometry | undefined {
    const data = value as { type?: string; geometry?: ZoneGeometry; coordinates?: unknown };
    if (!data || typeof data !== 'object') {
      return undefined;
    }

    if ((data.type === 'Polygon' || data.type === 'MultiPolygon') && this.hasCoordinates(data.coordinates)) {
      return data as ZoneGeometry;
    }

    if (data.geometry && (data.geometry.type === 'Polygon' || data.geometry.type === 'MultiPolygon')
      && this.hasCoordinates(data.geometry.coordinates)) {
      return data.geometry;
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

  showGeoJson(): void {
    if (!this.draw) return;
    const data = this.draw.getAll();
    this.notification.success(`GeoJSON listo con ${data.features.length} feature(s).`);
    console.log('Mapbox Draw GeoJSON', data);
  }

  openCreateZone(): void {
    this.formVisible = true;
    this.editingId = null;
    this.selectedDrawFeatureId = null;
    this.selectedZone = {
      code: '',
      name: '',
      district: '',
      province: '',
      department: '',
      is_published: true,
      is_active: true
    };
    if (this.draw) {
      this.draw.deleteAll();
    }
    this.refreshMapLayout(() => {
      this.renderCatalogZones();
      this.fitToAllZones();
      this.draw?.changeMode('draw_polygon');
    });
    this.notification.success('Dibuja el poligono y completa los datos de la zona.');
  }

  toggleCreateZoneForm(): void {
    if (this.formVisible && this.editingId === null) {
      this.cancelZoneForm();
      return;
    }

    this.openCreateZone();
  }

  reloadCatalog(): void {
    this.reload$.next();
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.applyFilters();
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      department: 'ALL',
      published: 'ALL',
      status: 'ALL'
    };
    this.pageIndex = 0;
    this.applyFilters();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePageSlice();
  }

  cancelZoneForm(): void {
    this.formVisible = false;
    this.editingId = null;
    this.selectedDrawFeatureId = null;
    this.selectedZone = {
      code: '',
      name: '',
      district: '',
      province: '',
      department: '',
      is_published: true,
      is_active: true
    };
    if (this.draw) {
      this.draw.deleteAll();
    }
    this.refreshMapLayout(() => this.renderCatalogZones());
  }

  editZone(row: Zone): void {
    this.formVisible = true;
    this.editingId = row.id || null;
    this.selectedZone = { ...row };
    this.refreshMapLayout(() => {
      this.renderCatalogZones();
      this.loadZoneGeometry(row.geojson as unknown);
    });
  }

  deleteZone(row: Zone): void {
    if (!row.id) {
      this.notification.error('No se puede eliminar una zona sin ID.');
      return;
    }

    this.svc.deleteZone(row.id).subscribe({
      next: () => {
        this.notification.success('Zona eliminada.');
        if (this.editingId === row.id) {
          this.cancelZoneForm();
        }
        this.reload$.next();
      },
      error: (error) => this.notification.error(error?.error?.message || 'No se pudo eliminar la zona.')
    });
  }

  private loadZoneGeometry(rawGeoJson: unknown): void {
    if (!this.draw || !this.map) {
      return;
    }

    this.draw.deleteAll();
    const features = this.toDrawFeatures(rawGeoJson);
    if (features.length === 0) {
      this.notification.error('La zona seleccionada no tiene polígono válido para editar.');
      return;
    }

    const addedIds: string[] = [];
    features.forEach((feature) => {
      const idOrIds = this.draw?.add(feature as any);
      if (Array.isArray(idOrIds)) {
        addedIds.push(...idOrIds);
      } else if (typeof idOrIds === 'string') {
        addedIds.push(idOrIds);
      }
    });

    this.selectedDrawFeatureId = addedIds[0] || null;
    const bounds = this.getBoundsFromFeatures(features);
    if (bounds) {
      this.map.fitBounds(bounds, { padding: 40, duration: 700 });
    }

    if (this.selectedDrawFeatureId) {
      this.draw.changeMode('direct_select', { featureId: this.selectedDrawFeatureId });
    } else {
      this.draw.changeMode('simple_select');
    }
    this.notification.success('Polígono cargado para edición.');
  }

  private ensureCatalogLayers(): void {
    if (!this.map) {
      return;
    }

    if (!this.map.getSource(ZonasPageComponent.ZONES_SOURCE_ID)) {
      this.map.addSource(ZonasPageComponent.ZONES_SOURCE_ID, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
      });
    }

    if (!this.map.getLayer(ZonasPageComponent.ZONES_FILL_LAYER_ID)) {
      this.map.addLayer({
        id: ZonasPageComponent.ZONES_FILL_LAYER_ID,
        type: 'fill',
        source: ZonasPageComponent.ZONES_SOURCE_ID,
        paint: {
          'fill-color': ['case', ['==', ['get', '__selected'], true], '#f59e0b', '#2f80ed'],
          'fill-opacity': ['case', ['==', ['get', '__selected'], true], 0.35, 0.16]
        }
      });
    }

    if (!this.map.getLayer(ZonasPageComponent.ZONES_LINE_LAYER_ID)) {
      this.map.addLayer({
        id: ZonasPageComponent.ZONES_LINE_LAYER_ID,
        type: 'line',
        source: ZonasPageComponent.ZONES_SOURCE_ID,
        paint: {
          'line-color': ['case', ['==', ['get', '__selected'], true], '#c15f00', '#1d5f96'],
          'line-width': ['case', ['==', ['get', '__selected'], true], 3, 2]
        }
      });
    }
  }

  private fitToAllZones(): void {
    if (!this.map || this.zonesCatalog.length === 0) return;
    const features = this.zonesCatalog.flatMap((zone) => this.toDrawFeatures(zone.geojson as unknown));
    const bounds = this.getBoundsFromFeatures(features as Array<Record<string, unknown>>);
    if (bounds) {
      this.map.fitBounds(bounds, { padding: 60, duration: 700 });
    }
  }

  private refreshMapLayout(afterResize?: () => void): void {
    if (!this.map) {
      afterResize?.();
      return;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        this.map?.resize();
        afterResize?.();
      });
    });
  }

  private applyFilters(): void {
    const search = this.filters.search.trim().toLowerCase();
    this.filteredZones = this.allZones.filter((zone) => {
      const matchesSearch = !search || [zone.code, zone.name, zone.district, zone.province, zone.department]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));

      const zoneDepartment = (zone.department || '').trim();
      const matchesDepartment = this.filters.department === 'ALL' || zoneDepartment === this.filters.department;

      const matchesPublished = this.filters.published === 'ALL'
        || (this.filters.published === 'PUBLISHED' && !!zone.is_published)
        || (this.filters.published === 'DRAFT' && !zone.is_published);

      const matchesStatus = this.filters.status === 'ALL'
        || (this.filters.status === 'ACTIVE' && !!zone.is_active)
        || (this.filters.status === 'INACTIVE' && !zone.is_active);

      return matchesSearch && matchesDepartment && matchesPublished && matchesStatus;
    });

    this.totalZones = this.filteredZones.length;
    if (this.pageIndex > 0 && this.pageIndex * this.pageSize >= this.totalZones) {
      this.pageIndex = 0;
    }
    this.updatePageSlice();
  }

  private updatePageSlice(): void {
    const start = this.pageIndex * this.pageSize;
    this.pagedZones = this.filteredZones.slice(start, start + this.pageSize);
  }

  private renderCatalogZones(): void {
    if (!this.map || !this.mapLoaded) {
      return;
    }

    this.ensureCatalogLayers();
    const source = this.map.getSource(ZonasPageComponent.ZONES_SOURCE_ID) as mapboxgl.GeoJSONSource;
    if (!source) {
      return;
    }

    const features = this.zonesCatalog.flatMap((zone) => this.toZoneDisplayFeatures(zone));
    source.setData({ type: 'FeatureCollection', features } as any);

    if (!this.initialFitDone && features.length > 0) {
      const bounds = this.getBoundsFromFeatures(features as Array<Record<string, unknown>>);
      if (bounds) {
        this.map.fitBounds(bounds, { padding: 30, duration: 0 });
        this.initialFitDone = true;
      }
    }
  }

  private toZoneDisplayFeatures(zone: Zone): Array<Record<string, unknown>> {
    if (zone.id && zone.id === this.editingId) {
      return [];
    }

    const selected = !!zone.id && zone.id === this.editingId;
    return this.toDrawFeatures(zone.geojson as unknown).map((feature) => ({
      ...feature,
      properties: {
        ...(feature.properties as Record<string, unknown> || {}),
        zoneId: zone.id,
        __selected: selected
      }
    }));
  }

  private toDrawFeatures(rawGeoJson: unknown): Array<Record<string, unknown>> {
    const data = rawGeoJson as any;
    if (!data || typeof data !== 'object') {
      return [];
    }

    if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
      return data.features
        .filter((f: any) => f?.geometry?.type === 'Polygon' || f?.geometry?.type === 'MultiPolygon')
        .map((f: any) => ({
          type: 'Feature',
          properties: f.properties || {},
          geometry: f.geometry
        }));
    }

    if (data.type === 'Feature' && (data.geometry?.type === 'Polygon' || data.geometry?.type === 'MultiPolygon')) {
      return [{
        type: 'Feature',
        properties: data.properties || {},
        geometry: data.geometry
      }];
    }

    if (data.type === 'Polygon' || data.type === 'MultiPolygon') {
      return [{
        type: 'Feature',
        properties: {},
        geometry: data
      }];
    }

    if (data.geometry && (data.geometry.type === 'Polygon' || data.geometry.type === 'MultiPolygon')) {
      return [{
        type: 'Feature',
        properties: data.properties || {},
        geometry: data.geometry
      }];
    }

    return [];
  }

  private getBoundsFromFeatures(features: Array<Record<string, unknown>>): mapboxgl.LngLatBounds | null {
    const coordinates: [number, number][] = [];

    const collect = (coords: any): void => {
      if (!Array.isArray(coords) || coords.length === 0) {
        return;
      }

      if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        coordinates.push([coords[0], coords[1]] as [number, number]);
        return;
      }

      coords.forEach((item: any) => collect(item));
    };

    features.forEach((feature: any) => collect(feature?.geometry?.coordinates));

    if (coordinates.length === 0) {
      return null;
    }

    const bounds = new mapboxgl.LngLatBounds(coordinates[0], coordinates[0]);
    coordinates.forEach((coord) => bounds.extend(coord));
    return bounds;
  }
}
