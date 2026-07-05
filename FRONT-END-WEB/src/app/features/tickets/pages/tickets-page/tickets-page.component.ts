import { Component, OnInit, inject } from '@angular/core';
import { PageEvent } from '@angular/material/paginator';
import { NotificationService } from '@core/services/notification.service';
import { environment } from 'src/environments/environment';
import { Ticket, TicketStatus } from '@shared/models/ticket.model';
import { TicketsService } from '../../services/tickets.service';

@Component({
  selector: 'app-tickets-page',
  templateUrl: './tickets-page.component.html',
  styleUrls: ['./tickets-page.component.scss'],
  providers: [TicketsService]
})
export class TicketsPageComponent implements OnInit {
  private readonly svc = inject(TicketsService);
  private readonly notification = inject(NotificationService);
  readonly branding = environment.branding;
  displayedColumns = ['ticket_id', 'operator', 'printed_at', 'status', 'reprint_count', 'amount'];

  items: Ticket[] = [];
  selectedTicket: Ticket | null = null;
  loading = false;
  detailLoading = false;

  total = 0;
  pageIndex = 0;
  pageSize = 20;
  readonly pageSizeOptions = [10, 20, 50, 100];

  filters: { search: string; status?: TicketStatus; from: string; to: string } = {
    search: '',
    status: undefined,
    from: '',
    to: ''
  };

  readonly statusOptions: TicketStatus[] = ['PENDING', 'SYNCED', 'ERROR'];

  ngOnInit(): void {
    this.fetchList();
  }

  fetchList(): void {
    this.loading = true;
    this.svc.list({
      search: this.filters.search || undefined,
      status: this.filters.status || undefined,
      from: this.filters.from || undefined,
      to: this.filters.to || undefined,
      offset: this.pageIndex * this.pageSize,
      limit: this.pageSize
    }).subscribe({
      next: (response) => {
        this.loading = false;
        this.items = response.data?.items || [];
        this.total = response.data?.pagination?.total || 0;

        const previousSelectedId = this.selectedTicket?.id;
        if (previousSelectedId) {
          const stillVisible = this.items.find((item) => item.id === previousSelectedId);
          if (stillVisible) {
            this.selectTicket(stillVisible);
            return;
          }
        }

        this.selectedTicket = null;
        if (this.items.length > 0) {
          this.selectTicket(this.items[0]);
        }
      },
      error: (error) => {
        this.loading = false;
        this.items = [];
        this.total = 0;
        this.selectedTicket = null;
        this.notification.error(error?.error?.message || 'No se pudo cargar el historial de tickets.');
      }
    });
  }

  onFiltersChange(): void {
    this.pageIndex = 0;
    this.fetchList();
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      status: undefined,
      from: '',
      to: ''
    };
    this.pageIndex = 0;
    this.fetchList();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.fetchList();
  }

  selectTicket(item: Ticket): void {
    if (!item?.id) {
      this.selectedTicket = item;
      return;
    }

    this.detailLoading = true;
    this.svc.detail(item.id).subscribe({
      next: (response) => {
        this.detailLoading = false;
        this.selectedTicket = response.data;
      },
      error: () => {
        this.detailLoading = false;
        this.selectedTicket = item;
      }
    });
  }

  reprintSelected(): void {
    if (!this.selectedTicket?.id) {
      this.notification.warning('Selecciona un ticket para reimprimir.');
      return;
    }

    this.svc.reprint(this.selectedTicket.id).subscribe({
      next: () => {
        this.notification.success('Reimpresion solicitada correctamente.');
        this.fetchList();
      },
      error: (error) => {
        this.notification.error(error?.error?.message || 'No se pudo solicitar la reimpresion.');
      }
    });
  }

  async printSelectedTicket(): Promise<void> {
    if (!this.selectedTicket) {
      this.notification.warning('Selecciona un ticket para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=460,height=900');
    if (!printWindow) {
      this.notification.error('No se pudo abrir la ventana de impresion.');
      return;
    }

    const logoDataUrl = await this.getAssetDataUrl(this.branding.monochromeLogoUrl);
    printWindow.document.write(this.buildThermalPrintableHtml(this.selectedTicket, logoDataUrl));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  getTicketCode(row: Ticket): string {
    return row.local_id || row.ticket_number || row.external_ticket_number || `TK-${row.id}`;
  }

  getOperatorName(row: Ticket): string {
    return row.full_name || row.username || row.printed_by || '-';
  }

  getDisplayDate(row: Ticket): string {
    return row.printed_at || row.created_at || '-';
  }

  trackById(_: number, row: Ticket): number {
    return row.id;
  }

  private async getAssetDataUrl(assetPath: string): Promise<string | null> {
    try {
      const response = await fetch(this.resolveAssetUrl(assetPath));
      if (!response.ok) return null;
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
    if (/^https?:\/\//i.test(assetPath)) return assetPath;
    const normalizedPath = assetPath.startsWith('/') ? assetPath : `/${assetPath}`;
    return `${window.location.origin}${normalizedPath}`;
  }

  private formatAmount(value: number): string {
    return `S/ ${Number(value || 0).toFixed(2)}`;
  }

  private escapeHtml(value: unknown): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private buildThermalPrintableHtml(ticket: Ticket, logoDataUrl: string | null): string {
    const title = this.escapeHtml(this.branding.organizationName);
    const ticketCode = this.escapeHtml(this.getTicketCode(ticket));
    const operator = this.escapeHtml(this.getOperatorName(ticket));
    const receiver = this.escapeHtml(ticket.receiver_name || '-');
    const dni = this.escapeHtml(ticket.receiver_dni || '-');
    const zone = this.escapeHtml(ticket.zone_name_snapshot || ticket.zone_name || '-');
    const date = this.escapeHtml(this.getDisplayDate(ticket));
    const product = this.escapeHtml(ticket.product_name || 'ABASTECIMIENTO');
    const quantity = Number(ticket.quantity || 0);
    const amount = Number(ticket.amount || 0);
    const logoBlock = logoDataUrl ? `<img class="logo" src="${logoDataUrl}" alt="Logo" />` : '';

    return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>Ticket ${ticketCode}</title>
  <style>
    @page { size: 50mm auto; margin: 2mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: 'Courier New', monospace; color: #111; }
    .receipt { width: 46mm; margin: 0 auto; font-size: 11px; line-height: 1.25; }
    .center { text-align: center; }
    .logo { max-width: 30mm; margin: 0 auto 2mm; display: block; }
    .title { font-weight: 700; font-size: 17px; margin: 1mm 0 0.5mm; }
    .divider { border-top: 1px dashed #333; margin: 2mm 0; }
    .strong { font-weight: 700; }
    .row { display: flex; justify-content: space-between; gap: 4px; }
    .row span:last-child { text-align: right; }
    .line { margin: 1mm 0; }
    .totals { font-size: 14px; font-weight: 700; margin-top: 2mm; }
  </style>
</head>
<body>
  <section class="receipt">
    <div class="center">
      ${logoBlock}
      <div class="title">${title}</div>
      <div>SERVICIO MUNICIPAL DE AGUA POTABLE Y ALCANTARILLADO MARCONA</div>
      <div class="strong">TICKET DE VENTA AGUA</div>
    </div>
    <div class="divider"></div>
    <div class="line strong">COBRADOR: ${operator}</div>
    <div class="line strong">ID: ${ticketCode}</div>
    <div class="line">ADQUIRIENTE: ${receiver}</div>
    <div class="line">DNI: ${dni}</div>
    <div class="line">SECTOR: ${zone}</div>
    <div class="line">FECHA: ${date}</div>
    <div class="divider"></div>
    <div class="row strong"><span>DESCRIPCION</span><span>P/U</span><span>TOTAL</span></div>
    <div class="row"><span>${product}</span><span>${quantity.toFixed(2)}</span><span>${amount.toFixed(2)}</span></div>
    <div class="row totals"><span>TOTAL</span><span>${amount.toFixed(2)}</span></div>
    <div class="divider"></div>
    <div class="center strong">CUIDAR EL AGUA ES TAREA DE TODOS</div>
  </section>
</body>
</html>`;
  }

}
