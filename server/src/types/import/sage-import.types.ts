// Estructura de datos del CSV de SAGE
export interface SageCSVRow {
    // Formato actual
    'empleadoNomina codigoempresa': string;          // Código empresa (no usado)
    'Cód centro trabajo': string;                    // Código centro -> centers.import_id
    'Centro trabajo': string;                        // Nombre centro -> centers.center_name
    'EmpleadoNomina CodigoEmpleado': string;         // Código empleado -> users.import_id
    'personas dni': string;                          // DNI -> users.dni
    'Nombre cli/pro': string;                        // Nombre -> users.name
    'Apellidos': string;                             // Apellidos -> users.first_surname + second_surname
    'Fecha de Alta': string;                         // Fecha alta -> user_center.start_date
    'Fecha de Baja': string;                         // Fecha baja -> user_center.end_date
    'Categoría': string;                             // Categoría -> users.job_position
    'Email': string;                                 // Email -> users.email
    'Fecha de Nacimiento': string;                   // Fecha nacimiento -> users.birth_date
    'Grupo de Pago': string;                         // No usado
    'Movilidad geografica': string;                  // users.phone
    'Personas ProvNumSoe': string;                   // NSS -> users.nss (convertir notación científica)
    'Sexo': string;                                  // No usado
    'Tarifa': string;                                // Grupo cotización -> users.salary_group
    'Empresas Empresa': string;                      // Nombre empresa -> companies.company_name + import_id
    'Empresas CifDni': string;                       // CIF empresa -> companies.cif
    'Numero_Patr': string;                           // Número patronal -> centers.employer_number
    'Txt_GrupoPago': string;                         // No usado
    'Txt_Tarifa': string;                            // No usado
    'CategoriaCuentaAnual': string;                  // No usado
    'Txt_CategoriaCuentaAnual': string;              // No usado
    'Código nivel': string;                          // No usado
    'Nivel Estudios': string;                        // No usado

    // Compatibilidad con formato anterior (desactivada intencionalmente)
    // Se deja como referencia documental por si en el futuro se necesita reactivar.
    // 'EmpleadoNomina.CodigoEmpresa'?: string;
    // 'Cód. centro trabajo'?: string;
    // 'EmpleadoNomina.CodigoEmpleado'?: string;
    // 'Personas.Dni'?: string;
    // 'Nombre cli/pro.'?: string;
    // 'Fecha de alta'?: string;
    // 'Fecha de baja'?: string;
    // 'Fecha de nacimiento'?: string;
    // 'Grupo de pago'?: string;
    // 'Movilidad geográfica'?: string;
    // 'Personas.ProvNumSoe'?: string;
    // 'Empresas.Empresa'?: string;
    // 'Empresas.CifDni'?: string;
    // 'NumeroPatronal'?: string;
    // 'Número patronal'?: string;
}

// Datos normalizados para procesamiento
export interface ProcessedUserData {
    // Datos del usuario
    dni: string;
    name: string;
    first_surname: string;
    second_surname?: string;
    email?: string;
    phone?: string;
    birth_date?: Date;
    job_position?: string;
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
    EXACT_MATCH_FIELDS: ['dni', 'nss', 'email'],
    
    /** 
     * REGLA DE FILTRADO AUTOMÁTICO:
     * Si tanto DNI como NSS del CSV son diferentes a los de un usuario en BD,
     * se omite ese match y se crea un usuario nuevo automáticamente.
     * Esto evita decisiones manuales innecesarias cuando claramente son personas diferentes.
     */
    AUTO_CREATE_ON_DIFFERENT_IDS: true
} as const;