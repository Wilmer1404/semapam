import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export type StatusDialogVariant = 'error' | 'warning' | 'success' | 'info';

export interface StatusDialogData {
  variant: StatusDialogVariant;
  title: string;
  message: string;
  buttonText: string;
  imageUrl?: string;
}

@Component({
  selector: 'app-status-dialog',
  templateUrl: './status-dialog.component.html',
  styleUrls: ['./status-dialog.component.scss']
})
export class StatusDialogComponent {
  constructor(
    @Inject(MAT_DIALOG_DATA) public data: StatusDialogData,
    private readonly dialogRef: MatDialogRef<StatusDialogComponent>
  ) {}

  close(): void {
    this.dialogRef.close(true);
  }

  get icon(): string {
    switch (this.data.variant) {
      case 'success':
        return 'check_circle';
      case 'warning':
        return 'warning';
      case 'error':
        return 'error';
      default:
        return 'info';
    }
  }
}
