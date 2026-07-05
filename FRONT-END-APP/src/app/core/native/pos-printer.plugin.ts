import { registerPlugin } from '@capacitor/core';

export interface PosPrinterCandidate {
  packageName: string;
  label: string;
  score: number;
  systemApp: boolean;
  services: string[];
  activities: string[];
  reasons: string[];
}

export interface PosPrinterResolvedAction {
  action: string;
  packageName: string;
  serviceName: string;
}

export interface PosPrinterLauncherApp {
  label: string;
  packageName: string;
  activityName: string;
}

export interface PosPrinterProbeResult {
  manufacturer: string;
  brand: string;
  model: string;
  device: string;
  product: string;
  hardware: string;
  androidRelease: string;
  sdkInt: number;
  zcsNativeAvailable?: boolean;
  candidates: PosPrinterCandidate[];
  resolvedActions: PosPrinterResolvedAction[];
  launcherApps: PosPrinterLauncherApp[];
}

export interface PosPrinterNativeStatus {
  available: boolean;
  zcsLikeDevice?: boolean;
  manufacturer?: string;
  model?: string;
  statusCode?: number;
  statusMessage?: string;
  message?: string;
}

export interface PosPrinterRawPrintOptions {
  text: string;
}

export interface PosPrinterSemapamDocumentOptions {
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
  items?: Array<{
    productName: string;
    tickets: number;
    cubos: number;
    amount: number;
  }>;
  reprint?: boolean;
}

export interface PosPrinterPlugin {
  probe(): Promise<PosPrinterProbeResult>;
  getNativeStatus(): Promise<PosPrinterNativeStatus>;
  printRawText(options: PosPrinterRawPrintOptions): Promise<{ success: boolean; message?: string }>;
  printSemapamDocument(options: PosPrinterSemapamDocumentOptions): Promise<{ success: boolean; message?: string }>;
}

export const PosPrinter = registerPlugin<PosPrinterPlugin>('PosPrinter');
