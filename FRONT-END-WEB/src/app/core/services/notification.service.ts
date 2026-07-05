import { Injectable, inject } from '@angular/core';
import { StatusDialogService } from './status-dialog.service';

@Injectable({ providedIn: 'root' })
export class NotificationService {
	private readonly statusDialog = inject(StatusDialogService);

	success(message: string, title = 'Operacion exitosa'): void {
		this.statusDialog.open({
			variant: 'success',
			title,
			message,
			buttonText: 'Continuar'
		});
	}

	error(message: string, title = 'Ocurrio un error'): void {
		this.statusDialog.open({
			variant: 'error',
			title,
			message,
			buttonText: 'Entendido'
		});
	}

	warning(message: string, title = 'Atencion'): void {
		this.statusDialog.open({
			variant: 'warning',
			title,
			message,
			buttonText: 'Entendido'
		});
	}
}
