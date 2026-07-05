import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, of } from 'rxjs';
import { ApiBaseService } from '@core/services/api-base.service';
import { Product } from '@shared/models/product.model';
import { ApiResponse } from '@shared/models/api-response.model';

@Injectable()
export class ProductsService extends ApiBaseService {
  constructor(http: HttpClient) { super(http); }

  list() {
    return this.get<ProductAdmin[]>('/products').pipe(
      map((response) => ({
        ...response,
        data: (response.data || []).map((item) => this.toProduct(item))
      })),
      catchError(() => of<ApiResponse<Product[]>>({
        total_rows: 3,
        status: true,
        message: 'Mock products fallback',
        data: [
          { id: 1, code: 'AG20', name: 'Agua tratada 20L', unit_measure: 'BIDÓN', unit_price: 6, base_amount: 20, is_active: true },
          { id: 2, code: 'AG50', name: 'Agua tratada 50L', unit_measure: 'TANQUE', unit_price: 15, base_amount: 50, is_active: true },
          { id: 3, code: 'AG10', name: 'Agua tratada 10L', unit_measure: 'BIDÓN', unit_price: 4, base_amount: 10, is_active: false }
        ]
      }))
    );
  }

  getById(id: number) {
    return this.get<ProductAdmin>(`/products/${id}`).pipe(
      map((response) => ({ ...response, data: this.toProduct(response.data) }))
    );
  }

  create(payload: Product) {
    return this.post<ProductAdmin>('/products', this.toProductPayload(payload)).pipe(
      map((response) => ({ ...response, data: this.toProduct(response.data) }))
    );
  }

  update(id: number, payload: Partial<Product>) {
    return this.put<ProductAdmin>(`/products/${id}`, this.toProductPayload(payload)).pipe(
      map((response) => ({ ...response, data: this.toProduct(response.data) }))
    );
  }

  deleteProduct(id: number) {
    return this.delete<void>(`/products/${id}`);
  }

  private toProduct(admin: ProductAdmin): Product {
    return {
      id: admin.id,
      code: admin.code,
      name: admin.name,
      unit_measure: admin.unit_measure,
      unit_price: Number(admin.unit_price || 0),
      base_amount: Number(admin.base_amount || 0),
      is_active: Number(admin.is_active) === 1
    };
  }

  private toProductPayload(payload: Partial<Product>): Record<string, unknown> {
    return {
      ...(payload.code !== undefined ? { code: payload.code } : {}),
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.unit_measure !== undefined ? { unit_measure: payload.unit_measure } : {}),
      ...(payload.unit_price !== undefined ? { unit_price: payload.unit_price } : {}),
      ...(payload.base_amount !== undefined ? { base_amount: payload.base_amount } : {}),
      ...(payload.is_active !== undefined ? { is_active: payload.is_active ? 1 : 0 } : {})
    };
  }
}

interface ProductAdmin {
  id: number;
  code: string;
  name: string;
  unit_measure: string;
  unit_price: number;
  base_amount: number | null;
  is_active: number;
}
