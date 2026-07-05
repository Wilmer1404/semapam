import { Component } from '@angular/core';
import { ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { Ticket } from '../../core/models/models';
import { TicketsService } from '../../core/services/tickets.service';
import { ConnectivityService } from '../../core/services/connectivity.service';
import { getLocalDateKey } from '../../shared/utils/date.utils';

@Component({
	templateUrl: './tickets.page.html',
	styleUrls: ['./tickets.page.scss']
})
export class TicketsPage {
	tickets: Ticket[] = [];
	loading = false;
	isOnline = false;
	showFilterModal = false;
	selectedDate = getLocalDateKey();

	private readonly subscriptions = new Subscription();

	constructor(
		private readonly ticketsService: TicketsService,
		private readonly connectivity: ConnectivityService,
		private readonly toastCtrl: ToastController
	) {
		this.subscriptions.add(this.connectivity.online$.subscribe((online) => (this.isOnline = online)));
	}

	async ionViewWillEnter(): Promise<void> {
		await this.loadTickets();
	}

	ionViewWillLeave(): void {
		this.showFilterModal = false;
	}

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}

	async reprint(ticket: Ticket): Promise<void> {
		try {
			await this.ticketsService.reprint(ticket);
			await this.presentToast('Reimpresión enviada', 'success');
		} catch {
			await this.presentToast('No se pudo reimprimir', 'danger');
		}
	}

	isSynced(ticket: Ticket): boolean {
		return ticket.status === 'SYNCED';
	}

	openFilterModal(): void {
		this.showFilterModal = true;
	}

	closeFilterModal(): void {
		this.showFilterModal = false;
	}

	async applyDateFilter(date: string): Promise<void> {
		if (!this.isOnline && date !== this.todayKey()) {
			await this.presentToast('Sin internet solo puedes consultar tickets del día.', 'danger');
			return;
		}

		this.selectedDate = date;
		this.showFilterModal = false;
		await this.loadTickets();
	}

	resetTodayFilter(): Promise<void> {
		this.selectedDate = this.todayKey();
		this.showFilterModal = false;
		return this.loadTickets();
	}

	private async loadTickets(): Promise<void> {
		this.loading = true;
		try {
			this.tickets = await this.ticketsService.getTickets(this.selectedDate);
		} catch (error) {
			const message = error instanceof Error ? error.message : 'No se pudo cargar tickets.';
			await this.presentToast(message, 'danger');
			if (!this.isOnline && this.selectedDate !== this.todayKey()) {
				this.selectedDate = this.todayKey();
				this.tickets = await this.ticketsService.getTickets(this.selectedDate);
			}
		} finally {
			this.loading = false;
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
