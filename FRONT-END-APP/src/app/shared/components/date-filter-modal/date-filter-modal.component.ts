import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';

@Component({
  selector: 'app-date-filter-modal',
  templateUrl: './date-filter-modal.component.html',
  styleUrls: ['./date-filter-modal.component.scss']
})
export class DateFilterModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() title = 'Filtrar por fecha';
  @Input() isOnline = false;
  @Input() selectedDate = '';

  @Output() dismiss = new EventEmitter<void>();
  @Output() apply = new EventEmitter<string>();
  @Output() resetToday = new EventEmitter<void>();

  tempDate = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedDate']) {
      this.tempDate = this.selectedDate;
    }
  }

  onDismiss(): void {
    this.dismiss.emit();
  }

  onApply(): void {
    const value = this.toDateKey(this.tempDate || this.selectedDate);
    this.apply.emit(value);
  }

  onResetToday(): void {
    this.resetToday.emit();
  }

  onDateChange(value: string | null | undefined): void {
    this.tempDate = this.toDateKey(value || this.selectedDate);
  }

  private toDateKey(value: string): string {
    return (value || '').toString().slice(0, 10);
  }
}
