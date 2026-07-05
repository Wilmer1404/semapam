import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { StatusChipComponent } from './components/status-chip/status-chip.component';
import { DateFilterModalComponent } from './components/date-filter-modal/date-filter-modal.component';

@NgModule({
  declarations: [StatusChipComponent, DateFilterModalComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [StatusChipComponent, DateFilterModalComponent]
})
export class SharedModule {}
