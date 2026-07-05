export type ZoneMethod = 'AUTO' | 'MANUAL' | 'UNRESOLVED';
export type SyncStatus = 'PENDING' | 'SYNCED' | 'ERROR';
export type PrintStatus = 'PENDING' | 'PRINTED' | 'ERROR';

export interface Abastecimiento {
	id: number;
	local_id?: string;
	ticket_number?: string;
	external_ticket_number?: string;
	product_id?: number;
	product_code?: string;
	product_name: string;
	quantity: number;
	amount: number;
	driver_name?: string;
	receiver_name: string;
	receiver_dni?: string;
	zone_name_snapshot?: string;
	zone_assignment_method: ZoneMethod;
	latitude?: number;
	longitude?: number;
	gps_accuracy?: number;
	gps_captured_at?: string;
	started_at?: string;
	finished_at?: string;
	sync_status: SyncStatus;
	sync_attempts?: number;
	print_status: PrintStatus;
	reprint_count?: number;
	created_offline?: boolean;
	created_at?: string;
}

export interface AbastecimientosFilters {
	from?: string;
	to?: string;
	local_id?: string;
	receiver?: string;
	driver?: string;
	product?: string;
	zone_method?: ZoneMethod;
	sync_status?: SyncStatus;
	print_status?: PrintStatus;
}

export interface AbastecimientosListQuery extends AbastecimientosFilters {
	[key: string]: string | number | boolean | undefined;
	offset: number;
	limit: number;
}

export interface AbastecimientosPagination {
	offset: number;
	limit: number;
	total: number;
	has_more: boolean;
}

export interface AbastecimientosListData {
	items: Abastecimiento[];
	pagination: AbastecimientosPagination;
}
