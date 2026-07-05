import { Injectable } from '@angular/core';
import { APP_CONSTANTS } from '../../shared/constants/app.constants';
import {
  BluetoothPairedDevice,
  DEFAULT_PRINTER_CONFIG,
  PaperWidth,
  PrinterConfig,
  PrinterStatus,
  PrinterValidation
} from '../../shared/interfaces/printer-config.interface';
import { LocalStorageService } from './local-storage.service';
import { DeviceService } from './device.service';

@Injectable({ providedIn: 'root' })
export class PrinterConfigService {
  constructor(
    private readonly storage: LocalStorageService,
    private readonly deviceService: DeviceService
  ) {}

  async getConfig(): Promise<PrinterConfig> {
    const saved = await this.storage.get<PrinterConfig>(APP_CONSTANTS.storageKeys.printerConfig);
    if (!saved) {
      return { ...DEFAULT_PRINTER_CONFIG };
    }

    return {
      ...DEFAULT_PRINTER_CONFIG,
      ...saved,
      posBluetoothMac: this.deviceService.normalizeMac(saved.posBluetoothMac),
      printerMac: this.deviceService.normalizeMac(saved.printerMac)
    };
  }

  async saveConfig(next: Partial<PrinterConfig>): Promise<PrinterConfig> {
    const current = await this.getConfig();
    const merged: PrinterConfig = {
      ...current,
      ...next,
      posBluetoothMac: this.deviceService.normalizeMac(next.posBluetoothMac ?? current.posBluetoothMac),
      printerMac: this.deviceService.normalizeMac(next.printerMac ?? current.printerMac),
      updatedAt: new Date().toISOString()
    };

    await this.storage.set(APP_CONSTANTS.storageKeys.printerConfig, merged);
    return merged;
  }

  async setSelectedPrinter(device: BluetoothPairedDevice): Promise<PrinterConfig> {
    return this.saveConfig({ printerName: device.name, printerMac: device.mac });
  }

  async setCompanyCode(companyCode: string): Promise<PrinterConfig> {
    return this.saveConfig({ companyCode: companyCode.trim() });
  }

  async setPaperWidth(paperWidth: PaperWidth): Promise<PrinterConfig> {
    return this.saveConfig({ paperWidth });
  }

  async ensurePosBluetoothMac(): Promise<PrinterConfig> {
    const config = await this.getConfig();
    const detectedMac = await this.deviceService.getPosBluetoothMac();
    if (!detectedMac) {
      return config;
    }

    if (config.posBluetoothMac === detectedMac) {
      return config;
    }

    return this.saveConfig({ posBluetoothMac: detectedMac });
  }

  async validateConfiguredPrinter(): Promise<PrinterValidation> {
    const config = await this.getConfig();

    if (!config.printerMac) {
      return {
        status: 'NOT_CONFIGURED',
        message: 'No hay impresora configurada.',
        configuredPrinter: null
      };
    }

    const bluetoothEnabled = await this.deviceService.isBluetoothEnabled();
    if (!bluetoothEnabled) {
      return {
        status: 'UNAVAILABLE',
        message: 'Bluetooth del equipo esta apagado.',
        configuredPrinter: { name: config.printerName || 'Impresora', mac: config.printerMac }
      };
    }

    const paired = await this.deviceService.findPairedDevice(config.printerMac);
    if (!paired) {
      return {
        status: 'UNPAIRED',
        message: 'La impresora configurada fue desvinculada del equipo.',
        configuredPrinter: { name: config.printerName || 'Impresora', mac: config.printerMac }
      };
    }

    return {
      status: 'AVAILABLE',
      message: 'Impresora lista para imprimir.',
      configuredPrinter: paired
    };
  }

  statusToTone(status: PrinterStatus): 'success' | 'warning' | 'danger' | 'primary' {
    if (status === 'AVAILABLE') {
      return 'success';
    }

    if (status === 'NOT_CONFIGURED') {
      return 'warning';
    }

    if (status === 'UNPAIRED' || status === 'ERROR') {
      return 'danger';
    }

    return 'primary';
  }
}
