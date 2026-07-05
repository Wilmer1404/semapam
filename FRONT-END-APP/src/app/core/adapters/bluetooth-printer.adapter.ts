import { Injectable } from '@angular/core';
import { BluetoothSerial } from '@awesome-cordova-plugins/bluetooth-serial/ngx';
import { firstValueFrom, timeout } from 'rxjs';
import { Abastecimiento, ArqueoDaily, Ticket } from '../models/models';
import { PrinterAdapter } from './printer-adapter.interface';
import { DeviceService } from '../services/device.service';
import { PrinterConfigService } from '../services/printer-config.service';
import { AuthService } from '../services/auth.service';
import { PrinterValidation } from '../../shared/interfaces/printer-config.interface';
import { PosPrinter } from '../native/pos-printer.plugin';

@Injectable({ providedIn: 'root' })
export class BluetoothPrinterAdapter implements PrinterAdapter {
  constructor(
    private readonly bluetoothSerial: BluetoothSerial,
    private readonly deviceService: DeviceService,
    private readonly printerConfigService: PrinterConfigService,
    private readonly authService: AuthService
  ) {}

  async isAvailable(): Promise<boolean> {
    const validation = await this.validatePrinter();
    return validation.status === 'AVAILABLE';
  }

  async validatePrinter(): Promise<PrinterValidation> {
    const validation = await this.printerConfigService.validateConfiguredPrinter();
    if (validation.status !== 'AVAILABLE') {
      return validation;
    }

    try {
      const native = await PosPrinter.getNativeStatus();
      if (native.available) {
        return {
          status: 'AVAILABLE',
          message: 'Impresora nativa ZCS disponible.',
          configuredPrinter: validation.configuredPrinter
        };
      }
    } catch {
      // If native status fails, keep Bluetooth validation path.
    }

    try {
      const connected = await this.connect(validation.configuredPrinter!.mac);
      if (!connected) {
        return {
          status: 'UNAVAILABLE',
          message: 'No fue posible abrir conexion RFCOMM con la impresora.',
          configuredPrinter: validation.configuredPrinter
        };
      }

      return {
        status: 'AVAILABLE',
        message: 'Impresora Bluetooth conectada.',
        configuredPrinter: validation.configuredPrinter
      };
    } catch (error) {
      return {
        status: 'UNAVAILABLE',
        message: this.errorToMessage(error, 'No se pudo conectar a la impresora.'),
        configuredPrinter: validation.configuredPrinter
      };
    } finally {
      await this.disconnectSafe();
    }
  }

  async testPrint(): Promise<PrinterValidation> {
    const validation = await this.validatePrinter();
    if (validation.status !== 'AVAILABLE' || !validation.configuredPrinter) {
      return validation;
    }

    try {
      const config = await this.printerConfigService.getConfig();
      const now = new Date();
      const content = this.composeDocument(
        config.paperWidth,
        [
          this.center('WATER APP FULL', config.paperWidth),
          this.center('PRUEBA DE IMPRESION', config.paperWidth),
          this.separator(config.paperWidth),
          `Fecha: ${now.toLocaleDateString()}`,
          `Hora: ${now.toLocaleTimeString()}`,
          `Impresora: ${config.printerName || 'Sin nombre'}`,
          `MAC: ${config.printerMac || '-'}`,
          this.separator(config.paperWidth),
          'Prueba de impresion exitosa.'
        ]
      );

      const nativePrinted = await this.tryNativePrint(content);
      if (nativePrinted) {
        return {
          status: 'AVAILABLE',
          message: 'Prueba de impresion enviada por impresora nativa ZCS.',
          configuredPrinter: validation.configuredPrinter
        };
      }

      const connected = await this.connect(validation.configuredPrinter.mac);
      if (!connected) {
        return {
          status: 'UNAVAILABLE',
          message: 'No se pudo establecer sesion Bluetooth activa para imprimir.',
          configuredPrinter: validation.configuredPrinter
        };
      }

      await this.waitForTransportReady();
      await this.writeWithFallback(content);

      return {
        status: 'AVAILABLE',
        message: 'Prueba de impresion enviada correctamente.',
        configuredPrinter: validation.configuredPrinter
      };
    } catch (error) {
      return {
        status: 'ERROR',
        message: this.errorToMessage(error, 'No se pudo enviar la impresion de prueba.'),
        configuredPrinter: validation.configuredPrinter
      };
    } finally {
      await this.disconnectSafe();
    }
  }

  async connect(mac: string): Promise<boolean> {
    if (!this.deviceService.supportsBluetoothClassic()) {
      return false;
    }

    const normalizedMac = this.deviceService.normalizeMac(mac);
    if (!normalizedMac) {
      return false;
    }

    const bluetoothEnabled = await this.deviceService.isBluetoothEnabled();
    if (!bluetoothEnabled) {
      return false;
    }

    let secureError = '';
    let insecureError = '';

    try {
      await this.disconnectSafe();
      await firstValueFrom(this.bluetoothSerial.connect(normalizedMac).pipe(timeout(12000)));
      return true;
    } catch (error) {
      secureError = this.errorToMessage(error, 'sin detalle');
      // Fallback below tries insecure RFCOMM, required by some POS printers.
    }

    try {
      await this.disconnectSafe();
      const bridge = this.bluetoothSerial as unknown as {
        connectInsecure?: (address: string) => import('rxjs').Observable<unknown>;
      };

      if (!bridge.connectInsecure) {
        insecureError = 'connectInsecure no disponible en este plugin';
        throw new Error(insecureError);
      }

      await firstValueFrom(bridge.connectInsecure(normalizedMac).pipe(timeout(12000)));
      return true;
    } catch (error) {
      insecureError = this.errorToMessage(error, 'sin detalle');
      throw new Error(
        `Conexion Bluetooth fallida. Seguro: ${secureError || 'sin detalle'}. Inseguro: ${insecureError || 'sin detalle'}.`
      );
    }
  }

  async disconnectSafe(): Promise<void> {
    try {
      await this.bluetoothSerial.disconnect();
    } catch {
      // Avoid crashes when disconnecting a non-connected socket.
    }
  }

  async debugWrite(): Promise<string[]> {
    const log: string[] = [];

    const config = await this.printerConfigService.getConfig();
    const mac = this.deviceService.normalizeMac(config.printerMac);
    log.push(`MAC objetivo: ${mac || '(vacia)'}`);

    if (!mac) {
      log.push('ERROR: MAC vacia, no se puede conectar.');
      return log;
    }

    const btEnabled = await this.deviceService.isBluetoothEnabled();
    log.push(`Bluetooth encendido: ${btEnabled ? 'SÍ' : 'NO'}`);
    if (!btEnabled) {
      return log;
    }

    const paired = await this.deviceService.findPairedDevice(mac);
    log.push(`En lista emparejados: ${paired ? `SÍ (${paired.name})` : 'NO'}`);

    log.push('Intentando connect()...');
    let connected = false;
    try {
      connected = await this.connect(mac);
      log.push(`connect() resultado: ${connected ? 'EXITOSO' : 'FALLIDO'}`);
    } catch (e) {
      log.push(`connect() excepcion: ${this.errorToMessage(e, 'desconocido')}`);
      return log;
    }

    if (!connected) {
      return log;
    }

    // Count bytes the printer sends back
    let receivedBytes = 0;
    const rawSub = this.bluetoothSerial.subscribeRawData().subscribe({
      next: (buf: ArrayBuffer) => { receivedBytes += buf.byteLength; },
      error: () => {}
    });

    await this.waitForTransportReady();

    // ESC/POS real-time status query (DLE ENQ 1) — a real ESC/POS printer replies with 1 byte
    log.push('Consulta DLE ENQ 1 (estado ESC/POS)...');
    try {
      await this.bluetoothSerial.write('\x10\x04\x01');
      log.push('Consulta: enviada OK');
    } catch (e) {
      log.push(`Consulta ERROR: ${this.errorToMessage(e, 'fallo')}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
    log.push(`Respuesta recibida: ${receivedBytes} byte(s)`);

    // Test 1: plain LF feed only — no ESC codes
    log.push('Prueba 1: solo LF (4x)...');
    try {
      await this.bluetoothSerial.write('\n\n\n\n');
      log.push('Prueba 1: write OK');
    } catch (e) {
      log.push(`Prueba 1 ERROR: ${this.errorToMessage(e, 'fallo write')}`);
    }
    await new Promise((r) => setTimeout(r, 500));

    // Test 2: plain ASCII CRLF text
    log.push('Prueba 2: texto CRLF...');
    try {
      await this.bluetoothSerial.write('TEST WATER APP\r\n\r\n\r\n');
      log.push('Prueba 2: write OK');
    } catch (e) {
      log.push(`Prueba 2 ERROR: ${this.errorToMessage(e, 'fallo write')}`);
    }
    await new Promise((r) => setTimeout(r, 500));

    // Test 3: ESC/POS init + text
    log.push('Prueba 3: ESC init + texto...');
    try {
      await this.bluetoothSerial.write('\x1b\x40TEST ESCPOS\r\n\r\n\r\n');
      log.push('Prueba 3: write OK');
    } catch (e) {
      log.push(`Prueba 3 ERROR: ${this.errorToMessage(e, 'fallo write')}`);
    }

    // Keep connection open 3 seconds so the OS BT stack can actually flush the buffers
    log.push('Flush: esperando 3s con conexion abierta...');
    await new Promise((r) => setTimeout(r, 3000));
    log.push(`Bytes totales recibidos: ${receivedBytes}`);

    rawSub.unsubscribe();
    await this.disconnectSafe();
    log.push('Desconectado. Fin del debug.');
    return log;
  }

  async printTicket(ticket: Ticket): Promise<void> {
    const config = await this.printerConfigService.getConfig();
    const cobrador = this.authService.getCurrentUser()?.name ?? '';

    const nativePrinted = await this.tryNativeSemapamDocument({
      docType: 'ticket',
      ticketId: ticket.id,
      adquiriente: ticket.customer,
      sector: ticket.zone,
      fecha: this.toDisplayDate(ticket.date),
      total: ticket.amount.toFixed(2),
      unitCode: config.companyCode || 'M004',
      cobrador,
      productName: ticket.productName ?? 'Agua',
      reprint: false
    });

    if (nativePrinted) {
      return;
    }

    await this.printDocument(async (paperWidth) => {
      return this.composeTicketLikeDocument(paperWidth, ticket, config.companyCode, cobrador, false);
    });
  }

  async reprintTicket(ticket: Ticket): Promise<void> {
    const config = await this.printerConfigService.getConfig();
    const cobrador = this.authService.getCurrentUser()?.name ?? '';

    const nativePrinted = await this.tryNativeSemapamDocument({
      docType: 'ticket',
      ticketId: ticket.id,
      adquiriente: ticket.customer,
      sector: ticket.zone,
      fecha: this.toDisplayDate(ticket.date),
      total: ticket.amount.toFixed(2),
      unitCode: config.companyCode || 'M004',
      cobrador,
      productName: ticket.productName ?? 'Agua',
      reprint: true
    });

    if (nativePrinted) {
      return;
    }

    await this.printDocument(async (paperWidth) => {
      return this.composeTicketLikeDocument(paperWidth, ticket, config.companyCode, cobrador, true);
    });
  }

  async printAbastecimiento(abastecimiento: Abastecimiento): Promise<void> {
    const config = await this.printerConfigService.getConfig();
    const cobrador = this.authService.getCurrentUser()?.name ?? '';

    const nativePrinted = await this.tryNativeSemapamDocument({
      docType: 'ticket',
      ticketId: abastecimiento.idLocal,
      adquiriente: abastecimiento.recibidoPor,
      sector: abastecimiento.zonaNombre,
      fecha: this.toDisplayDate(abastecimiento.createdAt),
      total: abastecimiento.importe.toFixed(2),
      unitCode: config.companyCode || 'M004',
      cobrador,
      productName: abastecimiento.productName ?? 'Agua',
      reprint: false
    });

    if (nativePrinted) {
      return;
    }

    const ticketLike: Ticket = {
      id: abastecimiento.idLocal,
      customer: abastecimiento.recibidoPor,
      zone: abastecimiento.zonaNombre,
      amount: abastecimiento.importe,
      liters: abastecimiento.cantidad,
      productName: abastecimiento.productName ?? 'Agua',
      status: abastecimiento.estadoSincronizacion,
      date: abastecimiento.createdAt
    };

    await this.printDocument(async (paperWidth) => {
      return this.composeTicketLikeDocument(paperWidth, ticketLike, config.companyCode, cobrador, false);
    });
  }

  async printArqueo(arqueo: ArqueoDaily): Promise<void> {
    const config = await this.printerConfigService.getConfig();
    const cobrador = this.authService.getCurrentUser()?.name ?? '';
    const nativeItems = (arqueo.items ?? []).map((item) => ({
      ...item,
      tickets: 1,
      productName: item.customerName
        ? `${item.customerName} - ${item.productName}`
        : item.productName
    }));

    const nativePrinted = await this.tryNativeSemapamDocument({
      docType: 'arqueo',
      fecha: this.toDisplayDate(arqueo.date),
      total: arqueo.totalAmount.toFixed(2),
      totalTickets: arqueo.totalTickets,
      syncedAt: arqueo.syncedAt ? this.toDisplayDate(arqueo.syncedAt) : '-',
      unitCode: config.companyCode || 'M004',
      cobrador,
      items: nativeItems
    });

    if (nativePrinted) {
      return;
    }

    await this.printDocument(async (paperWidth) => {
      return this.composeArqueoLikeDocument(paperWidth, arqueo, config.companyCode);
    });
  }

  private async printDocument(builder: (paperWidth: '50mm' | '58mm') => Promise<string>): Promise<void> {
    const validation = await this.validatePrinter();
    if (validation.status !== 'AVAILABLE' || !validation.configuredPrinter) {
      throw new Error(validation.message);
    }

    try {
      const connected = await this.connect(validation.configuredPrinter.mac);
      if (!connected) {
        throw new Error('No se pudo establecer conexion Bluetooth con la impresora configurada.');
      }

      const config = await this.printerConfigService.getConfig();
      const payload = await builder(config.paperWidth);

      const nativePrinted = await this.tryNativePrint(payload);
      if (nativePrinted) {
        return;
      }

      await this.waitForTransportReady();
      await this.writeWithFallback(payload);
    } finally {
      await this.disconnectSafe();
    }
  }

  private composeTicketLikeDocument(
    paperWidth: '50mm' | '58mm',
    ticket: Ticket,
    companyCode: string,
    cobrador: string,
    reprint: boolean
  ): string {
    const width = paperWidth === '50mm' ? 24 : 32;
    const separator = '^'.repeat(width);
    const date = this.toDisplayDate(ticket.date);
    const amount = ticket.amount.toFixed(2);
    const product = (ticket.productName ?? 'AGUA').toUpperCase();
    const productLines = this.composeProductLines(product, amount);
    const cobradorLabel = cobrador.trim() || '-';
    const lines: string[] = [
      this.center('MUNICIPALIDAD DISTRITAL DE MARCONA', paperWidth),
      this.center('MARCONA   NASCA   ICA', paperWidth),
      this.center('RUC 20148420719', paperWidth),
      this.center('TICKET DE VENTA AGUA', paperWidth),
      reprint ? this.center('REIMPRESION', paperWidth) : '',
      '',
      separator,
      `UNIDAD: ${(companyCode || 'M004').toUpperCase()}`,
      `COBRADOR: ${cobradorLabel}`,
      separator,
      `ID: ${ticket.id}`,
      'ADQUIRIENTE',
      `DNI: ${ticket.customer}`,
      `SECTOR: ${ticket.zone}`,
      `FECHA: ${date}`,
      'MONEDA: SOLES',
      separator,
      'DESCRIPCION        P/U   TOTAL',
      ...productLines,
      `CUBOS: ${ticket.liters ?? 0}`,
      `                TOTAL  ${amount}`,
      '',
      `SON: ${this.toAmountInWords(amount)}`,
      'FORMA DE PAGO: [CONTADO]',
      '',
      this.center('CUIDAR EL AGUA ES TAREA DE TODOS', paperWidth)
    ].filter((line) => line !== '');

    return this.composeDocument(paperWidth, lines);
  }

  private composeArqueoLikeDocument(
    paperWidth: '50mm' | '58mm',
    arqueo: ArqueoDaily,
    companyCode: string
  ): string {
    const width = paperWidth === '50mm' ? 24 : 32;
    const items = arqueo.items ?? [];
    const lines: string[] = [
      this.center((companyCode || 'WATER APP').toUpperCase(), paperWidth),
      this.center('ARQUEO DIARIO', paperWidth),
      this.separatorDots(width),
      `FECHA: ${this.toDisplayDate(arqueo.date)}`,
      this.fitLabelValue('REGISTROS', `${arqueo.totalTickets}`, width),
      this.fitLabelValue('TOTAL', `S/ ${arqueo.totalAmount.toFixed(2)}`, width),
      arqueo.syncedAt ? `SYNC: ${this.toDisplayDate(arqueo.syncedAt)}` : 'SYNC: -',
      this.separatorDots(width),
      'DETALLE POR VENTA',
      ...(items.length
        ? items.flatMap((item) =>
          this.composeArqueoItemRows(
            item.customerName,
            item.productName,
            item.amount.toFixed(2),
            width
          )
        )
        : ['SIN ITEMS']),
      this.separatorDots(width),
      this.center('FIN DE ARQUEO', paperWidth)
    ];

    return this.composeDocument(paperWidth, lines);
  }

  private composeArqueoItemRows(customer: string | undefined, product: string, amount: string, width: number): string[] {
    const amountWidth = 8;
    const contentWidth = Math.max(8, width - amountWidth - 1);
    const customerLines = this.wrapText(`CLI: ${(customer || '-').toUpperCase()}`, contentWidth);
    const productLines = this.wrapText(`PROD: ${(product || 'AGUA').toUpperCase()}`, contentWidth);

    return [
      ...customerLines,
      ...productLines.map((line, index) => {
        const value = index === 0 ? amount : '';
        return `${line.padEnd(contentWidth, ' ')} ${value.padStart(amountWidth, ' ')}`;
      })
    ];
  }

  private composeDocument(paperWidth: '50mm' | '58mm', lines: string[]): string {
    const init = '\x1b\x40';
    const leftAlign = '\x1b\x61\x00';
    const body = lines.join('\r\n');
    // Use CRLF and extra feed; some embedded POS printers ignore cut commands.
    return `${init}${leftAlign}${body}\r\n\r\n\r\n\r\n`;
  }

  private separator(paperWidth: '50mm' | '58mm'): string {
    const width = paperWidth === '50mm' ? 24 : 32;
    return '-'.repeat(width);
  }

  private separatorDots(width: number): string {
    return '.'.repeat(width);
  }

  private composeProductLines(description: string, amount: string): string[] {
    const chunks = this.wrapText(description, 18);
    return chunks.map((chunk, index) => this.fitColumns(chunk, index === 0 ? amount : '', index === 0 ? amount : ''));
  }

  private wrapText(value: string, chunkSize: number): string[] {
    const clean = (value ?? '').trim();
    if (!clean) {
      return [''];
    }

    const lines: string[] = [];
    for (let i = 0; i < clean.length; i += chunkSize) {
      lines.push(clean.slice(i, i + chunkSize));
    }
    return lines;
  }

  private fitColumns(description: string, unitPrice: string, total: string): string {
    const d = (description || '').slice(0, 18);
    const u = (unitPrice || '').slice(0, 5);
    const t = (total || '').slice(0, 5);
    return `${d.padEnd(18, ' ')} ${u.padStart(5, ' ')} ${t.padStart(5, ' ')}`;
  }

  private toAmountInWords(amount: string): string {
    const normalized = (amount || '0').replace(',', '.');
    const [intPartRaw, decimalRaw = '00'] = normalized.split('.');
    const intPart = Number.parseInt(intPartRaw, 10);
    const integer = Number.isFinite(intPart) ? intPart : 0;
    const cents = `${decimalRaw}00`.slice(0, 2);
    return `${this.toSpanishInteger(integer)} CON ${cents}/100 SOLES`;
  }

  private toSpanishInteger(value: number): string {
    if (value <= 0) {
      return 'CERO';
    }

    if (value < 1000) {
      return this.toSpanishUpTo999(value);
    }

    if (value < 1_000_000) {
      const thousands = Math.floor(value / 1000);
      const remainder = value % 1000;
      const thousandsText = thousands === 1 ? 'MIL' : `${this.toSpanishUpTo999(thousands)} MIL`;
      return remainder > 0 ? `${thousandsText} ${this.toSpanishUpTo999(remainder)}` : thousandsText;
    }

    if (value < 1_000_000_000) {
      const millions = Math.floor(value / 1_000_000);
      const remainder = value % 1_000_000;
      const millionsText = millions === 1 ? 'UN MILLON' : `${this.toSpanishInteger(millions)} MILLONES`;
      if (remainder === 0) {
        return millionsText;
      }
      if (remainder < 1000) {
        return `${millionsText} ${this.toSpanishUpTo999(remainder)}`;
      }
      return `${millionsText} ${this.toSpanishInteger(remainder)}`;
    }

    return 'MONTO FUERA DE RANGO';
  }

  private toSpanishUpTo999(value: number): string {
    if (value <= 0) {
      return 'CERO';
    }

    const units = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const hundreds = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if (value === 100) {
      return 'CIEN';
    }

    const h = Math.floor(value / 100);
    const r = value % 100;
    let out = h > 0 ? `${hundreds[h]} ` : '';

    if (r < 10) {
      out += units[r];
    } else if (r < 20) {
      out += teens[r - 10];
    } else if (r < 30) {
      out += r === 20 ? 'VEINTE' : `VEINTI${units[r - 20].toLowerCase()}`;
    } else {
      const t = Math.floor(r / 10);
      const u = r % 10;
      out += tens[t];
      if (u > 0) {
        out += ` Y ${units[u]}`;
      }
    }

    return out.trim().toUpperCase();
  }

  private resolveTicketIdForAbastecimiento(abastecimiento: Abastecimiento): string {
    return abastecimiento.idLocal;
  }

  private fitLabelValue(label: string, value: string, width: number): string {
    const cleanLabel = (label || '').trim();
    const cleanValue = (value || '').trim();
    const minGap = 1;
    const free = width - cleanLabel.length - cleanValue.length;
    if (free < minGap) {
      return `${this.crop(cleanLabel, Math.max(1, width - cleanValue.length - minGap))} ${cleanValue}`;
    }
    return `${cleanLabel}${' '.repeat(free)}${cleanValue}`;
  }

  private crop(value: string, max: number): string {
    if (!value) {
      return '';
    }
    if (value.length <= max) {
      return value;
    }
    if (max <= 1) {
      return value.slice(0, max);
    }
    return `${value.slice(0, max - 1)}…`;
  }

  private toDisplayDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
  }

  private center(text: string, paperWidth: '50mm' | '58mm'): string {
    const width = paperWidth === '50mm' ? 24 : 32;
    const clean = (text ?? '').trim();
    if (clean.length >= width) {
      return clean;
    }

    const left = Math.floor((width - clean.length) / 2);
    return `${' '.repeat(left)}${clean}`;
  }

  private errorToMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim()) {
      return error;
    }

    return fallback;
  }

  private async writeWithFallback(payload: string): Promise<void> {
    const bytes = this.toAsciiBytes(payload);

    try {
      await this.bluetoothSerial.write(bytes.buffer);
      return;
    } catch {
      // Fallback to string path for bridges that don't accept ArrayBuffer.
    }

    await this.bluetoothSerial.write(payload);
  }

  private toAsciiBytes(value: string): Uint8Array {
    const output = new Uint8Array(value.length);
    for (let i = 0; i < value.length; i += 1) {
      output[i] = value.charCodeAt(i) & 0xff;
    }
    return output;
  }

  private async waitForTransportReady(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  private async tryNativePrint(payload: string): Promise<boolean> {
    try {
      const status = await PosPrinter.getNativeStatus();
      if (!status.available) {
        return false;
      }

      await PosPrinter.printRawText({ text: this.normalizeForNativePrint(payload) });
      return true;
    } catch {
      return false;
    }
  }

  private async tryNativeSemapamDocument(options: {
    docType: 'ticket' | 'arqueo';
    ticketId?: string;
    adquiriente?: string;
    sector?: string;
    fecha?: string;
    total?: string;
    unitCode?: string;
    cobrador?: string;
    productName?: string;
    syncedAt?: string;
    totalTickets?: number;
    items?: Array<{ productName: string; tickets: number; cubos: number; amount: number }>;
    reprint?: boolean;
  }): Promise<boolean> {
    try {
      const status = await PosPrinter.getNativeStatus();
      if (!status.available) {
        return false;
      }

      await PosPrinter.printSemapamDocument(options);
      return true;
    } catch {
      return false;
    }
  }

  private normalizeForNativePrint(payload: string): string {
    return payload
      .replace(/\x1b\x40/g, '')
      .replace(/\x1b\x61\x00/g, '')
      .replace(/[\x00-\x08\x0B-\x1F\x7F]/g, '')
      .replace(/\r\n/g, '\n');
  }
}
