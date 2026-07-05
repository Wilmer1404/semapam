import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { StatusDialogComponent, StatusDialogData, StatusDialogVariant } from '@shared/components/status-dialog/status-dialog.component';

export interface OpenStatusDialogOptions {
  variant?: StatusDialogVariant;
  title: string;
  message: string;
  buttonText?: string;
  imageUrl?: string;
  disableClose?: boolean;
}

@Injectable({ providedIn: 'root' })
export class StatusDialogService {
  private readonly defaultImageByVariant: Record<StatusDialogVariant, string> = {
    warning: 'assets/Gota_animada_con_señal_de_alerta.png',
    success: 'assets/Gota_sonriente_con_signo_de_aprobación.png',
    error: 'assets/Gota_triste_con_señal_de_advertencia.png',
    info: 'assets/Gota_animada_con_señal_de_alerta.png'
  };

  constructor(private readonly dialog: MatDialog) {}

  open(options: OpenStatusDialogOptions): void {
    const variant = options.variant ?? 'info';
    const data: StatusDialogData = {
      variant,
      title: options.title,
      message: options.message,
      buttonText: options.buttonText ?? 'Entendido',
      imageUrl: options.imageUrl ?? this.defaultImageByVariant[variant]
    };

    this.dialog.open(StatusDialogComponent, {
      width: '460px',
      maxWidth: '92vw',
      autoFocus: 'dialog',
      restoreFocus: true,
      disableClose: options.disableClose ?? false,
      data
    });
  }
}
