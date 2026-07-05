import { Component, OnDestroy, ViewChild } from '@angular/core';
import { IonContent, ToastController } from '@ionic/angular';
import { AbastecimientoService } from '../../core/services/abastecimiento.service';
import { Product, Zone } from '../../core/models/models';
import { SyncService } from '../../core/services/sync.service';

@Component({ templateUrl: './abastecimiento.page.html', styleUrls: ['./abastecimiento.page.scss'] })
export class AbastecimientoPage implements OnDestroy {
	@ViewChild('abastecimientoContent', { static: false }) private readonly content?: IonContent;

	cantidad: number | null = null;
	recibidoPor = '';
	importe: number | null = null;
	zonaDetectada = 'Pendiente';
	zonaManualId: number | null = null;
	mostrarZonaManual = false;
	zonasDisponibles: Zone[] = [];
	productos: Product[] = [];
	selectedProductId: number | null = null;
	estadoOperacion: 'LISTO' | 'EN_CURSO' | 'FINALIZADO' = 'LISTO';
	isSaving = false;
	isResolvingZone = false;
	cronometro = '00:00:00';

	private startedAtMs: number | null = null;
	private timerId: ReturnType<typeof setInterval> | null = null;

	constructor(
		private readonly abastecimientoService: AbastecimientoService,
		private readonly syncService: SyncService,
		private readonly toastCtrl: ToastController
	) {}

	async ionViewWillEnter(): Promise<void> {
		[this.zonasDisponibles, this.productos] = await Promise.all([
			this.syncService.getZones(),
			this.syncService.getProducts()
		]);
		if (this.selectedProductId === null && this.productos.length > 0) {
			this.selectedProductId = this.productos[0].id;
		}
		this.zonaManualId = null;
		this.mostrarZonaManual = false;
		this.zonaDetectada = 'Pendiente';
		this.estadoOperacion = 'LISTO';
		this.resetCronometro();
	}

	ngOnDestroy(): void {
		this.stopCronometro();
	}

	async iniciar(): Promise<void> {
		if (!this.canStart) {
			return;
		}

		this.abastecimientoService.iniciarOperacion();
		this.estadoOperacion = 'EN_CURSO';
		this.zonaDetectada = 'Buscando zona...';
		this.zonaManualId = null;
		this.mostrarZonaManual = false;
		this.startedAtMs = Date.now();
		this.startCronometro();
		await this.resolverZona();
	}

	terminar(): void {
		if (!this.canFinish) {
			return;
		}

		this.abastecimientoService.terminarOperacion();
		this.estadoOperacion = 'FINALIZADO';
		this.stopCronometro();
		void this.scrollToTop();
	}

	get canStart(): boolean {
		return this.estadoOperacion !== 'EN_CURSO' && !this.isSaving;
	}

	get canFinish(): boolean {
		return this.estadoOperacion === 'EN_CURSO' && !this.isSaving;
	}

	async guardarImprimir(): Promise<void> {
		if (!this.cantidad || this.cantidad <= 0) {
			await this.presentToast('Ingrese los cubos a dispensar', 'warning');
			return;
		}

		if (!this.recibidoPor) {
			await this.presentToast('Ingrese el dato de recibido por', 'warning');
			return;
		}

		if (this.mostrarZonaManual && !this.zonaManualId) {
			await this.presentToast('Seleccione una zona manual de la lista', 'warning');
			return;
		}

		this.isSaving = true;
		try {
			const zonaManual = this.zonasDisponibles.find((item) => item.id === this.zonaManualId) ?? null;
			const saved = await this.abastecimientoService.saveAndPrint({
				cantidad: this.cantidad,
				recibidoPor: this.recibidoPor,
				importe: Number(this.importe ?? 0),
				productId: this.selectedProductId ?? undefined,
				zonaManualId: zonaManual?.id,
				zonaManualNombre: zonaManual?.name
			});

			this.zonaDetectada = saved.zonaNombre;
			const isSynced = saved.estadoSincronizacion === 'SYNCED';
			const isPrinted = saved.estadoImpresion === 'PRINTED';

			let toastMessage = 'Abastecimiento guardado localmente';
			let toastColor: 'success' | 'warning' = 'warning';

			if (isSynced && isPrinted) {
				toastMessage = 'Abastecimiento sincronizado e impreso';
				toastColor = 'success';
			} else if (isSynced && !isPrinted) {
				toastMessage = 'Abastecimiento sincronizado. Impresión no completada';
			} else if (!isSynced && isPrinted) {
				toastMessage = 'Abastecimiento guardado e impreso. Pendiente de sincronización';
			} else {
				toastMessage = 'Abastecimiento guardado. Pendiente de sincronización e impresión';
			}

			await this.presentToast(toastMessage, toastColor);

			this.recibidoPor = '';
			this.cantidad = null;
			this.importe = null;
			this.zonaManualId = null;
			this.mostrarZonaManual = false;
			this.estadoOperacion = 'LISTO';
			this.resetCronometro();
			await this.scrollToTop();
		} catch {
			await this.presentToast('No se pudo guardar el abastecimiento', 'danger');
		} finally {
			this.isSaving = false;
		}
	}

	private async scrollToTop(): Promise<void> {
		await this.content?.scrollToTop(350);
	}

	onZonaManualChange(): void {
		const zona = this.zonasDisponibles.find((item) => item.id === this.zonaManualId);
		if (zona) {
			this.zonaDetectada = zona.name;
		}
	}

	private async resolverZona(): Promise<void> {
		this.isResolvingZone = true;
		try {
			const resolution = await this.abastecimientoService.captureGpsAndMatchZone();
			if (resolution.zone) {
				this.zonaDetectada = resolution.zone.name;
				this.mostrarZonaManual = false;
				this.zonaManualId = null;
				return;
			}

			this.mostrarZonaManual = true;
			this.zonaDetectada = this.zonasDisponibles.length
				? 'Zona no encontrada. Seleccione una zona.'
				: 'No hay zonas descargadas';

			if (resolution.reason === 'gps-error') {
				await this.presentToast(
					resolution.details?.trim() || 'No se pudo obtener ubicación. Revise GPS y permisos.',
					'danger'
				);
			} else if (resolution.reason === 'no-zones') {
				await this.presentToast(
					'No hay zonas en caché local. Vaya al tab Sync y descargue catálogos.',
					'warning'
				);
			} else if (resolution.reason === 'no-polygon-match') {
				await this.presentToast(
					'GPS obtenido, pero la coordenada no cayó dentro de los polígonos locales.',
					'warning'
				);
			}

			if (!this.zonasDisponibles.length) {
				await this.presentToast('No hay zonas descargadas para seleccionar manualmente', 'warning');
			}
		} finally {
			this.isResolvingZone = false;
		}
	}

	private startCronometro(): void {
		this.stopCronometro();
		this.updateCronometro();
		this.timerId = setInterval(() => this.updateCronometro(), 1000);
	}

	private stopCronometro(): void {
		if (this.timerId) {
			clearInterval(this.timerId);
			this.timerId = null;
		}
	}

	private resetCronometro(): void {
		this.stopCronometro();
		this.startedAtMs = null;
		this.cronometro = '00:00:00';
	}

	private updateCronometro(): void {
		if (!this.startedAtMs) {
			this.cronometro = '00:00:00';
			return;
		}

		const totalSeconds = Math.floor((Date.now() - this.startedAtMs) / 1000);
		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;
		this.cronometro = [hours, minutes, seconds]
			.map((value) => String(value).padStart(2, '0'))
			.join(':');
	}

	private async presentToast(message: string, color: 'success' | 'warning' | 'danger' | 'medium'): Promise<void> {
		const toast = await this.toastCtrl.create({ message, duration: 1800, color });
		await toast.present();
	}
}
