export type PrinterStatus = 'NOT_CONFIGURED' | 'AVAILABLE' | 'UNAVAILABLE' | 'UNPAIRED' | 'ERROR';

export type PaperWidth = '50mm' | '58mm';

export interface PrinterConfig {
  posBluetoothMac: string;
  printerName: string;
  printerMac: string;
  companyCode: string;
  paperWidth: PaperWidth;
  updatedAt: string;
}

export interface BluetoothPairedDevice {
  name: string;
  mac: string;
}

export interface PrinterValidation {
  status: PrinterStatus;
  message: string;
  configuredPrinter: BluetoothPairedDevice | null;
}

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  posBluetoothMac: '',
  printerName: '',
  printerMac: '',
  companyCode: '',
  paperWidth: '58mm',
  updatedAt: ''
};
