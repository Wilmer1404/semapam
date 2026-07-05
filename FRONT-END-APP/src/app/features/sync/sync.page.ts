import { Component, OnDestroy } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { SyncService } from '../../core/services/sync.service';
import { TicketsService } from '../../core/services/tickets.service';
import { ArqueoService } from '../../core/services/arqueo.service';

@Component({ templateUrl: './sync.page.html', styleUrls: ['./sync.page.scss'] })
export class SyncPage implements OnDestroy {
	isOnline = false;
	pendingCount = 0;
	lastSyncAt: string | null = null;
	zonesCount = 0;
	productsCount = 0;
	ticketsCount = 0;
	isBusy = false;

	private readonly subscriptions = new Subscription();

	constructor(
		private readonly connectivity: ConnectivityService,
		private readonly syncService: SyncService,
		private readonly ticketsService: TicketsService,
		private readonly arqueoService: ArqueoService,
		private readonly toastCtrl: ToastController
	) {
		this.subscriptions.add(this.connectivity.online$.subscribe((online) => (this.isOnline = online)));
		this.subscriptions.add(
			this.syncService.pendingCount$.subscribe((pending) => (this.pendingCount = pending))
		);
		this.subscriptions.add(
			this.syncService.lastSyncAt$.subscribe((stamp) => (this.lastSyncAt = stamp))
		);
	}

	async ionViewWillEnter(): Promise<void> {
		await this.loadDashboard();
	}

	async syncNow(): Promise<void> {
		this.isBusy = true;
		try {
			const result = await this.syncService.syncPendingAbastecimientos();
			await this.presentToast(
				`Sincronizados: ${result.synced} · Fallidos: ${result.failed}`,
				result.failed ? 'warning' : 'success'
			);
			await this.loadDashboard();
		} catch {
			await this.presentToast('No se pudo ejecutar la sincronización', 'danger');
		} finally {
			this.isBusy = false;
		}
	}

	async downloadCatalogs(): Promise<void> {
		this.isBusy = true;
		try {
			const [result, tickets, arqueo] = await Promise.all([
				this.syncService.downloadCatalogs(),
				this.ticketsService.getTickets(),
				this.arqueoService.getDailyArqueo()
			]);
			await this.presentToast(
				`Datos listos (${result.products} productos, ${result.zones} zonas, ${tickets.length} tickets, arqueo ${arqueo.date})`,
				result.from === 'remote' ? 'success' : 'medium'
			);
			await this.loadDashboard();
		} catch {
			await this.presentToast('Error descargando catálogos', 'danger');
		} finally {
			this.isBusy = false;
		}
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}

	private async loadDashboard(): Promise<void> {
		const [zones, products, pending, tickets] = await Promise.all([
			this.syncService.getZones(),
			this.syncService.getProducts(),
			this.syncService.getPendingCount(),
			this.ticketsService.getTickets().catch(() => [])
		]);

		this.zonesCount = zones.length;
		this.productsCount = products.length;
		this.pendingCount = pending;
		this.ticketsCount = tickets.length;
	}

	private async presentToast(message: string, color: 'success' | 'warning' | 'danger' | 'medium'): Promise<void> {
		const toast = await this.toastCtrl.create({ message, duration: 1800, color });
		await toast.present();
	}
}
