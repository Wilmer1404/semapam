import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map } from 'rxjs';
import { ApiBaseService } from '@core/services/api-base.service';
import {
  Abastecimiento,
  AbastecimientosListData,
  AbastecimientosListQuery,
  PrintStatus,
  SyncStatus
} from '@shared/models/abastecimiento.model';

@Injectable()
export class AbastecimientosService extends ApiBaseService {
  constructor(http: HttpClient) {
    super(http);
  }

  list(query: AbastecimientosListQuery) {
    return this.get<AbastecimientosListData>('/abastecimientos', query).pipe(
      map((response) => ({
        ...response,
        data: {
          ...response.data,
          items: (response.data?.items || []).map((item) => this.normalizeItem(item))
        }
      }))
    );
  }

  getById(id: number) {
    return this.get<Abastecimiento>(`/abastecimientos/${id}`).pipe(
      map((response) => ({
        ...response,
        data: this.normalizeItem(response.data)
      }))
    );
  }

  private normalizeItem(item: Abastecimiento): Abastecimiento {
    const sync = (item.sync_status || 'PENDING').toUpperCase();
    const print = (item.print_status || 'PENDING').toUpperCase();

    return {
      ...item,
      sync_status: (sync === 'FAILED' ? 'ERROR' : sync) as SyncStatus,
      print_status: (print === 'FAILED' ? 'ERROR' : print) as PrintStatus
    };
  }
}
