export type SyncStatus = 'PENDING' | 'SYNCED' | 'ERROR';
export type ZoneAssignmentMethod = 'AUTO' | 'MANUAL' | 'UNRESOLVED';
export type PrintStatus = 'PENDING' | 'PRINTED' | 'ERROR';

export interface User {
	id: number;
	username: string;
	name: string;
	role: string;
	correlativo?: number;
}

export interface SessionData {
	token: string;
	user: User;
	loginAt: string;
}

export interface Product {
	id: number;
	code: string;
	name: string;
	price: number;
	active: boolean;
}

export interface Zone {
	id: number;
	code: string;
	name: string;
	polygon: GeoJsonPolygon;
}

export interface GeoJsonPolygon {
	type: 'Polygon' | 'MultiPolygon';
	coordinates: number[][][] | number[][][][];
}

export interface LocationPoint {
	lat?: number;
	lng?: number;
	accuracy?: number;
	capturedAt: string;
}

export interface Abastecimiento {
	idLocal: string;
	idRemoto?: number;
	productId: number;
	productName: string;
	conductor: string;
	cantidad: number;
	recibidoPor: string;
	importe: number;
	zonaId?: number;
	zonaNombre: string;
	metodoZona: ZoneAssignmentMethod;
	ubicacion: LocationPoint;
	horaInicio: string;
	horaFin: string;
	estadoSincronizacion: SyncStatus;
	estadoImpresion: PrintStatus;
	creadoOffline?: boolean;
	reintentos: number;
	ultimoError?: string;
	createdAt: string;
	updatedAt: string;
}

export interface Ticket {
	id: string;
	remoteId?: number;
	customer: string;
	zone: string;
	amount: number;
	liters?: number;
	productName?: string;
	status: SyncStatus;
	date: string;
}

export interface ArqueoDaily {
	date: string;
	totalTickets: number;
	totalAmount: number;
	items?: ArqueoItem[];
	syncedAt?: string;
}

export interface ArqueoItem {
	customerName?: string;
	productName: string;
	tickets: number;
	cubos: number;
	amount: number;
}

export interface LoginRequest {
	username: string;
	password: string;
}

export interface LoginPayload {
	token: string;
	user: User;
}
