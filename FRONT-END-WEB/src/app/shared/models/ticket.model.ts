export type TicketStatus = 'PENDING' | 'SYNCED' | 'ERROR';

export interface Ticket {
	id: number;
	local_id?: string;
	ticket_number?: string;
	external_ticket_number?: string;
	status: TicketStatus;
	amount: number;
	quantity?: number;
	unit_measure?: string;
	printed_at?: string;
	created_at?: string;
	reprint_count?: number;
	full_name?: string;
	username?: string;
	printed_by?: string;
	receiver_name?: string;
	receiver_dni?: string;
	product_name?: string;
	zone_name?: string;
	zone_name_snapshot?: string;
}

export interface TicketFilters {
	search?: string;
	status?: TicketStatus;
	from?: string;
	to?: string;
}

export interface TicketsListQuery extends TicketFilters {
	[key: string]: string | number | boolean | undefined;
	offset: number;
	limit: number;
}

export interface TicketsPagination {
	offset: number;
	limit: number;
	total: number;
	has_more: boolean;
}

export interface TicketsListData {
	items: Ticket[];
	pagination: TicketsPagination;
}

export interface TicketDetail extends Ticket {
	history?: Array<{ action: string; user: string; at: string }>;
	content?: string;
}
