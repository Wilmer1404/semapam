import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { ArqueoDaily } from '../../core/models/models';
import { ArqueoService } from '../../core/services/arqueo.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { getLocalDateKey } from '../../shared/utils/date.utils';

@Component({
	templateUrl: './arqueo.page.html',
	styleUrls: ['./arqueo.page.scss']
})
export class ArqueoPage {
	data: ArqueoDaily = {
		date: getLocalDateKey(),
		totalTickets: 0,
		totalAmount: 0
	};
	isOnline = false;
	showFilterModal = false;
	selectedDate = this.todayKey();
	tooltipOpen = false;
	tooltipTitle = '';
	tooltipValue = '';
	tooltipTop = '0px';
	tooltipLeft = '0px';

	private readonly subscriptions = new Subscription();

	constructor(
		private readonly arqueoService: ArqueoService,
		private readonly connectivity: ConnectivityService,
		private readonly toastCtrl: ToastController
	) {
		this.subscriptions.add(this.connectivity.online$.subscribe((online) => (this.isOnline = online)));
	}

	async ionViewWillEnter(): Promise<void> {
		await this.loadArqueo();
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}

	async print(): Promise<void> {
		try {
			await this.arqueoService.printDailyArqueo(this.data);
			await this.presentToast('Arqueo enviado a impresión', 'success');
		} catch {
			await this.presentToast('No se pudo imprimir arqueo', 'danger');
		}
	}

	openFilterModal(): void {
		this.showFilterModal = true;
	}

	closeFilterModal(): void {
		this.showFilterModal = false;
	}

	async applyDateFilter(date: string): Promise<void> {
		if (!this.isOnline && date !== this.todayKey()) {
			await this.presentToast('Sin internet solo puedes consultar arqueo del día.', 'danger');
			return;
		}

		this.selectedDate = date;
		this.showFilterModal = false;
		await this.loadArqueo();
	}

	async resetTodayFilter(): Promise<void> {
		this.selectedDate = this.todayKey();
		this.showFilterModal = false;
		await this.loadArqueo();
	}

	showCellDetail(event: Event, title: string, value?: string): void {
		const target = event.currentTarget as HTMLElement | null;
		if (!target) {
			return;
		}

		const content = (value ?? '').trim() || '-';
		const rect = target.getBoundingClientRect();
		const tooltipWidth = 248;
		const margin = 12;
		const left = Math.max(margin, Math.min(rect.left, window.innerWidth - tooltipWidth - margin));
		const top = Math.min(rect.bottom + 8, window.innerHeight - 120);

		this.tooltipTitle = title;
		this.tooltipValue = content;
		this.tooltipLeft = `${left}px`;
		this.tooltipTop = `${top}px`;
		this.tooltipOpen = true;
	}

	hideCellDetail(): void {
		this.tooltipOpen = false;
	}

	private async loadArqueo(): Promise<void> {
		try {
			this.data = await this.arqueoService.getDailyArqueo(this.selectedDate);
		} catch (error) {
			await this.presentToast(error instanceof Error ? error.message : 'No se pudo cargar arqueo', 'danger');
		}
	}

	private todayKey(): string {
		return getLocalDateKey();
	}

	private async presentToast(message: string, color: 'success' | 'danger'): Promise<void> {
		const toast = await this.toastCtrl.create({ message, duration: 1800, color });
		await toast.present();
	}
}
