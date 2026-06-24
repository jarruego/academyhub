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
    csvRowData?: any; // Solo disponible tras cargar el detalle (GET /pending-decisions/:id)
}

export type FieldSource = 'csv' | 'db';

// Campos seleccionables individualmente en la modal de comparación
export type SelectableField = 'dni' | 'nss' | 'name' | 'first_surname' | 'second_surname' | 'email' | 'phone';

export interface ProcessDecisionRequest {
    action: 'link' | 'create_new' | 'skip' | 'update_and_link';
    selectedUserId?: number;
    // Mapa de selección por campo (CSV vs BD) para link/update_and_link
    fieldSelections?: Partial<Record<SelectableField, FieldSource>>;
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
    phoneCsv?: string;    // Solo disponible tras cargar el detalle
    phoneDb?: string;     // Solo disponible tras cargar el detalle
    similarityScore?: number;
    csvRowData?: any;      // Solo disponible tras cargar el detalle (GET /pending-decisions/:id)
    changeMetadata?: any; // Solo disponible tras cargar el detalle
    selectedUserId?: number;
    decisionAction: 'link' | 'create_new' | 'skip' | 'update_and_link';
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
// Opciones de sobrescritura de campos en la importación SAGE.
// Las claves coinciden con los nombres que espera el backend (SageImportOptions).
export interface ImportOverwriteOptions {
    overwriteGender: boolean;
    overwriteSalaryGroup: boolean;
    overwriteBirthDate: boolean;
    overwriteEducationLevel: boolean;
}

export const DEFAULT_IMPORT_OVERWRITE_OPTIONS: ImportOverwriteOptions = {
    overwriteGender: false,
    overwriteSalaryGroup: false,
    overwriteBirthDate: false,
    overwriteEducationLevel: false,
};
