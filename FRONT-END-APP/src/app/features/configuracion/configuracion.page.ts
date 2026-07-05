import { Component } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { AlertController, ToastController } from '@ionic/angular';
import { PrinterService } from '../../core/services/printer.service';
import { DeviceService } from '../../core/services/device.service';
import { PrinterConfigService } from '../../core/services/printer-config.service';
import { BluetoothPrinterAdapter } from '../../core/adapters/bluetooth-printer.adapter';
import {
	PosPrinter,
	PosPrinterCandidate,
	PosPrinterNativeStatus,
	PosPrinterProbeResult
} from '../../core/native/pos-printer.plugin';
import {
  BluetoothPairedDevice,
  DEFAULT_PRINTER_CONFIG,
  PaperWidth,
  PrinterConfig,
  PrinterStatus,
  PrinterValidation
} from '../../shared/interfaces/printer-config.interface';

@Component({ templateUrl: './configuracion.page.html' })
export class ConfiguracionPage {
	config: PrinterConfig = { ...DEFAULT_PRINTER_CONFIG };
	printerStatus: PrinterStatus = 'NOT_CONFIGURED';
	printerStatusMessage = 'Sin validacion';
	pairedDevices: BluetoothPairedDevice[] = [];
	isSelectorOpen = false;
	isLoading = false;
	isTesting = false;
	isSaving = false;

	readonly paperWidths: PaperWidth[] = ['50mm', '58mm'];
	readonly statusLabels: Record<PrinterStatus, string> = {
		NOT_CONFIGURED: 'No configurada',
		AVAILABLE: 'Disponible',
		UNAVAILABLE: 'No disponible',
		UNPAIRED: 'Desvinculada',
		ERROR: 'Error'
	};

	constructor(
		public auth: AuthService,
		private readonly printer: PrinterService,
		private readonly bluetoothAdapter: BluetoothPrinterAdapter,
		private readonly printerConfig: PrinterConfigService,
		private readonly deviceService: DeviceService,
		private readonly toastCtrl: ToastController,
		private readonly alertCtrl: AlertController
	) {}

	async ionViewWillEnter(): Promise<void> {
		await this.refreshConfiguration();
	}

	async testPrint(): Promise<void> {
		this.isTesting = true;
		try {
			await this.runPrintDiagnostics();
			await this.presentToast('Paso 4/5: enviando prueba de impresion...', 'medium', 1400);
			const result = await this.printer.testPrint();
			this.applyValidation(result);

			if (result.status === 'AVAILABLE') {
				await this.presentToast('Paso 5/5: datos enviados a la impresora. Debe salir papel en 1-2s.', 'success', 2600);
			} else {
				await this.presentToast(`Paso 5/5: ${result.message}`, 'warning', 2600);
			}
		} catch (error) {
			await this.presentToast(this.errorToMessage(error, 'No se pudo ejecutar la prueba de impresion'), 'danger');
		} finally {
			this.isTesting = false;
		}
	}

	async openPrinterSelector(): Promise<void> {
		this.pairedDevices = await this.deviceService.listPairedDevices();
		this.isSelectorOpen = true;
	}

	closePrinterSelector(): void {
		this.isSelectorOpen = false;
	}

	async selectPrinter(device: BluetoothPairedDevice): Promise<void> {
		this.config = await this.printerConfig.setSelectedPrinter(device);
		this.closePrinterSelector();
		await this.validatePrinterStatus();
		await this.presentToast('Impresora seleccionada correctamente', 'success');
	}

	async debugPrint(): Promise<void> {
		this.isTesting = true;
		let lines: string[] = [];
		try {
			lines = await this.bluetoothAdapter.debugWrite();
		} catch (error) {
			lines = [`Excepcion inesperada: ${this.errorToMessage(error, 'desconocido')}`];
		} finally {
			this.isTesting = false;
		}

		const alert = await this.alertCtrl.create({
			header: 'Debug de impresion',
			message: lines.join('\n'),
			cssClass: 'diagnostic-alert',
			buttons: ['Cerrar']
		});
		await alert.present();
	}

	async inspectNativePrinter(): Promise<void> {
		this.isTesting = true;
		let lines: string[] = [];
		try {
			const probe = await PosPrinter.probe();
			lines = this.formatNativeProbe(probe);
		} catch (error) {
			lines = [this.errorToMessage(error, 'No se pudo inspeccionar el stack nativo de impresion.')];
		} finally {
			this.isTesting = false;
		}

		const alert = await this.alertCtrl.create({
			header: 'Plugin nativo POS',
			message: lines.join('\n'),
			cssClass: 'diagnostic-alert',
			buttons: ['Cerrar']
		});
		await alert.present();
	}

	async nativePrintTest(): Promise<void> {
		this.isTesting = true;
		const lines: string[] = [];
		try {
			const mac = this.deviceService.normalizeMac(this.config.printerMac);
			const paired = mac ? await this.deviceService.findPairedDevice(mac) : null;
			lines.push(`MAC configurada: ${mac || '-'}`);
			lines.push(`Emparejada en Bluetooth: ${paired ? `SI (${paired.name})` : 'NO'}`);

			const before = await PosPrinter.getNativeStatus();
			lines.push(this.formatNativeStatus('Estado nativo antes', before));
			if (!before.available) {
				lines.push('Driver nativo no disponible/listo. No se envio prueba.');
			} else {
				const stamp = new Date().toLocaleString();
				await PosPrinter.printRawText({
					text: `WATER APP - PRUEBA NATIVA ZCS\n${stamp}\nEmpresa: ${this.config.companyCode || '-'}\n\n\n`
				});
				lines.push('Envio nativo: OK');
				const after = await PosPrinter.getNativeStatus();
				lines.push(this.formatNativeStatus('Estado nativo despues', after));
			}
		} catch (error) {
			lines.push(`Error en prueba nativa: ${this.errorToMessage(error, 'desconocido')}`);
		} finally {
			this.isTesting = false;
		}

		const alert = await this.alertCtrl.create({
			header: 'Prueba nativa ZCS',
			message: lines.join('\n'),
			cssClass: 'diagnostic-alert',
			buttons: ['Cerrar']
		});
		await alert.present();
	}

	async runPrinterDiagnosticOnly(): Promise<void> {
		this.isTesting = true;
		try {
			await this.runPrintDiagnostics();
			await this.validatePrinterStatus();
			await this.presentToast('Diagnostico finalizado: la impresora esta lista para prueba.', 'success', 2000);
		} catch (error) {
			await this.presentToast(this.errorToMessage(error, 'El diagnostico encontro un problema.'), 'danger', 2600);
		} finally {
			this.isTesting = false;
		}
	}

	async saveChanges(): Promise<void> {
		this.isSaving = true;
		try {
			this.config = await this.printerConfig.saveConfig({
				companyCode: this.config.companyCode,
				paperWidth: this.config.paperWidth,
				printerName: this.config.printerName,
				printerMac: this.config.printerMac,
				posBluetoothMac: this.config.posBluetoothMac
			});

			await this.validatePrinterStatus();
			await this.presentToast('Configuracion guardada correctamente', 'success');
		} catch (error) {
			await this.presentToast(this.errorToMessage(error, 'No se pudo guardar configuracion'), 'danger');
		} finally {
			this.isSaving = false;
		}
	}

	async logout(): Promise<void> {
		await this.auth.logout();
	}

	statusTone(): 'success' | 'warning' | 'danger' | 'primary' {
		return this.printerConfig.statusToTone(this.printerStatus);
	}

	private async refreshConfiguration(): Promise<void> {
		this.isLoading = true;
		try {
			this.config = await this.printerConfig.ensurePosBluetoothMac();
			await this.validatePrinterStatus();
		} catch (error) {
			this.printerStatus = 'ERROR';
			this.printerStatusMessage = this.errorToMessage(error, 'No se pudo cargar configuracion');
		} finally {
			this.isLoading = false;
		}
	}

	private async validatePrinterStatus(): Promise<void> {
		const validation = await this.printer.validatePrinter();
		this.applyValidation(validation);
	}

	private async runPrintDiagnostics(): Promise<void> {
		await this.presentToast('Paso 1/5: validando entorno Android...', 'medium', 1200);
		if (!this.deviceService.supportsBluetoothClassic()) {
			throw new Error('Este equipo no soporta Bluetooth clasico para impresion.');
		}

		await this.presentToast('Paso 2/5: validando Bluetooth encendido...', 'medium', 1200);
		const bluetoothEnabled = await this.deviceService.isBluetoothEnabled();
		if (!bluetoothEnabled) {
			throw new Error('Bluetooth esta apagado. Enciendelo desde Ajustes del POS.');
		}

		await this.presentToast('Paso 3/5: validando impresora configurada...', 'medium', 1400);
		const printerMac = this.deviceService.normalizeMac(this.config.printerMac);
		if (!printerMac) {
			throw new Error('No hay MAC de impresora configurada. Selecciona una impresora primero.');
		}

		const pairedDevice = await this.deviceService.findPairedDevice(printerMac);
		if (!pairedDevice) {
			throw new Error(`La impresora ${printerMac} no esta emparejada con el POS.`);
		}

		const connected = await this.printer.connect(printerMac);
		await this.printer.disconnectSafe();
		if (!connected) {
			const maybeBle = this.deviceService.isLikelyRandomBleAddress(printerMac);
			const hint = maybeBle
				? ' La MAC parece aleatoria (tipica BLE), y Bluetooth clasico RFCOMM/SPP puede no estar disponible en ese dispositivo.'
				: '';

			throw new Error(`No se pudo abrir conexion RFCOMM (segura/insegura) con la impresora. Verifica perfil SPP, PIN y vuelve a emparejar.${hint}`);
		}
	}

	private applyValidation(validation: PrinterValidation): void {
		this.printerStatus = validation.status;
		this.printerStatusMessage = validation.message;

		if (validation.configuredPrinter) {
			this.config.printerName = validation.configuredPrinter.name || this.config.printerName;
			this.config.printerMac = validation.configuredPrinter.mac || this.config.printerMac;
		}
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

	private formatNativeProbe(probe: PosPrinterProbeResult): string[] {
		const lines: string[] = [
			`Fabricante: ${probe.manufacturer || '-'}`,
			`Marca: ${probe.brand || '-'}`,
			`Modelo: ${probe.model || '-'}`,
			`Android: ${probe.androidRelease || '-'} (SDK ${probe.sdkInt ?? '-'})`
		];

		if (probe.resolvedActions.length) {
			lines.push('Servicios AIDL conocidos detectados:');
			for (const item of probe.resolvedActions.slice(0, 5)) {
				lines.push(`- ${item.action} -> ${item.packageName}`);
			}
		} else {
			lines.push('Servicios AIDL conocidos detectados: ninguno');
		}

		if (probe.candidates.length) {
			lines.push('Candidatos de impresion/POS:');
			for (const candidate of probe.candidates.slice(0, 6)) {
				lines.push(this.formatCandidate(candidate));
			}
		} else {
			lines.push('Candidatos de impresion/POS: ninguno');
		}

		if (probe.launcherApps.length) {
			lines.push('Apps visibles relacionadas:');
			for (const app of probe.launcherApps.slice(0, 4)) {
				lines.push(`- ${app.label} (${app.packageName})`);
			}
		}

		lines.push('Si aparece un paquete del fabricante o un print service, con eso armamos el plugin de impresion real.');
		return lines;
	}

	private formatCandidate(candidate: PosPrinterCandidate): string {
		const kind = candidate.systemApp ? 'system' : 'user';
		const reasons = candidate.reasons?.slice(0, 3).join(', ') || 'sin match';
		return `- ${candidate.label || candidate.packageName} [${kind}] (${candidate.packageName}) score=${candidate.score}; ${reasons}`;
	}

	private formatNativeStatus(label: string, status: PosPrinterNativeStatus): string {
		const code = status.statusCode ?? '-';
		const text = status.statusMessage || status.message || '-';
		const avail = status.available ? 'SI' : 'NO';
		return `${label}: disponible=${avail}, code=${code}, detalle=${text}`;
	}

	private async presentToast(
		message: string,
		color: 'success' | 'warning' | 'danger' | 'medium',
		duration = 1800
	): Promise<void> {
		const toast = await this.toastCtrl.create({ message, duration, color });
		await toast.present();
	}
}
