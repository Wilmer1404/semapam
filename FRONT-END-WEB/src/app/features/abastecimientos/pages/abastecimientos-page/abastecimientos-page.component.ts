import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, inject } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import mapboxgl from 'mapbox-gl';
import {
  Abastecimiento,
  AbastecimientosFilters,
  PrintStatus,
  SyncStatus,
  ZoneMethod
} from '@shared/models/abastecimiento.model';
import { NotificationService } from '@core/services/notification.service';
import { MapConfigService } from '@core/services/map-config.service';
import { environment } from 'src/environments/environment';
import { AbastecimientosService } from '../../services/abastecimientos.service';

@Component({
  selector: 'app-abastecimientos-page',
  templateUrl: './abastecimientos-page.component.html',
  styleUrls: ['./abastecimientos-page.component.scss'],
  providers: [AbastecimientosService]
})
export class AbastecimientosPageComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly svc = inject(AbastecimientosService);
  private readonly notification = inject(NotificationService);
  private readonly mapConfig = inject(MapConfigService);
  readonly branding = environment.branding;
  private readonly reportLogoUrl = environment.branding.monochromeLogoUrl;

  @ViewChild('miniMapContainer') miniMapContainer?: ElementRef<HTMLDivElement>;

  private map?: mapboxgl.Map;
  private marker?: mapboxgl.Marker;
  displayedColumns = ['local_id', 'product_name', 'amount', 'driver_name', 'receiver_name', 'zone_name_snapshot', 'zone_assignment_method', 'sync_status', 'print_status'];
  items: Abastecimiento[] = [];
  selectedItem: Abastecimiento | null = null;
  loading = false;
  detailLoading = false;

  total = 0;
  pageIndex = 0;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50, 100];

  filters: AbastecimientosFilters = {
    from: '',
    to: '',
    local_id: '',
    receiver: '',
    driver: '',
    product: '',
    zone_method: undefined,
    sync_status: undefined,
    print_status: undefined
  };

  readonly zoneMethodOptions: ZoneMethod[] = ['AUTO', 'MANUAL', 'UNRESOLVED'];
  readonly syncStatusOptions: SyncStatus[] = ['PENDING', 'SYNCED', 'ERROR'];
  readonly printStatusOptions: PrintStatus[] = ['PENDING', 'PRINTED', 'ERROR'];

  get hasListData(): boolean {
    return this.items.length > 0;
  }

  ngOnInit(): void {
    this.fetchList();
  }

  exportAbastecimientosAsCsv(): void {
    const items = this.requireItems('exportar');
    if (!items) {
      return;
    }

    const csv = [this.getExportHeader(), ...this.getExportRows(items)]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\r\n');

    this.downloadBlob(csv, `abastecimientos-${this.getReportFileSuffix()}.csv`, 'text/csv;charset=utf-8;');
    this.notification.success('CSV exportado correctamente.');
  }

  async exportAbastecimientosAsXlsx(): Promise<void> {
    const items = this.requireItems('exportar');
    if (!items) {
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      workbook.creator = this.branding.organizationName;
      workbook.created = new Date();
      const sheet = workbook.addWorksheet('Abastecimientos', { views: [{ state: 'frozen', ySplit: 6 }] });
      sheet.properties.defaultRowHeight = 22;
      sheet.pageSetup = { orientation: 'landscape', paperSize: 9, fitToPage: true, fitToWidth: 1 };

      const logoDataUrl = await this.getAssetDataUrl(this.reportLogoUrl);
      if (logoDataUrl) {
        const imageId = workbook.addImage({ base64: logoDataUrl, extension: 'png' });
        sheet.addImage(imageId, { tl: { col: 0.35, row: 0.2 }, ext: { width: 160, height: 64 } });
      }

      sheet.mergeCells('C1:H1');
      sheet.getCell('C1').value = 'Abastecimientos';
      sheet.getCell('C1').font = { name: 'Calibri', size: 22, bold: true, color: { argb: 'FF163F63' } };

      sheet.mergeCells('C2:H2');
      sheet.getCell('C2').value = `${this.branding.organizationName} · Consulta operativa`;
      sheet.getCell('C2').font = { name: 'Calibri', size: 11, color: { argb: 'FF5E768B' } };

      sheet.mergeCells('I1:J1');
      sheet.getCell('I1').value = 'Periodo';
      sheet.getCell('I1').font = { size: 10, bold: true, color: { argb: 'FF6C7D8A' } };
      sheet.getCell('I1').alignment = { horizontal: 'right' };

      sheet.mergeCells('I2:J2');
      sheet.getCell('I2').value = this.getReportPeriodLabel();
      sheet.getCell('I2').font = { size: 12, bold: true, color: { argb: 'FF163F63' } };
      sheet.getCell('I2').alignment = { horizontal: 'right' };

      const headerRow = sheet.getRow(5);
      headerRow.values = this.getExportHeader();
      headerRow.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C3B5A' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        cell.border = this.getGridBorder();
      });

      this.getExportRows(items).forEach((rowValues, index) => {
        const row = sheet.getRow(6 + index);
        row.values = rowValues;
        row.eachCell((cell, columnNumber) => {
          cell.border = this.getGridBorder();
          cell.alignment = { vertical: 'middle', horizontal: columnNumber === 3 ? 'right' : 'left', wrapText: true };
        });
      });

      sheet.columns = [
        { width: 18 }, { width: 22 }, { width: 14 }, { width: 22 }, { width: 22 },
        { width: 18 }, { width: 16 }, { width: 14 }, { width: 14 }
      ];

      const buffer = await workbook.xlsx.writeBuffer();
      this.downloadBlob(buffer, `abastecimientos-${this.getReportFileSuffix()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      this.notification.success('Excel exportado correctamente.');
    } catch {
      this.notification.error('No se pudo generar el Excel de abastecimientos.');
    }
  }

  async exportAbastecimientosAsPdf(): Promise<void> {
    const items = this.requireItems('exportar');
    if (!items) {
      return;
    }

    try {
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const logoDataUrl = await this.getAssetDataUrl(this.reportLogoUrl);
      const pageWidth = pdf.internal.pageSize.getWidth();

      pdf.setFillColor(12, 59, 90);
      pdf.roundedRect(32, 28, pageWidth - 64, 88, 18, 18, 'F');
      if (logoDataUrl) {
        pdf.addImage(logoDataUrl, 'PNG', 48, 42, 96, 60, undefined, 'FAST');
      }
      pdf.setTextColor(255, 255, 255);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(22);
      pdf.text('Abastecimientos', 160, 62);
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(this.branding.organizationName, 160, 82);
      pdf.text(`Periodo: ${this.getReportPeriodLabel()}`, 160, 98);

      autoTable(pdf, {
        startY: 138,
        head: [this.getExportHeader()],
        body: this.getExportRows(items),
        theme: 'grid',
        headStyles: { fillColor: [12, 59, 90] },
        styles: { fontSize: 8, cellPadding: 5 },
        margin: { left: 32, right: 32, bottom: 28 }
      });

      pdf.save(`abastecimientos-${this.getReportFileSuffix()}.pdf`);
      this.notification.success('PDF exportado correctamente.');
    } catch {
      this.notification.error('No se pudo generar el PDF de abastecimientos.');
    }
  }

  async printAbastecimientos(): Promise<void> {
    const items = this.requireItems('imprimir');
    if (!items) {
      return;
    }

    const printWindow = window.open('', '_blank', 'width=1280,height=900');
    if (!printWindow) {
      this.notification.error('No se pudo abrir la ventana de impresión.');
      return;
    }

    const logoDataUrl = await this.getAssetDataUrl(this.reportLogoUrl);
    printWindow.document.write(this.buildPrintableHtml(items, logoDataUrl));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  fetchList(): void {
    this.loading = true;
    this.svc.list({
      from: this.filters.from || undefined,
      to: this.filters.to || undefined,
      // Backend compatibility: new/legacy parameter names.
      conductor: this.filters.driver || undefined,
      driver: this.filters.driver || undefined,
      local_id: this.filters.local_id || undefined,
      receiver: this.filters.receiver || undefined,
      product: this.filters.product || undefined,
      zone_method: this.filters.zone_method || undefined,
      sync_status: this.filters.sync_status || undefined,
      print_status: this.filters.print_status || undefined,
      offset: this.pageIndex * this.pageSize,
      limit: this.pageSize
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.items = response.data?.items || [];
        this.total = response.data?.pagination?.total || 0;

        const previousSelectedId = this.selectedItem?.id;
        if (previousSelectedId) {
          const stillVisible = this.items.find((item) => item.id === previousSelectedId);
          if (stillVisible) {
            this.selectItem(stillVisible);
            return;
          }
        }

        this.selectedItem = null;
        if (this.items.length > 0) {
          this.selectItem(this.items[0]);
        }
      },
      error: (error) => {
        this.loading = false;
        this.items = [];
        this.total = 0;
        this.selectedItem = null;
        this.notification.error(error?.error?.message || 'No se pudo cargar el listado de abastecimientos.');
      }
    });
  }

  onFiltersChange(): void {
    this.pageIndex = 0;
    this.fetchList();
  }

  clearFilters(): void {
    this.filters = {
      from: '',
      to: '',
      local_id: '',
      receiver: '',
      driver: '',
      product: '',
      zone_method: undefined,
      sync_status: undefined,
      print_status: undefined
    };
    this.pageIndex = 0;
    this.fetchList();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.fetchList();
  }

  ngAfterViewInit(): void {
    this.mapConfig.applyToken();
    if (!this.miniMapContainer || !this.mapConfig.tokenReady) return;

    this.map = new mapboxgl.Map({
      container: this.miniMapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [-76.2422, -9.9306],
      zoom: 13,
      attributionControl: false
    });
    this.map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right');
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private updateMapPin(lat?: number, lng?: number): void {
    if (!this.map) return;

    if (lat == null || lng == null) {
      this.marker?.remove();
      this.marker = undefined;
      return;
    }

    if (!this.marker) {
      this.marker = new mapboxgl.Marker({ color: '#0f4c81' })
        .setLngLat([lng, lat])
        .addTo(this.map);
    } else {
      this.marker.setLngLat([lng, lat]);
    }

    const flyTo = () => this.map!.flyTo({ center: [lng, lat], zoom: 16, speed: 1.4 });
    if (this.map.loaded()) {
      flyTo();
    } else {
      this.map.once('load', flyTo);
    }
  }

  selectItem(item: Abastecimiento): void {
    if (!item?.id) {
      this.selectedItem = item;
      return;
    }

    this.detailLoading = true;
    this.svc.getById(item.id).subscribe({
      next: (response) => {
        this.detailLoading = false;
        this.selectedItem = response.data;
        this.updateMapPin(response.data?.latitude, response.data?.longitude);
      },
      error: () => {
        this.detailLoading = false;
        this.selectedItem = item;
        this.updateMapPin(item.latitude, item.longitude);
      }
    });
  }

  trackById(_: number, row: Abastecimiento): number {
    return row.id;
  }

  getTicketLabel(row: Abastecimiento): string {
    return row.local_id || row.ticket_number || row.external_ticket_number || `AB-${row.id}`;
  }

  private requireItems(action: 'exportar' | 'imprimir'): Abastecimiento[] | null {
    if (!this.items.length) {
      this.notification.error(`No hay abastecimientos para ${action}.`);
      return null;
    }

    return this.items;
  }

  private getReportPeriodLabel(): string {
    if (this.filters.from && this.filters.to) {
      return `${this.filters.from} a ${this.filters.to}`;
    }
    if (this.filters.from) {
      return `Desde ${this.filters.from}`;
    }
    if (this.filters.to) {
      return `Hasta ${this.filters.to}`;
    }
    return 'Sin rango';
  }

  private getReportFileSuffix(): string {
    return this.getReportPeriodLabel().replace(/\s+a\s+/g, '-a-').replace(/[^\w-]/g, '-');
  }

  private getExportHeader(): string[] {
    return ['Local ID', 'Producto', 'Monto', 'Conductor', 'Receptor', 'Zona', 'Asignación', 'Sync', 'Impresión'];
  }

  private getExportRows(items: Abastecimiento[]): string[][] {
    return items.map((item) => [
      this.getTicketLabel(item),
      item.product_name,
      this.formatAmount(item.amount),
      item.driver_name || '-',
      item.receiver_name || '-',
      item.zone_name_snapshot || '-',
      item.zone_assignment_method,
      item.sync_status,
      item.print_status
    ]);
  }

  private formatAmount(value: number): string {
    return `S/ ${Number(value || 0).toFixed(2)}`;
  }

  private downloadBlob(content: BlobPart, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  private async getAssetDataUrl(assetPath: string): Promise<string | null> {
    try {
      const response = await fetch(this.resolveAssetUrl(assetPath));
      if (!response.ok) {
        return null;
      }
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  }

  private resolveAssetUrl(assetPath: string): string {
    if (/^https?:\/\//i.test(assetPath)) {
      return assetPath;
    }
    const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
    return `${window.location.origin}${normalizedPath}`;
  }

  private getGridBorder(): Partial<ExcelJS.Borders> {
    return { top: { style: 'thin', color: { argb: 'FFD9E4EC' } }, left: { style: 'thin', color: { argb: 'FFD9E4EC' } }, bottom: { style: 'thin', color: { argb: 'FFD9E4EC' } }, right: { style: 'thin', color: { argb: 'FFD9E4EC' } } };
  }

  private buildPrintableHtml(items: Abastecimiento[], logoDataUrl: string | null): string {
    const rows = items.map((item) => `
      <tr>
        <td>${this.escapeHtml(this.getTicketLabel(item))}</td>
        <td>${this.escapeHtml(item.product_name)}</td>
        <td>${this.escapeHtml(this.formatAmount(item.amount))}</td>
        <td>${this.escapeHtml(item.driver_name || '-')}</td>
        <td>${this.escapeHtml(item.receiver_name || '-')}</td>
        <td>${this.escapeHtml(item.zone_name_snapshot || '-')}</td>
        <td>${this.escapeHtml(item.zone_assignment_method)}</td>
        <td>${this.escapeHtml(item.sync_status)}</td>
        <td>${this.escapeHtml(item.print_status)}</td>
      </tr>`).join('');

    return `
      <html>
      <head>
        <title>Abastecimientos ${this.escapeHtml(this.getReportPeriodLabel())}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; font-family: Arial, sans-serif; color: #17324d; background: #eef4f8; }
          .report-shell { padding: 30px; }
          .report-card { background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(12, 59, 90, 0.12); }
          .report-header { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 28px 32px; background: linear-gradient(135deg, #0c3b5a, #176287); color: #ffffff; }
          .brand-block { display: flex; align-items: center; gap: 18px; }
          .brand-block img { width: 138px; max-height: 76px; object-fit: contain; background: rgba(255,255,255,0.14); border-radius: 16px; padding: 10px 14px; }
          .brand-copy h1 { margin: 0 0 6px; font-size: 28px; }
          .brand-copy p { margin: 0; opacity: 0.9; }
          .report-date { text-align: right; font-size: 13px; opacity: 0.92; }
          .report-body { padding: 26px 32px 32px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 10px 12px; border-bottom: 1px solid #e0e8ef; text-align: left; font-size: 12px; }
          th { background: #edf4f8; color: #23415a; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; }
          @media print { body { background: #ffffff; } .report-shell { padding: 0; } .report-card { box-shadow: none; border-radius: 0; } }
        </style>
      </head>
      <body>
        <div class="report-shell">
          <div class="report-card">
            <div class="report-header">
              <div class="brand-block">
                ${logoDataUrl ? `<img src="${logoDataUrl}" alt="SEMAPAM" />` : ''}
                <div class="brand-copy">
                  <h1>Abastecimientos</h1>
                  <p>${this.escapeHtml(this.branding.organizationName)} · Consulta operativa</p>
                </div>
              </div>
              <div class="report-date"><div>Periodo</div><strong>${this.escapeHtml(this.getReportPeriodLabel())}</strong></div>
            </div>
            <div class="report-body">
              <table>
                <thead><tr>${this.getExportHeader().map((item) => `<th>${this.escapeHtml(item)}</th>`).join('')}</tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private escapeHtml(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
}
