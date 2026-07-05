export interface ApiResponse<T> {
  total_rows: number;
  status: boolean;
  data: T;
  message: string;
}
