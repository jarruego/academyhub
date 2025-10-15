// Estructura de datos del CSV de SAGE
export interface SageCSVRow {
    'EmpleadoNomina.CodigoEmpresa': string;           // Código empresa (no usado)
    'Cód. centro trabajo': string;                    // Código centro -> centers.import_id
    'Centro trabajo': string;                         // Nombre centro -> centers.center_name
    'EmpleadoNomina.CodigoEmpleado': string;         // Código empleado -> users.import_id
    'Personas.Dni': string;                          // DNI -> users.dni
    'Nombre cli/pro.': string;                       // Nombre -> users.name
    'Apellidos': string;                             // Apellidos -> users.first_surname + second_surname
    'Fecha de alta': string;                         // Fecha alta -> user_center.start_date
    'Fecha de baja': string;                         // Fecha baja -> user_center.end_date
    'Categoría': string;                             // Categoría -> users.professional_category
    'Email': string;                                 // Email -> users.email
    'Fecha de nacimiento': string;                   // Fecha nacimiento -> users.birth_date
    'Grupo de pago': string;                         // No usado
    'Movilidad geográfica': string;                  // No usado
    'Personas.ProvNumSoe': string;                   // NSS -> users.nss (convertir notación científica)
    'Sexo': string;                                  // No usado (mal formato)
    'Tarifa': string;                                // Grupo cotización -> users.salary_group
    'Empresas.Empresa': string;                      // Nombre empresa -> companies.company_name + import_id
    'Empresas.CifDni': string;                       // CIF empresa -> companies.cif
    'Número patronal': string;                       // Número patronal -> centers.employer_number
}

// Datos normalizados para procesamiento
export interface ProcessedUserData {
    // Datos del usuario
    dni: string;
    name: string;
    first_surname: string;
    second_surname?: string;
    email?: string;
    birth_date?: Date;
    professional_category?: string;
    salary_group?: number;
    nss?: string;
    import_id: string; // EmpleadoNomina.CodigoEmpleado
    
    // Datos de la empresa
    company_name: string;
    company_cif: string;
    company_import_id: string;
    
    // Datos del centro
    center_name: string;
    center_code: string;
    employer_number?: string;
    
    // Datos de la relación usuario-centro
    start_date?: Date;
    end_date?: Date;
    
    // Metadatos
    original_row: SageCSVRow;
    row_number: number;
}

// Resultado del procesamiento de un registro
export interface ProcessingResult {
    success: boolean;
    action: 'created' | 'updated' | 'linked' | 'decision_required' | 'error' | 'skipped';
    user_id?: number;
    company_id?: number;
    center_id?: number;
    error_message?: string;
    similarity_score?: number;
    decision_id?: number;
}

// Resumen final de la importación
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
    error_details: Array<{
        row: number;
        message: string;
        data: any;
    }>;
}

// Configuración del parser CSV
export interface CSVParserConfig {
    delimiter: string;
    encoding: string;
    skip_empty_lines: boolean;
    headers: boolean;
    quote: string;
}

// Configuración por defecto para archivos SAGE
export const SAGE_CSV_CONFIG: CSVParserConfig = {
    delimiter: ';',
    encoding: 'utf-8',
    skip_empty_lines: true,
    headers: true,
    quote: '"'
};

// Utilidades de validación
export interface ValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

// Tipos para detección de similitud
export interface SimilarityMatch {
    user_id: number;
    name: string;
    first_surname: string;
    second_surname?: string;
    dni: string;
    similarity_score: number;
}

// Configuración de umbral de similitud
export const SIMILARITY_CONFIG = {
    THRESHOLD: 0.9,
    MIN_NAME_LENGTH: 3,
    EXACT_MATCH_FIELDS: ['dni', 'nss', 'email']
} as const;