export interface ArqueoSummaryItem {
	label: string;
	total_tickets: number;
	total_quantity: number;
	total_amount: number;
}

export interface ArqueoDetailItem {
	id: number;
	abastecimiento_codigo: string;
	ticket_number: string;
	fecha_emision: string;
	receiver_name: string;
	product_name: string;
	quantity: number;
	amount: number;
	zone_name: string;
	status: string;
}

export interface ArqueoDaily {
	fecha: string;
	start_date?: string | null;
	end_date?: string | null;
	range_applied: boolean;
	total_tickets: number;
	total_abastecimientos: number;
	total_monto: number;
	zone_summary: ArqueoSummaryItem[];
	product_summary: ArqueoSummaryItem[];
	details: ArqueoDetailItem[];
}
