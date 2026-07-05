import { Abastecimiento, ArqueoDaily, Product, Ticket, User, Zone } from '../../core/models/models';

export interface LoginApiData {
  id: number;
  username: string;
  nombre: string;
  token: string;
  role?: string;
  correlativo?: number;
}

export interface MeApiData {
  id: number;
  username: string;
  nombre: string;
  role?: string;
  correlativo?: number;
}

export interface CatalogsApiData {
  products: RawProduct[];
  zones: RawZone[];
}

export interface RawProduct {
  id: number;
  code: string;
  name: string;
  unit_measure?: string;
  unit_price?: number;
  base_amount?: number;
  is_active?: number | boolean;
  precio?: number;
  price?: number;
  active?: boolean;
  estado?: boolean;
}

export interface RawZone {
  id: number;
  code: string;
  nombre?: string;
  name?: string;
  district?: string;
  province?: string;
  department?: string;
  polygon: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
  estado?: boolean;
}

export interface TicketApiItem {
  id: number | string;
  ticket_number?: string;
  ticket_code?: string;
  abastecimiento_id?: number;
  abastecimiento_codigo?: string;
  abastecimiento_code?: string;
  idLocal?: string;
  fecha_emision?: string;
  receiver_name?: string;
  driver_name?: string;
  zone_name_snapshot?: string;
  quantity?: number;
  producto?: string;
  customer?: string;
  received_by?: string;
  zone?: string;
  zone_name?: string;
  amount?: number;
  total?: number;
  liters?: number;
  status?: string;
  created_at?: string;
  date?: string;
}

export interface ArqueoApiData {
  fecha?: string;
  total_registros?: number;
  total_monto?: number;
  date?: string;
  totalTickets?: number;
  totalAmount?: number;
  items_detail?: ArqueoApiItem[];
  itemsDetail?: ArqueoApiItem[];
  items?: ArqueoApiItem[];
}

export interface ArqueoApiItem {
  abastecimiento_codigo?: string;
  abastecimiento_code?: string;
  idLocal?: string;
  ticket_number?: string;
  ticket_code?: string;
  receiver_name?: string;
  received_by?: string;
  customer?: string;
  producto?: string;
  productName?: string;
  tickets?: number;
  total_tickets?: number;
  cubos?: number;
  liters?: number;
  quantity?: number;
  total_cubos?: number;
  total?: number;
  amount?: number;
  total_amount?: number;
}

export interface SyncAbastecimientoPayload {
  idLocal: string;
  cantidad: number;
  producto: number;
  recibidoPor: string;
  zonaNombreSnapshot: string;
  latitud: number;
  longitud: number;
  precisionGps: number;
  fechaGps: string;
  importe: number;
  zonaId?: number;
  metodoZona?: 'AUTO' | 'MANUAL' | 'UNRESOLVED';
  estadoSincronizacion?: 'PENDING' | 'SYNCED' | 'ERROR';
  estadoImpresion?: 'PENDING' | 'PRINTED' | 'ERROR';
  conductor?: string;
  horaInicio?: string;
  horaFin?: string;
  creadoOffline?: boolean;
}

export interface SyncAbastecimientoResult {
  id_local?: string;
  id_remoto?: number;
  idLocal?: string;
  remoteId?: number;
}

export interface TicketsLocalCache {
  items: Ticket[];
  updatedAt: string;
  date?: string;
}

export interface ArqueoLocalCache {
  data?: ArqueoDaily;
  byDate?: Record<string, ArqueoDaily>;
  updatedAt?: string;
}
