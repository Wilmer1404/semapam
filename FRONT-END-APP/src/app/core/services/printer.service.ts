import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Abastecimiento, ArqueoDaily, Ticket } from '../models/models';
import { PrinterValidation } from '../../shared/interfaces/printer-config.interface';
import { PrinterAdapter } from '../adapters/printer-adapter.interface';
import { BluetoothPrinterAdapter } from '../adapters/bluetooth-printer.adapter';

class ConsolePrinterAdapter implements PrinterAdapter {
  async isAvailable(): Promise<boolean> {
    return false;
  }

  async validatePrinter(): Promise<PrinterValidation> {
    return {
      status: 'ERROR',
      message: 'Impresora Bluetooth no disponible en este entorno.',
      configuredPrinter: null
    };
  }

  async printTicket(_ticket: Ticket): Promise<void> {
    throw new Error('Impresora no disponible en este entorno.');
  }

  async reprintTicket(_ticket: Ticket): Promise<void> {
    throw new Error('Impresora no disponible en este entorno.');
  }

  async printAbastecimiento(_abastecimiento: Abastecimiento): Promise<void> {
    throw new Error('Impresora no disponible en este entorno.');
  }

  async printArqueo(_arqueo: ArqueoDaily): Promise<void> {
    throw new Error('Impresora no disponible en este entorno.');
  }

  async testPrint(): Promise<PrinterValidation> {
    return {
      status: 'ERROR',
      message: 'No se puede imprimir en este entorno.',
      configuredPrinter: null
    };
  }

  async connect(_: string): Promise<boolean> {
    return false;
  }

  async disconnectSafe(): Promise<void> {
    return;
  }
}

@Injectable({ providedIn: 'root' })
export class PrinterService {
  private adapter: PrinterAdapter;

  constructor(private readonly bluetoothPrinterAdapter: BluetoothPrinterAdapter) {
    this.adapter = Capacitor.getPlatform() === 'android'
      ? this.bluetoothPrinterAdapter
      : new ConsolePrinterAdapter();
  }

  setAdapter(adapter: PrinterAdapter): void {
    this.adapter = adapter;
  }

  isAvailable(): Promise<boolean> {
    return this.adapter.isAvailable();
  }

  validatePrinter(): Promise<PrinterValidation> {
    return this.adapter.validatePrinter();
  }

  testPrint(): Promise<PrinterValidation> {
    return this.adapter.testPrint();
  }

  connect(mac: string): Promise<boolean> {
    return this.adapter.connect(mac);
  }

  disconnectSafe(): Promise<void> {
    return this.adapter.disconnectSafe();
  }

  async printTicket(ticket: Ticket): Promise<void> {
    try {
      await this.adapter.printTicket(ticket);
    } catch (error) {
      console.error('[PRINTER] printTicket failed', error);
      throw error;
    }
  }

  async reprintTicket(ticket: Ticket): Promise<void> {
    try {
      await this.adapter.reprintTicket(ticket);
    } catch (error) {
      console.error('[PRINTER] reprintTicket failed', error);
      throw error;
    }
  }

  async printAbastecimiento(abastecimiento: Abastecimiento): Promise<void> {
    try {
      await this.adapter.printAbastecimiento(abastecimiento);
    } catch (error) {
      console.error('[PRINTER] printAbastecimiento failed', error);
      throw error;
    }
  }

  async printArqueo(arqueo: ArqueoDaily): Promise<void> {
    try {
      await this.adapter.printArqueo(arqueo);
    } catch (error) {
      console.error('[PRINTER] printArqueo failed', error);
      throw error;
    }
  }
}
