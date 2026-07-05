import { Abastecimiento, ArqueoDaily, Ticket } from '../models/models';
import { PrinterValidation } from '../../shared/interfaces/printer-config.interface';

export interface PrinterAdapter {
  isAvailable(): Promise<boolean>;
  validatePrinter(): Promise<PrinterValidation>;
  printTicket(ticket: Ticket): Promise<void>;
  reprintTicket(ticket: Ticket): Promise<void>;
  printAbastecimiento(abastecimiento: Abastecimiento): Promise<void>;
  printArqueo(arqueo: ArqueoDaily): Promise<void>;
  testPrint(): Promise<PrinterValidation>;
  connect(mac: string): Promise<boolean>;
  disconnectSafe(): Promise<void>;
}
