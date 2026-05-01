export interface ContractSummary {
  id: string;
  contract_number: string;
  project_name: string;
  contractor_name: string;
  locality: string;
  status: string;
  decision_count: number;
  payroll_record_count: number;
  created_at: string;
}

export interface PaginatedContracts {
  items: ContractSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface PayrollRecordSummary {
  id: string;
  contract_id: string;
  employee_name: string;
  trade_code: string;
  locality_code: string;
  week_ending: string;
  total_hours: string;
  hourly_rate: string;
  gross_pay: string;
}

export interface PaginatedPayrolls {
  items: PayrollRecordSummary[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface IngestionJobSummary {
  job_id: string;
  type: string;
  status: string;
  source_type: string;
  total_records: number;
  processed_records: number;
  failed_records: number;
  created_at: string;
}
