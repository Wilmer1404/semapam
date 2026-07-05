import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDividerModule } from '@angular/material/divider';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatDialogModule } from '@angular/material/dialog';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BasePageHeaderComponent } from './components/base-page-header/base-page-header.component';
import { QuickStatCardComponent } from './components/quick-stat-card/quick-stat-card.component';
import { StatusDialogComponent } from './components/status-dialog/status-dialog.component';
import { StatusChipPipe } from './pipes/status-chip.pipe';
import { NumberCurrencyPipe } from './pipes/number-currency.pipe';

@NgModule({
  declarations:[BasePageHeaderComponent,QuickStatCardComponent,StatusDialogComponent,StatusChipPipe,NumberCurrencyPipe],
  imports:[CommonModule,FormsModule,ReactiveFormsModule,RouterModule,MatToolbarModule,MatSidenavModule,MatIconModule,MatListModule,MatButtonModule,MatCardModule,MatInputModule,MatFormFieldModule,MatTableModule,MatChipsModule,MatSelectModule,MatDatepickerModule,MatNativeDateModule,MatDividerModule,MatMenuModule,MatSnackBarModule,MatPaginatorModule,MatDialogModule,MatTooltipModule],
  exports:[CommonModule,FormsModule,ReactiveFormsModule,RouterModule,MatToolbarModule,MatSidenavModule,MatIconModule,MatListModule,MatButtonModule,MatCardModule,MatInputModule,MatFormFieldModule,MatTableModule,MatChipsModule,MatSelectModule,MatDatepickerModule,MatNativeDateModule,MatDividerModule,MatMenuModule,MatSnackBarModule,MatPaginatorModule,MatDialogModule,MatTooltipModule,BasePageHeaderComponent,QuickStatCardComponent,StatusChipPipe,NumberCurrencyPipe]
}) export class SharedModule {}
