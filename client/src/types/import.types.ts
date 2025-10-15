// Tipos para la importación en el frontend
export interface ImportSummary {
    total_rows: number;
    processed_rows: number;
    new_users: number;
    updated_users: number;
    new_companies: number;
    new_centers: number;
    new_associations: number;
    decisions_pending: number;
    errors: number;
    error_details?: Array<{
        row: number;
        message: string;
        data: any;
    }>;
}

export interface JobStatus {
    jobId: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
    progress: number;
    totalRows: number;
    processedRows: number;
    errorMessage?: string;
    completedAt?: string;
    resultSummary?: ImportSummary;
}

export interface UploadResponse {
    jobId: string;
    message: string;
}

export interface PendingDecision {
    id: number;
    dniCsv: string;
    nameCSV: string;
    firstSurnameCSV: string;
    secondSurnameCSV?: string;
    nameDb: string;
    firstSurnameDb: string;
    secondSurnameDb?: string;
    dniDb?: string;
    emailDb?: string;
    nssDb?: string;
    similarityScore: number;
    csvRowData: any;
}

export interface ProcessDecisionRequest {
    action: 'link' | 'create_new' | 'skip';
    selectedUserId?: number;
    notes?: string;
}

export interface ProcessedDecision {
    id: number;
    importSource: string;
    dniCsv: string;
    nameCSV: string;
    firstSurnameCSV: string;
    secondSurnameCSV?: string;
    nameDb?: string;
    firstSurnameDb?: string;
    secondSurnameDb?: string;
    dniDb?: string;
    emailDb?: string;
    nssDb?: string;
    similarityScore?: number;
    csvRowData: any;
    selectedUserId?: number;
    decisionAction: 'link' | 'create_new' | 'skip';
    notes?: string;
    createdAt: string;
    updatedAt: string;
}

export interface RevertDecisionRequest {
    reason?: string;
}

export interface JobInfo {
    jobId: string;
    type: string;
    status: string;
    progress: number;
    totalRows: number;
    processedRows: number;
    createdAt: string;
    completedAt?: string;
    errorMessage?: string;
}