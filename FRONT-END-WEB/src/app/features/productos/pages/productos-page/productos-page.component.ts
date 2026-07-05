import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { BehaviorSubject, switchMap } from 'rxjs';
import { Product } from '@shared/models/product.model';
import { ProductsService } from '../../services/products.service';
import { NotificationService } from '@core/services/notification.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PageEvent } from '@angular/material/paginator';

@Component({
  selector: 'app-productos-page',
  templateUrl: './productos-page.component.html',
  styleUrls: ['./productos-page.component.scss'],
  providers: [ProductsService]
})
export class ProductosPageComponent implements OnInit {
  private readonly svc = inject(ProductsService);
  private readonly notification = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly reload$ = new BehaviorSubject<void>(undefined);
  displayedColumns = ['code', 'name', 'unit_measure', 'unit_price', 'base_amount', 'is_active', 'actions'];
  allProducts: Product[] = [];
  filteredProducts: Product[] = [];
  pagedProducts: Product[] = [];
  totalProducts = 0;
  pageSize = 10;
  pageIndex = 0;
  readonly pageSizeOptions = [5, 10, 20, 50];
  editingId: number | null = null;
  formVisible = false;
  filters = {
    search: '',
    unit: 'ALL',
    status: 'ALL'
  };

  draftProduct: Product = {
    code: '',
    name: '',
    unit_measure: 'GAL',
    unit_price: 0,
    base_amount: 0,
    is_active: true
  };

  readonly unitOptions = ['ALL', 'BIDON', 'GAL', 'LITRO', 'TANQUE'];

  ngOnInit(): void {
    this.reload$.pipe(
      switchMap(() => this.svc.list()),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: (response) => {
        this.allProducts = response.data || [];
        this.applyFilters();
      },
      error: (error) => {
        this.notification.error(error?.error?.message || 'No se pudo cargar el catálogo de productos.');
      }
    });
  }

  newProduct(): void {
    this.formVisible = true;
    this.editingId = null;
    this.resetDraftProduct();
  }

  toggleCreateProductForm(): void {
    if (this.formVisible && this.editingId === null) {
      this.cancel();
      return;
    }

    this.newProduct();
  }

  reloadCatalog(): void {
    this.reload$.next();
  }

  editProduct(row: Product): void {
    this.formVisible = true;
    this.editingId = row.id || null;
    this.draftProduct = { ...row };
  }

  onFilterChange(): void {
    this.pageIndex = 0;
    this.applyFilters();
  }

  clearFilters(): void {
    this.filters = {
      search: '',
      unit: 'ALL',
      status: 'ALL'
    };
    this.pageIndex = 0;
    this.applyFilters();
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex = event.pageIndex;
    this.pageSize = event.pageSize;
    this.updatePageSlice();
  }

  saveProduct(): void {
    if (!this.draftProduct.code?.trim() || !this.draftProduct.name?.trim()) {
      this.notification.error('Código y nombre son obligatorios.');
      return;
    }

    const request$ = this.editingId
      ? this.svc.update(this.editingId, this.draftProduct)
      : this.svc.create(this.draftProduct);

    request$.subscribe({
      next: () => {
        this.notification.success(this.editingId ? 'Producto actualizado.' : 'Producto creado.');
        this.cancel();
        this.reload$.next();
      },
      error: (error) => this.notification.error(error?.error?.message || 'No se pudo guardar el producto.')
    });
  }

  deleteProduct(row: Product): void {
    if (!row.id) {
      this.notification.error('No se puede eliminar un registro sin ID.');
      return;
    }

    this.svc.deleteProduct(row.id).subscribe({
      next: () => {
        this.notification.success('Producto eliminado.');
        if (this.editingId === row.id) {
          this.newProduct();
        }
        this.reload$.next();
      },
      error: (error) => this.notification.error(error?.error?.message || 'No se pudo eliminar el producto.')
    });
  }

  cancel(): void {
    this.formVisible = false;
    this.editingId = null;
    this.resetDraftProduct();
  }

  private applyFilters(): void {
    const search = this.filters.search.trim().toLowerCase();
    this.filteredProducts = this.allProducts.filter((product) => {
      const matchesSearch = !search || [product.code, product.name, product.unit_measure]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(search));

      const normalizedUnit = (product.unit_measure || '').toUpperCase();
      const matchesUnit = this.filters.unit === 'ALL' || normalizedUnit === this.filters.unit;

      const matchesStatus = this.filters.status === 'ALL'
        || (this.filters.status === 'ACTIVE' && !!product.is_active)
        || (this.filters.status === 'INACTIVE' && !product.is_active);

      return matchesSearch && matchesUnit && matchesStatus;
    });

    this.totalProducts = this.filteredProducts.length;
    if (this.pageIndex > 0 && this.pageIndex * this.pageSize >= this.totalProducts) {
      this.pageIndex = 0;
    }
    this.updatePageSlice();
  }

  private updatePageSlice(): void {
    const start = this.pageIndex * this.pageSize;
    this.pagedProducts = this.filteredProducts.slice(start, start + this.pageSize);
  }

  private resetDraftProduct(): void {
    this.draftProduct = {
      code: '',
      name: '',
      unit_measure: 'GAL',
      unit_price: 0,
      base_amount: 0,
      is_active: true
    };
  }
}
