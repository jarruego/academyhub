import { Inject, Injectable, Logger } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { DATABASE_PROVIDER } from "src/database/database.module";
import { eq, and, or, desc, isNotNull, sql, gte, lte } from "drizzle-orm";
import { distance } from "fastest-levenshtein";
import * as csvParser from "csv-parser";
import { Readable } from "stream";

// Schemas
import { 
    users, 
    companies, 
    centers, 
    user_center, 
    import_jobs, 
    import_decisions 
} from "src/database/schema";

// Types
import {
    SageCSVRow,
    ProcessedUserData,
    ProcessingResult,
    ImportSummary,
    SAGE_CSV_CONFIG,
    SIMILARITY_CONFIG,
    SimilarityMatch
} from "src/types/import/sage-import.types";

import {
    ImportJobInsertModel,
    ImportJobUpdateModel,
    ImportJobStatus,
    ImportType,
    ImportDecisionInsertModel,
    DecisionAction,
    importJobTable
} from "src/database/schema/tables/import.table";

import { UserInsertModel } from "src/database/schema/tables/user.table";
import { CompanyInsertModel } from "src/database/schema/tables/company.table";
import { CenterInsertModel } from "src/database/schema/tables/center.table";
import { UserCenterInsertModel } from "src/database/schema/tables/user_center.table";
import { DocumentType } from "src/types/user/document-type.enum";
import { Gender } from "src/types/user/gender.enum";

@Injectable()
export class ImportService {
    private readonly logger = new Logger(ImportService.name);

    constructor(
        @Inject(DATABASE_PROVIDER) 
        private readonly databaseService: DatabaseService,
    ) {}

    /**
     * Inicia un trabajo de importación desde un archivo CSV
     */
    async startImportJob(buffer: Buffer, filename: string): Promise<string> {
        const jobId = this.generateJobId();
        
        try {
            // Verificar tamaño del archivo
            const fileSizeMB = buffer.length / (1024 * 1024);
            if (fileSizeMB > 50) {
                this.logger.warn(`⚠️  ARCHIVO MUY GRANDE: ${fileSizeMB.toFixed(2)}MB`);
                this.logger.warn(`💡 RECOMENDACIÓN: Para archivos > 50MB, considera dividir en partes más pequeñas`);
                this.logger.warn(`📝 O usar el procesamiento en lotes que se activará automáticamente`);
            }

            // Crear registro de trabajo
            await this.databaseService.db.insert(import_jobs).values({
                job_id: jobId,
                import_type: ImportType.SAGE,
                status: ImportJobStatus.PENDING,
                total_rows: 0,
                processed_rows: 0
            });

            // Procesar CSV en background
            this.processCSVBackground(jobId, buffer, filename);

            return jobId;
        } catch (error: any) {
            this.logger.error(`Error iniciando trabajo de importación: ${error?.message || error}`);
            throw error;
        }
    }

    /**
     * Procesa el CSV en segundo plano
     */
    private async processCSVBackground(jobId: string, buffer: Buffer, filename: string): Promise<void> {
        try {
            await this.updateJobStatus(jobId, ImportJobStatus.PROCESSING);
            
            const csvData = await this.parseCSV(buffer);
            const totalRows = csvData.length;
            await this.updateJobProgress(jobId, totalRows, 0);

            const summary: ImportSummary = {
                total_rows: totalRows,
                processed_rows: 0,
                new_users: 0,
                updated_users: 0,
                new_companies: 0,
                new_centers: 0,
                new_associations: 0,
                decisions_pending: 0,
                errors: 0,
                error_details: []
            };

            // PROCESAMIENTO EN LOTES PARA ARCHIVOS GRANDES
            const BATCH_SIZE = totalRows > 10000 ? 1000 : 500; // Lotes de 1000 para archivos grandes
            const MEMORY_CHECK_INTERVAL = 100; // Comprobar memoria cada 100 registros
            
            this.logger.warn(`📊 Procesando ${totalRows} registros en lotes de ${BATCH_SIZE}`);

            // Procesar en lotes
            for (let batchStart = 0; batchStart < csvData.length; batchStart += BATCH_SIZE) {
                const batchEnd = Math.min(batchStart + BATCH_SIZE, csvData.length);
                const currentBatch = csvData.slice(batchStart, batchEnd);
                
                this.logger.warn(`🔄 Procesando lote ${Math.floor(batchStart / BATCH_SIZE) + 1}/${Math.ceil(csvData.length / BATCH_SIZE)} (filas ${batchStart + 1}-${batchEnd})`);

                // Procesar lote actual
                for (let i = 0; i < currentBatch.length; i++) {
                    const globalIndex = batchStart + i;
                    try {
                        const row = currentBatch[i];
                        const processedData = this.normalizeCSVRow(row, globalIndex + 1);
                        const result = await this.processUserRecord(processedData);

                        this.updateSummaryFromResult(summary, result);
                        summary.processed_rows = globalIndex + 1;

                        // Actualizar progreso cada 50 filas
                        if (globalIndex % 50 === 0) {
                            await this.updateJobProgress(jobId, totalRows, globalIndex + 1);
                        }

                        // Comprobar memoria y hacer pausa cada cierto número de registros
                        if (globalIndex % MEMORY_CHECK_INTERVAL === 0 && globalIndex > 0) {
                            // Pequeña pausa para permitir garbage collection
                            await new Promise(resolve => setTimeout(resolve, 10));
                        }

                    } catch (error: any) {
                        this.logger.error(`Error procesando fila ${globalIndex + 1}: ${error?.message || error}`);
                        summary.errors++;
                        summary.error_details.push({
                            row: globalIndex + 1,
                            message: error?.message || error.toString(),
                            data: currentBatch[i]
                        });
                    }
                }

                // Pausa entre lotes para permitir que el sistema respire
                if (batchEnd < csvData.length) {
                    this.logger.warn(`⏸️  Pausa entre lotes... (${summary.processed_rows}/${totalRows} completados)`);
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            // Finalizar trabajo
            // Actualizar progreso final por si acaso no se actualizó en el último lote
            await this.updateJobProgress(jobId, totalRows, summary.processed_rows);
            await this.completeJob(jobId, summary);

        } catch (error: any) {
            this.logger.error(`Error en procesamiento de CSV: ${error?.message || error}`);
            await this.failJob(jobId, error?.message || error.toString());
        }
    }

    /**
     * Parsea el archivo CSV con manejo robusto de errores
     */
    private async parseCSV(buffer: Buffer): Promise<SageCSVRow[]> {
        return new Promise((resolve, reject) => {
            const results: SageCSVRow[] = [];
            
            // MANEJO ROBUSTO DE CODIFICACIÓN
            let content: string;
            
            // Detectar y manejar diferentes codificaciones
            try {
                // Primero intentar UTF-8
                content = buffer.toString('utf-8');
                
                // Verificar si hay caracteres extraños que indican problemas de codificación
                if (content.includes('�') || content.includes('Ã±') || content.includes('Ã¡')) {
                    this.logger.warn(`⚠️ Detectados problemas de codificación UTF-8, intentando latin1...`);
                    // Intentar con latin1 (ISO-8859-1) común en archivos españoles
                    content = buffer.toString('latin1');
                }
                
                // Si aún hay problemas, intentar con windows-1252
                if (content.includes('�') || content.includes('Ã±')) {
                    this.logger.warn(`⚠️ Detectados problemas de codificación latin1, intentando windows-1252...`);
                    content = buffer.toString('binary');
                    // Convertir caracteres problemáticos manualmente
                    content = content
                        .replace(/Ã±/g, 'ñ')
                        .replace(/Ã¡/g, 'á')
                        .replace(/Ã©/g, 'é')
                        .replace(/Ã­/g, 'í')
                        .replace(/Ã³/g, 'ó')
                        .replace(/Ãº/g, 'ú')
                        .replace(/Ã /g, 'à')
                        .replace(/Ã¨/g, 'è')
                        .replace(/Ã¬/g, 'ì')
                        .replace(/Ã²/g, 'ò')
                        .replace(/Ã¹/g, 'ù')
                        .replace(/Ã'/g, 'Ñ')
                        .replace(/Ã/g, 'Á')
                        .replace(/Ã‰/g, 'É')
                        .replace(/Ã/g, 'Í')
                        .replace(/Ã"/g, 'Ó')
                        .replace(/Ãš/g, 'Ú');
                }
                
            } catch (error: any) {
                this.logger.error(`💥 Error en codificación: ${error.message}`);
                content = buffer.toString('utf-8', 0, Math.min(buffer.length, 1000000)); // Fallback limitado
            }
            
            const originalSize = content.length;
            
            // Limpiar emails problemáticos
            content = content.replace(/([a-zA-Z0-9]+)"([a-zA-Z0-9]+\.com)/g, '$1@$2');
            
            this.logger.warn(`📖 Iniciando parsing de CSV (${originalSize} bytes)...`);
            this.logger.warn(`🔧 Pre-procesamiento aplicado para emails y codificación`);

            const stream = Readable.from(Buffer.from(content, 'utf-8'));
            let lineCount = 0;
            let validRecords = 0;
            let errorCount = 0;
            let isFirstRow = true;
            const MAX_ERRORS = 100;

            stream
                .pipe(csvParser.default({
                    separator: ';',
                    headers: false,
                    escape: '"',
                    quote: '"'
                }))
                .on('data', (data) => {
                    lineCount++;
                    
                    try {
                        // Debug: mostrar primeras líneas para verificar parsing
                        if (lineCount <= 3) {
                            this.logger.warn(`🔍 Línea ${lineCount}: ${JSON.stringify(data)} (${Array.isArray(data) ? data.length : 'no array'} campos)`);
                        }

                        // Verificar si los datos están llegando correctamente
                        if (!data) {
                            if (lineCount <= 10) this.logger.warn(`⚠️ Línea ${lineCount}: datos nulos`);
                            return;
                        }

                        // Convertir a array si no lo es
                        let dataArray: string[];
                        if (Array.isArray(data)) {
                            dataArray = data;
                        } else if (typeof data === 'object') {
                            dataArray = Object.values(data);
                        } else {
                            if (lineCount <= 10) this.logger.warn(`⚠️ Línea ${lineCount}: tipo de datos inesperado: ${typeof data}`);
                            return;
                        }

                        // Saltar header
                        if (isFirstRow) {
                            isFirstRow = false;
                            const firstCell = dataArray[0]?.toString().toLowerCase();
                            if (firstCell && firstCell.includes('empleado')) {
                                this.logger.warn(`📋 Header detectado y saltado`);
                                return;
                            }
                        }

                        // Validar campos
                        if (dataArray.length < 15) {
                            if (errorCount < 10) {
                                this.logger.warn(`⚠️ Línea ${lineCount}: ${dataArray.length} campos (esperados 20)`);
                            }
                            errorCount++;
                            if (errorCount > MAX_ERRORS) {
                                reject(new Error(`Demasiados errores: ${errorCount}`));
                                return;
                            }
                            return;
                        }
                        
                        // Mapear a estructura esperada
                        const mappedRow = this.mapArrayToSageRow(dataArray);
                        results.push(mappedRow);
                        validRecords++;

                        // Progreso cada 10k
                        if (lineCount % 10000 === 0) {
                            this.logger.warn(`📊 Progreso: ${lineCount} líneas, ${validRecords} válidos, ${errorCount} errores`);
                        }

                    } catch (error: any) {
                        this.logger.error(`💥 Error línea ${lineCount}: ${error.message}`);
                        errorCount++;
                        if (errorCount > MAX_ERRORS) {
                            reject(new Error(`Demasiados errores: ${errorCount}`));
                            return;
                        }
                    }
                })
                .on('end', () => {
                    this.logger.warn(`✅ Parsing completado:`);
                    this.logger.warn(`   📊 Total líneas: ${lineCount}`);
                    this.logger.warn(`   ✅ Registros válidos: ${validRecords}`);
                    this.logger.warn(`   ⚠️ Errores: ${errorCount}`);
                    resolve(results);
                })
                .on('error', (error) => {
                    this.logger.error(`💥 Error crítico en CSV parser: ${error.message}`);
                    reject(error);
                });
        });
    }

    /**
     * Mapea un array de datos CSV a la estructura SageCSVRow esperada
     */
    private mapArrayToSageRow(dataArray: string[]): SageCSVRow {
        // Aplicar limpieza de codificación a cada campo de texto
        const cleanData = dataArray.map(field => this.cleanTextEncoding(field || ''));
        
        return {
            'EmpleadoNomina.CodigoEmpresa': cleanData[0] || '',
            'Cód. centro trabajo': cleanData[1] || '',
            'Centro trabajo': cleanData[2] || '',
            'EmpleadoNomina.CodigoEmpleado': cleanData[3] || '',
            'Personas.Dni': cleanData[4] || '',
            'Nombre cli/pro.': cleanData[5] || '',
            'Apellidos': cleanData[6] || '',
            'Fecha de alta': cleanData[7] || '',
            'Fecha de baja': cleanData[8] || '',
            'Categoría': cleanData[9] || '',
            'Email': cleanData[10] || '',
            'Fecha de nacimiento': cleanData[11] || '',
            'Grupo de pago': cleanData[12] || '',
            'Movilidad geográfica': cleanData[13] || '',
            'Personas.ProvNumSoe': cleanData[14] || '',
            'Sexo': cleanData[15] || '',
            'Tarifa': cleanData[16] || '',
            'Empresas.Empresa': cleanData[17] || '',
            'Empresas.CifDni': cleanData[18] || '',
            'Número patronal': cleanData[19] || ''
        };
    }

    /**
     * Limpia problemas de codificación en texto
     */
    private cleanTextEncoding(text: string): string {
        if (!text || typeof text !== 'string') return text;
        
        return text
            // Limpiar caracteres de codificación malformada común
            .replace(/Ã±/g, 'ñ')     // ñ
            .replace(/Ã¡/g, 'á')     // á  
            .replace(/Ã©/g, 'é')     // é
            .replace(/Ã­/g, 'í')     // í
            .replace(/Ã³/g, 'ó')     // ó
            .replace(/Ãº/g, 'ú')     // ú
            .replace(/Ã /g, 'à')     // à
            .replace(/Ã¨/g, 'è')     // è
            .replace(/Ã¬/g, 'ì')     // ì
            .replace(/Ã²/g, 'ò')     // ò
            .replace(/Ã¹/g, 'ù')     // ù
            .replace(/Ã'/g, 'Ñ')     // Ñ
            .replace(/Ã/g, 'Á')      // Á
            .replace(/Ã‰/g, 'É')     // É
            .replace(/Ã/g, 'Í')      // Í
            .replace(/Ã"/g, 'Ó')     // Ó
            .replace(/Ãš/g, 'Ú')     // Ú
            .replace(/Ã§/g, 'ç')     // ç
            .replace(/Ã'/g, 'Ç')     // Ç
            .replace(/â‚¬/g, '€')    // Euro
            .replace(/â€œ/g, '"')    // Comillas
            .replace(/â€/g, '"')     // Comillas  
            .replace(/â€™/g, "'")    // Apostrofe
            .replace(/â€"/g, '-')    // Guión
            // Limpiar caracteres de control y espacios extra
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
            .trim();
    }

    /**
     * Normaliza el nombre del centro para matching/almacenamiento.
     * - descompone acentos
     * - elimina diacríticos
     * - colapsa espacios
     * - trim y lower-case
     */
    private normalizeCenter(s?: string): string {
        if (!s) return '';
        try {
            return String(s)
                .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ')
                .trim()
                .toLowerCase();
        } catch (e) {
            return String(s).trim().toLowerCase();
        }
    }

    /**
     * Normaliza una fila del CSV a datos procesables
     */
    private normalizeCSVRow(row: SageCSVRow, rowNumber: number): ProcessedUserData {
        // Separar apellidos
        const apellidos = row['Apellidos']?.trim() || '';
        const apellidosParts = apellidos.split(' ');
        const firstSurname = apellidosParts[0] || '';
        const secondSurname = apellidosParts.slice(1).join(' ') || undefined;

        // Convertir notación científica del NSS
        const nssRaw = row['Personas.ProvNumSoe'];
        const nss = this.convertScientificNotation(nssRaw);

        // Convertir fechas
        const birthDate = this.parseDate(row['Fecha de nacimiento']);
        const startDate = this.parseDate(row['Fecha de alta']);
        const endDate = this.parseDate(row['Fecha de baja']);

        // Convertir grupo de cotización
        const salaryGroup = row['Tarifa'] ? parseInt(row['Tarifa']) : undefined;

        const normalizedData = {
            // Datos del usuario
            dni: row['Personas.Dni']?.trim(),
            name: row['Nombre cli/pro.']?.trim(),
            first_surname: firstSurname,
            second_surname: secondSurname,
            email: row['Email']?.trim() || undefined,
            birth_date: birthDate,
            professional_category: row['Categoría']?.trim() || undefined,
            salary_group: salaryGroup,
            nss: nss,
            import_id: row['EmpleadoNomina.CodigoEmpleado']?.trim(),

            // Datos de la empresa
            company_name: row['Empresas.Empresa']?.trim(),
            company_cif: row['Empresas.CifDni']?.trim(),
            company_import_id: row['Empresas.Empresa']?.trim(),

            // Datos del centro
            center_name: row['Centro trabajo']?.trim(),
            center_code: row['Cód. centro trabajo']?.trim(),
            employer_number: row['Número patronal']?.trim() || undefined,

            // Datos de la relación
            start_date: startDate,
            end_date: endDate,

            // Metadatos
            original_row: row,
            row_number: rowNumber
        };

        return normalizedData;
    }

    /**
     * Convierte notación científica a número normal
     */
    private convertScientificNotation(value: string): string | undefined {
        if (!value || value.trim() === '') return undefined;
        
        try {
            // Reemplazar coma por punto para el parseFloat
            const normalizedValue = value.replace(',', '.');
            const numericValue = parseFloat(normalizedValue);
            
            if (isNaN(numericValue)) return undefined;
            
            // Convertir a entero y luego a string para evitar decimales
            const integerValue = Math.floor(numericValue);
            return integerValue.toString();
        } catch (error) {
            this.logger.warn(`Error convirtiendo notación científica "${value}":`, error);
            return undefined;
        }
    }

    /**
     * Parsea fecha en diferentes formatos
     */
    private parseDate(dateStr: string): Date | undefined {
        if (!dateStr || dateStr.trim() === '') return undefined;

        try {
            // Intentar varios formatos comunes
            const formats = [
                /(\d{2})\/(\d{2})\/(\d{4})/, // DD/MM/YYYY
                /(\d{4})-(\d{2})-(\d{2})/, // YYYY-MM-DD
                /(\d{2})-(\d{2})-(\d{4})/, // DD-MM-YYYY
            ];

            for (const format of formats) {
                const match = dateStr.match(format);
                if (match) {
                    const [, p1, p2, p3] = match;
                    
                    if (format === formats[1]) {
                        // YYYY-MM-DD
                        return new Date(parseInt(p1), parseInt(p2) - 1, parseInt(p3));
                    } else {
                        // DD/MM/YYYY o DD-MM-YYYY
                        return new Date(parseInt(p3), parseInt(p2) - 1, parseInt(p1));
                    }
                }
            }

            // Como último recurso, usar el constructor de Date
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? undefined : date;
        } catch {
            return undefined;
        }
    }

    /**
     * Procesa un registro de usuario completo
     */
    private async processUserRecord(data: ProcessedUserData): Promise<ProcessingResult> {
        try {
            // 1. Buscar o crear empresa
            const company = await this.findOrCreateCompany(data);
            
            // 2. Buscar o crear centro
            const center = await this.findOrCreateCenter(data, company.id_company);
            
            // 3. Procesar usuario
            const userResult = await this.processUser(data);
            
            if (userResult.action === 'decision_required') {
                return userResult;
            }

            // 4. Crear/actualizar relación usuario-centro
            await this.processUserCenterRelation(userResult.user_id!, center.id_center, data);

            // 5. Verificar centro principal
            await this.ensureMainCenter(userResult.user_id!);

            return {
                success: true,
                action: userResult.action,
                user_id: userResult.user_id,
                company_id: company.id_company,
                center_id: center.id_center
            };

        } catch (error: any) {
            this.logger.error(`Error procesando registro: ${error?.message || error}`, data);
            
            // CRÍTICO: Asegurar que el usuario se guarde en el sistema de respaldo
            await this.createFailedUserRecord(data, `Error en processUserRecord: ${error?.message || error}`);
            
            return {
                success: false,
                action: 'error',
                error_message: error?.message || error.toString()
            };
        }
    }

    /**
     * Busca o crea una empresa
     */
    private async findOrCreateCompany(data: ProcessedUserData) {
        // Validar datos requeridos
        if (!data.company_name || !data.company_cif) {
            throw new Error(`Datos de empresa incompletos: name="${data.company_name}", cif="${data.company_cif}"`);
        }

        // Buscar por CIF o import_id
        const existing = await this.databaseService.db
            .select()
            .from(companies)
            .where(
                or(
                    eq(companies.cif, data.company_cif),
                    eq(companies.import_id, data.company_import_id)
                )
            )
            .limit(1);

        if (existing.length > 0) {
            return existing[0];
        }

        // Crear nueva empresa
        const newCompany: CompanyInsertModel = {
            company_name: data.company_name,
            corporate_name: data.company_name, // Usar el mismo nombre por defecto
            cif: data.company_cif,
            import_id: data.company_import_id
        };

        const [created] = await this.databaseService.db
            .insert(companies)
            .values(newCompany)
            .returning();

        return created;
    }

    /**
     * Busca o crea un centro
     */
    private async findOrCreateCenter(data: ProcessedUserData, companyId: number) {
        // Si no hay center_name, usar "DESCONOCIDO"
        const centerName = data.center_name?.trim() || 'DESCONOCIDO';

        // Normalizar el nombre para matching/almacenamiento
        const normalizedCenter = this.normalizeCenter(centerName);

        // Siempre usamos import_id prefijado con companyId: `${companyId}_${normalizedCenter}`
        const expectedImportId = `${companyId}_${normalizedCenter}`;

        // Si es DESCONOCIDO mantenemos el patrón companyId_desconocido
        if (centerName === 'DESCONOCIDO') {
            const importId = `${companyId}_desconocido`;
            const existing = await this.databaseService.db
                .select()
                .from(centers)
                .where(eq(centers.import_id, importId))
                .limit(1);

            if (existing.length > 0) return existing[0];

            const newCenter: CenterInsertModel = {
                center_name: centerName,
                employer_number: data.employer_number || null,
                id_company: companyId,
                import_id: importId
            };

            const [created] = await this.databaseService.db
                .insert(centers)
                .values(newCenter)
                .returning();

            this.logger.warn(`🏢 Centro DESCONOCIDO creado para empresa ID ${companyId} (usuario sin centro definido)`);
            return created;
        }

        // Para centros normales: intentar matching por import_id prefijado (exacto), prefijo sobre la parte normalized y fallback por nombre
        // 1) exact match por import_id completo (companyId_normalizedCenter)
        let existing = await this.databaseService.db
            .select()
            .from(centers)
            .where(eq(centers.import_id, expectedImportId))
            .limit(1);

        if (existing.length > 0) return existing[0];

        // 2) prefix match: import_id comienza por companyId_normalizedCenter (esto permite GUADALQUIV -> GUADALQUIVIR)
        existing = await this.databaseService.db
            .select()
            .from(centers)
            .where(sql`${centers.import_id} LIKE ${expectedImportId + '%'}`)
            .limit(1);

        if (existing.length > 0) return existing[0];

        // 3) fallback: comparar el center_name de la BD normalizado contra el CSV normalizado (sin prefijo)
        existing = await this.databaseService.db
            .select()
            .from(centers)
            .where(
                and(
                    eq(centers.id_company, companyId),
                    sql`lower(trim(${centers.center_name})) = ${normalizedCenter}`
                )
            )
            .limit(1);

        if (existing.length > 0) return existing[0];

        // No encontrado -> crear nuevo centro con import_id = `${companyId}_${normalizedCenter}`
        const newCenter: CenterInsertModel = {
            center_name: centerName,
            employer_number: data.employer_number || null,
            id_company: companyId,
            import_id: expectedImportId
        };

        const [created] = await this.databaseService.db
            .insert(centers)
            .values(newCenter)
            .returning();

        return created;
    }

    private async createFailedUserRecord(data: ProcessedUserData, reason: string): Promise<number> {
        try {
            // Crear tabla de respaldo para usuarios fallidos
            await this.databaseService.db.execute(sql`
                CREATE TABLE IF NOT EXISTS failed_user_imports (
                    id SERIAL PRIMARY KEY,
                    dni VARCHAR(20),
                    name VARCHAR(100),
                    first_surname VARCHAR(100),
                    second_surname VARCHAR(100),
                    email VARCHAR(255),
                    import_id VARCHAR(50),
                    nss VARCHAR(20),
                    company_name VARCHAR(255),
                    center_name VARCHAR(255),
                    csv_row_data JSONB NOT NULL,
                    failure_reason TEXT,
                    import_source VARCHAR(50) DEFAULT 'sage',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Insertar el usuario fallido
            const result = await this.databaseService.db.execute(sql`
                INSERT INTO failed_user_imports (
                    dni, name, first_surname, second_surname, email, import_id, nss,
                    company_name, center_name, csv_row_data, failure_reason, import_source
                ) VALUES (
                    ${data.dni},
                    ${data.name},
                    ${data.first_surname},
                    ${data.second_surname || null},
                    ${data.email || null},
                    ${data.import_id},
                    ${data.nss || null},
                    ${data.company_name},
                    ${data.center_name},
                    ${JSON.stringify(data.original_row)},
                    ${reason},
                    'sage'
                ) RETURNING id
            `);

            const failedId = (result as any).rows?.[0]?.id || 1;
            this.logger.warn(`⚠️ Usuario guardado en failed_user_imports (ID: ${failedId}): ${data.name} ${data.first_surname} - Razón: ${reason}`);
            return failedId;
            
        } catch (error: any) {
            this.logger.error(`CRÍTICO: No se pudo guardar usuario fallido ${data.name} ${data.first_surname}:`, error.message);
            // Como último recurso, guardar en archivo de log
            this.logger.error(`DATOS PERDIDOS: ${JSON.stringify(data)}`);
            return -1;
        }
    }

    /**
     * Procesa un usuario (buscar, crear o decisión manual)
     */
    private async processUser(data: ProcessedUserData): Promise<ProcessingResult> {
        // 1. Buscar por DNI exacto
        const existingByDni = await this.databaseService.db
            .select()
            .from(users)
            .where(eq(users.dni, data.dni))
            .limit(1);

        if (existingByDni.length > 0) {
            // Usuario existe, actualizar campos faltantes
            const user = existingByDni[0];
            const updates = this.buildUserUpdates(user, data);
            
            if (Object.keys(updates).length > 0) {
                await this.databaseService.db
                    .update(users)
                    .set(updates)
                    .where(eq(users.id_user, user.id_user));
                
                return { success: true, action: 'updated', user_id: user.id_user };
            }

            return { success: true, action: 'linked', user_id: user.id_user };
        }

        // 2. Buscar por NSS si existe (para evitar duplicados)
        if (data.nss) {
            const existingByNSS = await this.databaseService.db
                .select()
                .from(users)
                .where(eq(users.nss, data.nss))
                .limit(1);

            if (existingByNSS.length > 0) {
                const user = existingByNSS[0];
                this.logger.warn(`Usuario con NSS ${data.nss} ya existe: ${user.name} ${user.first_surname} (DNI: ${user.dni}). Nuevo registro: ${data.name} ${data.first_surname} (DNI: ${data.dni})`);
                
                const matchForNSS = {
                    user_id: user.id_user,
                    name: user.name,
                    first_surname: user.first_surname,
                    second_surname: user.second_surname,
                    dni: user.dni,
                    similarity_score: 0.99
                };

                // PRIMERO: Verificar si ya existe una decisión procesada para NSS duplicado
                const processedDecision = await this.checkProcessedDecision(data, matchForNSS);
                
                if (processedDecision.exists) {
                            this.logger.debug(`Decisión NSS ya tomada anteriormente para ${data.name} ${data.first_surname} (NSS: ${data.nss}). Acción: ${processedDecision.action}`);
                    
                    // Aplicar la decisión anterior automáticamente (misma lógica que para similitud)
                    switch (processedDecision.action) {
                        case 'link':
                            const updates = this.buildUserUpdates(user, data);
                            if (Object.keys(updates).length > 0) {
                                await this.databaseService.db
                                    .update(users)
                                    .set(updates)
                                    .where(eq(users.id_user, user.id_user));
                                return { success: true, action: 'updated', user_id: user.id_user };
                            }
                            return { success: true, action: 'linked', user_id: user.id_user };
                            
                        case 'create_new':
                            const newUser = await this.createNewUser(data);
                            return { success: true, action: 'created', user_id: newUser.id_user };
                            
                        case 'skip':
                            this.logger.debug(`Registro NSS omitido según decisión anterior para ${data.name} ${data.first_surname}`);
                            return { success: true, action: 'skipped' };
                    }
                }
                
                // SEGUNDO: Verificar si ya existe una decisión pendiente para este caso
                const existingDecisionId = await this.checkExistingDecision(data, matchForNSS);

                if (existingDecisionId) {
                    return {
                        success: true,
                        action: 'decision_required',
                        similarity_score: 0.99,
                        decision_id: existingDecisionId
                    };
                }

                // TERCERO: Crear decisión manual para NSS duplicado
                const decisionId = await this.createImportDecision(data, matchForNSS);
                
                if (decisionId === -1) {
                    // Si no se pudo crear la decisión, proceder a crear el usuario
                    this.logger.warn(`No se pudo crear decisión manual, creando usuario duplicado para NSS ${data.nss}`);
                } else {
                    return {
                        success: true,
                        action: 'decision_required',
                        similarity_score: 0.99,
                        decision_id: decisionId
                    };
                }
            }
        }

        // 3. Buscar por similitud de nombre
        const similarUsers = await this.findSimilarUsers(data);
        
        if (similarUsers.length > 0) {
            const bestMatch = similarUsers[0];
            
            if (bestMatch.similarity_score >= SIMILARITY_CONFIG.THRESHOLD) {
                // PRIMERO: Verificar si ya existe una decisión procesada (completada)
                const processedDecision = await this.checkProcessedDecision(data, bestMatch);
                
                if (processedDecision.exists) {
                    this.logger.debug(`Decisión ya tomada anteriormente para ${data.name} ${data.first_surname} (DNI: ${data.dni}). Acción: ${processedDecision.action}`);
                    
                    // Aplicar la decisión anterior automáticamente
                    switch (processedDecision.action) {
                        case 'link':
                            // Actualizar el usuario existente con los nuevos datos
                            const user = await this.databaseService.db
                                .select()
                                .from(users)
                                .where(eq(users.id_user, bestMatch.user_id))
                                .limit(1);

                            if (user.length > 0) {
                                const updates = this.buildUserUpdates(user[0], data);
                                if (Object.keys(updates).length > 0) {
                                    await this.databaseService.db
                                        .update(users)
                                        .set(updates)
                                        .where(eq(users.id_user, bestMatch.user_id));
                                    
                                    return { success: true, action: 'updated', user_id: bestMatch.user_id };
                                }
                                return { success: true, action: 'linked', user_id: bestMatch.user_id };
                            }
                            break;
                            
                        case 'create_new':
                            // Crear nuevo usuario (la decisión anterior fue crear uno nuevo)
                            const newUser = await this.createNewUser(data);
                            return { success: true, action: 'created', user_id: newUser.id_user };
                            
                        case 'skip':
                            // Omitir (la decisión anterior fue omitir este registro)
                            this.logger.debug(`Registro omitido según decisión anterior para ${data.name} ${data.first_surname}`);
                            return { success: true, action: 'skipped' };
                    }
                }
                
                // SEGUNDO: Si no hay decisión procesada, verificar si hay una pendiente
                const existingDecisionId = await this.checkExistingDecision(data, bestMatch);

                if (existingDecisionId) {
                    return {
                        success: true,
                        action: 'decision_required',
                        similarity_score: bestMatch.similarity_score,
                        decision_id: existingDecisionId
                    };
                }

                // TERCERO: Crear nueva decisión manual
                const decisionId = await this.createImportDecision(data, bestMatch);
                
                if (decisionId === -1) {
                    // Si no se pudo crear la decisión, proceder a crear el usuario
                    this.logger.warn(`No se pudo crear decisión manual por similitud, creando usuario nuevo para ${data.name} ${data.first_surname}`);
                } else {
                    return {
                        success: true,
                        action: 'decision_required',
                        similarity_score: bestMatch.similarity_score,
                        decision_id: decisionId
                    };
                }
            }
        }

        // 4. Crear nuevo usuario (no hay similitudes válidas o DNI/NSS son diferentes)
    // Eliminado log de creación de nuevo usuario para acelerar el proceso
        const newUser = await this.createNewUser(data);
        
        return { success: true, action: 'created', user_id: newUser.id_user };
    }

    /**
     * Busca usuarios similares por nombre y apellidos, excluyendo aquellos con DNI y NSS diferentes
     */
    private async findSimilarUsers(data: ProcessedUserData): Promise<SimilarityMatch[]> {
        // Buscar usuarios con nombres similares
        const allUsers = await this.databaseService.db
            .select({
                id_user: users.id_user,
                name: users.name,
                first_surname: users.first_surname,
                second_surname: users.second_surname,
                dni: users.dni,
                nss: users.nss
            })
            .from(users)
            .where(
                and(
                    isNotNull(users.name),
                    isNotNull(users.first_surname)
                )
            );

        const matches: SimilarityMatch[] = [];
        const targetName = `${data.name} ${data.first_surname} ${data.second_surname || ''}`.trim().toLowerCase();

        for (const user of allUsers) {
            const userName = `${user.name} ${user.first_surname} ${user.second_surname || ''}`.trim().toLowerCase();
            
            if (userName.length >= SIMILARITY_CONFIG.MIN_NAME_LENGTH) {
                const similarity = 1 - (distance(targetName, userName) / Math.max(targetName.length, userName.length));
                
                if (similarity >= SIMILARITY_CONFIG.THRESHOLD) {
                    // FILTRO CRUCIAL: Si tanto DNI como NSS son diferentes y ambos existen, omitir este match
                    // porque claramente es una persona diferente
                    const csvHasDni = data.dni && data.dni.trim() !== '';
                    const csvHasNss = data.nss && data.nss.trim() !== '';
                    const userHasDni = user.dni && user.dni.trim() !== '';
                    const userHasNss = user.nss && user.nss.trim() !== '';
                    
                    // Si ambos tienen DNI y NSS, y ambos son diferentes, skip este match
                    if (csvHasDni && csvHasNss && userHasDni && userHasNss) {
                        const dniDifferent = data.dni.trim().toLowerCase() !== user.dni.trim().toLowerCase();
                        const nssDifferent = data.nss.trim().toLowerCase() !== user.nss.trim().toLowerCase();
                        
                        if (dniDifferent && nssDifferent) {
                            this.logger.warn(`🚫 Omitiendo match por DNI y NSS diferentes: CSV(${data.dni}/${data.nss}) vs BD(${user.dni}/${user.nss}) para usuario ${user.name} ${user.first_surname}`);
                            continue; // Saltar este usuario, es claramente diferente
                        }
                    }
                    
                    matches.push({
                        user_id: user.id_user,
                        name: user.name!,
                        first_surname: user.first_surname!,
                        second_surname: user.second_surname,
                        dni: user.dni!,
                        similarity_score: similarity
                    });
                }
            }
        }

        return matches.sort((a, b) => b.similarity_score - a.similarity_score);
    }

    /**
     * Verifica si ya existe una decisión pendiente para un usuario específico
     */
    private async checkExistingDecision(data: ProcessedUserData, match: SimilarityMatch): Promise<number | null> {
        try {
            // Buscar decisión existente por DNI del CSV o por usuario de la BD
            const result = await this.databaseService.db.execute(sql`
                SELECT id FROM import_decisions 
                WHERE processed = false 
                AND (
                    (dni_csv = ${data.dni} AND dni_csv IS NOT NULL)
                    OR (selected_user_id = ${match.user_id} AND selected_user_id IS NOT NULL)
                )
                ORDER BY created_at DESC
                LIMIT 1
            `);

            if ((result as any).rows && (result as any).rows.length > 0) {
                const existingDecisionId = (result as any).rows[0].id;
                this.logger.debug(`Decisión pendiente encontrada (ID: ${existingDecisionId}) para DNI: ${data.dni} o usuario: ${match.user_id}`);
                return existingDecisionId;
            }

            return null;
        } catch (error: any) {
            this.logger.error(`Error verificando decisión existente: ${error.message}`);
            return null;
        }
    }

    /**
     * Verifica si ya existe una decisión procesada (completada) para evitar duplicados
     */
    private async checkProcessedDecision(data: ProcessedUserData, match: SimilarityMatch): Promise<{ exists: boolean, action?: string }> {
        try {
            // Buscar decisión ya procesada por DNI del CSV y usuario de la BD
            const result = await this.databaseService.db.execute(sql`
                SELECT decision_action, created_at FROM import_decisions 
                WHERE processed = true 
                AND dni_csv = ${data.dni} 
                AND selected_user_id = ${match.user_id}
                AND dni_csv IS NOT NULL 
                AND selected_user_id IS NOT NULL
                ORDER BY created_at DESC
                LIMIT 1
            `);

            if ((result as any).rows && (result as any).rows.length > 0) {
                const processedDecision = (result as any).rows[0];
                this.logger.debug(`Decisión ya procesada encontrada para DNI: ${data.dni} y usuario: ${match.user_id}. Acción anterior: ${processedDecision.decision_action}`);
                
                return {
                    exists: true,
                    action: processedDecision.decision_action
                };
            }

            return { exists: false };
        } catch (error: any) {
            this.logger.error(`Error verificando decisión procesada: ${error.message}`);
            return { exists: false };
        }
    }

    /**
     * Crea una decisión de importación manual
     */
    private async createImportDecision(data: ProcessedUserData, match: SimilarityMatch): Promise<number> {
        try {
            // Validar datos requeridos
            if (!data || !match) {
                throw new Error('Datos o match no proporcionados para crear decisión');
            }

            // Obtener datos completos del usuario de la BD
            const fullUserData = await this.databaseService.db
                .select()
                .from(users)
                .where(eq(users.id_user, match.user_id))
                .limit(1);

            const userInDb = fullUserData[0];

            // Extraer datos del CSV
            const emailCsv = data.email || this.extractEmailFromCSV(data.original_row);
            const nssCsv = data.nss || this.extractNSSFromCSV(data.original_row);

            // Crear decisión usando Drizzle ORM
            const [newDecision] = await this.databaseService.db
                .insert(import_decisions)
                .values({
                    import_source: 'sage',
                    // Datos del CSV
                    dni_csv: data.dni || null,
                    name_csv: data.name || null,
                    first_surname_csv: data.first_surname || null,
                    second_surname_csv: data.second_surname || null,
                    // Datos del usuario en BD
                    name_db: match.name || null,
                    first_surname_db: match.first_surname || null,
                    second_surname_db: match.second_surname || null,
                    dni_db: userInDb.dni || null,
                    email_db: userInDb.email || null,
                    nss_db: userInDb.nss || null,
                    // Metadatos
                    similarity_score: (match.similarity_score || 0).toString(),
                    csv_row_data: data.original_row || {},
                    selected_user_id: match.user_id || null,
                    processed: false
                })
                .returning({ id: import_decisions.id });

            return newDecision.id;
            
        } catch (error: any) {
            this.logger.error(`Error creando decisión manual:`, {
                error: error.message,
                data: {
                    dni: data?.dni,
                    name: data?.name,
                    first_surname: data?.first_surname
                },
                match: {
                    user_id: match?.user_id,
                    name: match?.name,
                    similarity_score: match?.similarity_score
                }
            });
            
            // En caso de error, intentar guardar en failed_user_imports
            if (data) {
                await this.createFailedUserRecord(data, `Decision creation failed: ${error.message}`);
            }
            
            throw new Error(`Failed to create import decision: ${error.message}`);
        }
    }

    /**
     * Extrae el email de los datos del CSV
     */
    private extractEmailFromCSV(csvRowData: any): string | null {
        if (!csvRowData || typeof csvRowData !== 'object') return null;
        return csvRowData.Email || csvRowData.email || null;
    }

    /**
     * Extrae el NSS de los datos del CSV
     */
    private extractNSSFromCSV(csvRowData: any): string | null {
        if (!csvRowData || typeof csvRowData !== 'object') return null;
        const nssRaw = csvRowData['Personas.ProvNumSoe'];
        return this.convertScientificNotation(nssRaw) || null;
    }

    /**
     * Construye actualizaciones para usuario existente
     */
    private buildUserUpdates(existingUser: any, data: ProcessedUserData): Partial<UserInsertModel> {
        const updates: Partial<UserInsertModel> = {};

        if (!existingUser.salary_group && data.salary_group) {
            updates.salary_group = data.salary_group;
        }

        if (!existingUser.professional_category && data.professional_category) {
            updates.professional_category = data.professional_category;
        }

        if (!existingUser.birth_date && data.birth_date) {
            updates.birth_date = data.birth_date;
        }

        if (!existingUser.nss && data.nss) {
            updates.nss = data.nss;
        }

        if (!existingUser.email && data.email) {
            updates.email = data.email;
        }

        return updates;
    }

    /**
     * Crea un nuevo usuario
     */
    private async createNewUser(data: ProcessedUserData) {
        // Eliminado log de inicio de createNewUser para acelerar el proceso

        // Small DNI normalization helper (matches other importers)
        const normalizeDni = (raw?: string) => String(raw ?? '').trim().replace(/[\.\-\s]/g, '').toUpperCase();
        const rawDni = normalizeDni(data.dni || '');
        const document_type = rawDni && /^[XYZ]/i.test(rawDni) ? DocumentType.NIE : DocumentType.DNI;

        const newUser: UserInsertModel = {
            name: data.name!,
            first_surname: data.first_surname,
            second_surname: data.second_surname,
            dni: data.dni,
            email: data.email || null,
            birth_date: data.birth_date || null,
            professional_category: data.professional_category || null,
            salary_group: data.salary_group || null,
            nss: data.nss || null,
            registration_date: new Date(),
            phone: null,
            document_type: document_type,
            gender: Gender.OTHER,
            // Set explicit defaults to avoid NULLs from imports
            disability: false,
            terrorism_victim: false,
            gender_violence_victim: false,
            education_level: null,
            address: null,
            postal_code: null,
            city: null,
            province: null,
            country: null,
            observations: null,
            seasonalWorker: false,
            erteLaw: false,
            accreditationDiploma: 'S'
        };



        try {
            const [created] = await this.databaseService.db
                .insert(users)
                .values(newUser)
                .returning();



            return created;
        } catch (error: any) {
            // Mejorar el logging del error
            this.logger.error(`❌ Error detallado al crear usuario:`, {
                name: newUser.name,
                dni: newUser.dni,
                nss: newUser.nss,
                error: error.message,
                constraint: error.constraint || 'Unknown',
                detail: error.detail || 'No detail',
                code: error.code || 'No code'
            });
            
            // CRÍTICO: Guardar en tabla de respaldo para no perder datos
            await this.createFailedUserRecord(data, `Error de inserción en users: ${error.message}`);
            
            // Relanzar el error con más contexto
            throw new Error(`Error creando usuario ${newUser.name} (DNI: ${newUser.dni}): ${error.message}`);
        }
    }

    /**
     * Procesa la relación usuario-centro
     */
    private async processUserCenterRelation(userId: number, centerId: number, data: ProcessedUserData): Promise<void> {
        // Buscar relación existente
        const existing = await this.databaseService.db
            .select()
            .from(user_center)
            .where(
                and(
                    eq(user_center.id_user, userId),
                    eq(user_center.id_center, centerId)
                )
            )
            .limit(1);

        // Recuperar el centro principal actual para este usuario (si existe)
        const currentMain = await this.databaseService.db
            .select()
            .from(user_center)
            .where(
                and(
                    eq(user_center.id_user, userId),
                    eq(user_center.is_main_center, true)
                )
            )
            .limit(1);

        const currentMainStart: Date | undefined = currentMain.length > 0 ? currentMain[0].start_date : undefined;

        if (existing.length > 0) {
            // Actualizar fechas si es necesario
            const relation = existing[0];
            const updates: Partial<UserCenterInsertModel> = {};

            // 1. Detectar reincorporación (start_date > end_date existente)
            if (data.start_date && relation.end_date && data.start_date > relation.end_date) {
                updates.end_date = null; // Limpiar fecha de baja por reincorporación
                updates.start_date = data.start_date; // Actualizar fecha de alta
                this.logger.warn(`✅ Reincorporación detectada para usuario ${userId} en centro ${centerId}: nueva alta ${data.start_date.toISOString().split('T')[0]} > baja anterior ${relation.end_date.toISOString().split('T')[0]}`);
            }
            // 2. Si no es reincorporación, aplicar lógicas normales
            else {
                // 2a. Actualizar start_date solo si es más reciente
                if (data.start_date && (!relation.start_date || data.start_date > relation.start_date)) {
                    updates.start_date = data.start_date;
                }

                // 2b. Actualizar end_date solo si es más reciente
                if (data.end_date && (!relation.end_date || data.end_date > relation.end_date)) {
                    updates.end_date = data.end_date;
                }
            }

            // 3. Validación: start_date no puede ser mayor que end_date en el mismo registro
            if (data.start_date && data.end_date && data.start_date > data.end_date) {
                updates.end_date = null; // Limpiar end_date inconsistente
                this.logger.warn(`⚠️ Inconsistencia detectada: start_date (${data.start_date.toISOString().split('T')[0]}) > end_date (${data.end_date.toISOString().split('T')[0]}) para usuario ${userId} en centro ${centerId}. Limpiando end_date.`);
            }

            // 4. Lógica para is_main_center según fecha de alta comparada con el main actual
            // Determinar la fecha efectiva de inicio tras las actualizaciones
            const effectiveStart: Date | undefined = (updates.start_date as Date) || relation.start_date || undefined;

            if (effectiveStart) {
                // Si no hay centro principal actual, este registro se convierte en principal
                if (!currentMainStart) {
                    updates.is_main_center = true;
                    // Poner a false cualquier otro (por seguridad)
                    await this.databaseService.db
                        .update(user_center)
                        .set({ is_main_center: false })
                        .where(eq(user_center.id_user, userId));
                } else {
                    // Si la fecha efectiva es más reciente que la del main actual y el main actual es distinto
                    if ((!currentMainStart || effectiveStart > currentMainStart) && !(currentMain.length > 0 && currentMain[0].id_center === centerId)) {
                        // Poner a false el main actual
                        await this.databaseService.db
                            .update(user_center)
                            .set({ is_main_center: false })
                            .where(
                                and(
                                    eq(user_center.id_user, userId),
                                    eq(user_center.is_main_center, true)
                                )
                            );

                        updates.is_main_center = true;
                    } else {
                        // Si este registro era main y ahora su fecha es menor o igual, asegurarse de marcar false
                        if (relation.is_main_center && currentMain.length > 0 && currentMain[0].id_center !== centerId && effectiveStart <= currentMainStart) {
                            updates.is_main_center = false;
                        }
                    }
                }
            }

            if (Object.keys(updates).length > 0) {
                await this.databaseService.db
                    .update(user_center)
                    .set(updates)
                    .where(
                        and(
                            eq(user_center.id_user, userId),
                            eq(user_center.id_center, centerId)
                        )
                    );
            }
        } else {
            // Crear nueva relación
            // Determinar is_main_center basándonos en la fecha de alta y el main actual
            let shouldBeMain = false;
            if (data.start_date) {
                if (!currentMainStart) {
                    shouldBeMain = true;
                } else if (data.start_date > currentMainStart) {
                    shouldBeMain = true;
                }
            }

            // Si debe ser main, limpiar el main anterior
            if (shouldBeMain) {
                await this.databaseService.db
                    .update(user_center)
                    .set({ is_main_center: false })
                    .where(
                        and(
                            eq(user_center.id_user, userId),
                            eq(user_center.is_main_center, true)
                        )
                    );
            }

            const newRelation: UserCenterInsertModel = {
                id_user: userId,
                id_center: centerId,
                start_date: data.start_date,
                end_date: data.end_date,
                is_main_center: shouldBeMain
            };

            await this.databaseService.db
                .insert(user_center)
                .values(newRelation);
        }
    }

    /**
     * Asegura que el usuario tenga un centro principal
     */
    private async ensureMainCenter(userId: number): Promise<void> {
        // Verificar si ya tiene un centro principal
        const hasMainCenter = await this.databaseService.db
            .select()
            .from(user_center)
            .where(
                and(
                    eq(user_center.id_user, userId),
                    eq(user_center.is_main_center, true)
                )
            )
            .limit(1);

        if (hasMainCenter.length === 0) {
            // Buscar el centro con la fecha de inicio más reciente
            const mostRecentCenter = await this.databaseService.db
                .select()
                .from(user_center)
                .where(eq(user_center.id_user, userId))
                .orderBy(desc(user_center.start_date))
                .limit(1);

            if (mostRecentCenter.length > 0) {
                await this.databaseService.db
                    .update(user_center)
                    .set({ is_main_center: true })
                    .where(
                        and(
                            eq(user_center.id_user, userId),
                            eq(user_center.id_center, mostRecentCenter[0].id_center)
                        )
                    );
            }
        }
    }

    /**
     * Utilidades para gestión de trabajos
     */
    private generateJobId(): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `import_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private async updateJobStatus(jobId: string, status: ImportJobStatus): Promise<void> {
        await this.databaseService.db
            .update(import_jobs)
            .set({ 
                status,
                updated_at: new Date()
            })
            .where(eq(import_jobs.job_id, jobId));
    }

    private async updateJobProgress(jobId: string, totalRows: number, processedRows: number): Promise<void> {
        await this.databaseService.db
            .update(import_jobs)
            .set({ 
                total_rows: totalRows,
                processed_rows: processedRows,
                updated_at: new Date()
            })
            .where(eq(import_jobs.job_id, jobId));
    }

    private async completeJob(jobId: string, summary: ImportSummary): Promise<void> {
        // Obtener estadísticas de usuarios fallidos para el resumen final
        const failedStats = await this.getFailedUsersStats();
        
        // Log del resumen final
        this.logger.warn(`✅ IMPORTACIÓN COMPLETADA (Job: ${jobId})`);
        this.logger.warn(`📊 RESUMEN FINAL:`);
        this.logger.warn(`   • Total procesados: ${summary.processed_rows}/${summary.total_rows}`);
        this.logger.warn(`   • Nuevos usuarios: ${summary.new_users}`);
        this.logger.warn(`   • Usuarios actualizados: ${summary.updated_users}`);
        this.logger.warn(`   • Decisiones manuales: ${summary.decisions_pending}`);
        this.logger.warn(`   • Errores: ${summary.errors}`);
        this.logger.warn(`   • Usuarios fallidos guardados: ${failedStats.total}`);
        
        if (summary.errors > 0) {
            this.logger.warn(`⚠️  PRINCIPALES ERRORES:`);
            failedStats.errorBreakdown.slice(0, 3).forEach((error: any) => {
                this.logger.warn(`   • ${error.failure_reason}: ${error.count} casos`);
            });
        }

        await this.databaseService.db
            .update(import_jobs)
            .set({
                status: ImportJobStatus.COMPLETED,
                processed_rows: summary.processed_rows, // Asegurar que el progreso final sea correcto
                result_summary: {
                    ...summary,
                    failed_user_stats: failedStats
                },
                completed_at: new Date(),
                updated_at: new Date()
            })
            .where(eq(import_jobs.job_id, jobId));
    }

    private async failJob(jobId: string, errorMessage: string): Promise<void> {
        await this.databaseService.db
            .update(import_jobs)
            .set({
                status: ImportJobStatus.FAILED,
                error_message: errorMessage,
                updated_at: new Date()
            })
            .where(eq(import_jobs.job_id, jobId));
    }

    private updateSummaryFromResult(summary: ImportSummary, result: ProcessingResult): void {
        if (!result.success) {
            summary.errors++;
            return;
        }

        switch (result.action) {
            case 'created':
                summary.new_users++;
                summary.new_associations++;
                break;
            case 'updated':
                summary.updated_users++;
                break;
            case 'linked':
                summary.new_associations++;
                break;
            case 'decision_required':
                summary.decisions_pending++;
                break;
            case 'skipped':
                // Los registros omitidos no incrementan ningún contador
                // pero se consideran procesados exitosamente
                break;
        }
    }

    /**
     * Métodos públicos para consulta
     */
    async getJobStatus(jobId: string) {
        const job = await this.databaseService.db
            .select()
            .from(import_jobs)
            .where(eq(import_jobs.job_id, jobId))
            .limit(1);

        return job[0] || null;
    }

    async getPendingDecisions(importSource?: string) {
        let query = this.databaseService.db
            .select({
                // Campos base
                id: import_decisions.id,
                // Mapear a nombres esperados por el frontend
                dniCsv: import_decisions.dni_csv,
                nameCSV: import_decisions.name_csv,
                firstSurnameCSV: import_decisions.first_surname_csv,
                secondSurnameCSV: import_decisions.second_surname_csv,
                nameDb: import_decisions.name_db,
                firstSurnameDb: import_decisions.first_surname_db,
                secondSurnameDb: import_decisions.second_surname_db,
                dniDb: import_decisions.dni_db,
                emailDb: import_decisions.email_db,
                nssDb: import_decisions.nss_db,
                similarityScore: import_decisions.similarity_score,
                csvRowData: import_decisions.csv_row_data,
                // Campos adicionales
                selected_user_id: import_decisions.selected_user_id,
                processed: import_decisions.processed,
                created_at: import_decisions.created_at
            })
            .from(import_decisions);

        if (importSource) {
            return await query.where(
                and(
                    eq(import_decisions.processed, false),
                    eq(import_decisions.import_source, importSource)
                )
            );
        } else {
            return await query.where(eq(import_decisions.processed, false));
        }
    }

    async processDecision(decisionId: number, action: DecisionAction, selectedUserId?: number): Promise<void> {
        // Mensaje reducido a debug para evitar logs verbosos en producción
        this.logger.debug(`🔄 Procesando decisión ${decisionId} con acción: ${action}`);
        
        // Primero obtener los datos de la decisión
        const [decision] = await this.databaseService.db
            .select()
            .from(import_decisions)
            .where(eq(import_decisions.id, decisionId))
            .limit(1);

        if (!decision) {
            this.logger.error(`❌ Decision with ID ${decisionId} not found`);
            throw new Error(`Decision with ID ${decisionId} not found`);
        }

    // Datos completos de la decisión solo en debug
    this.logger.debug(`📋 Datos de la decisión encontrada:`, {
            id: decision.id,
            name_csv: decision.name_csv,
            dni_csv: decision.dni_csv,
            csvRowData: decision.csv_row_data, // Usar el nombre correcto de la BD
            csvRowDataType: typeof decision.csv_row_data,
            csvRowDataKeys: decision.csv_row_data ? Object.keys(decision.csv_row_data) : 'undefined',
            action: action
        });

        // Ejecutar la acción correspondiente
        switch (action) {
            case 'create_new':
                this.logger.debug(`🆕 Ejecutando creación de nuevo usuario para decisión ${decisionId}`);
                await this.executeCreateNewUser(decision);
                break;
            case 'link':
                this.logger.debug(`🔗 Ejecutando vinculación de usuario para decisión ${decisionId}`);
                await this.executeLinkUser(decision, selectedUserId);
                break;
            case 'update_and_link':
                this.logger.debug(`🔄 Ejecutando actualización y vinculación para decisión ${decisionId}`);
                await this.executeUpdateAndLink(decision, selectedUserId);
                // NOTA: executeUpdateAndLink ya actualiza el estado de la decisión
                return; // Salir temprano para evitar doble actualización
            case 'skip':
                this.logger.debug(`⏭️ Omitiendo registro para decisión ${decisionId}`);
                // Para skip, solo marcamos como procesado
                break;
        }

        // Actualizar el estado de la decisión
        const updates: any = {
            processed: true,
            decision_action: action,
            updated_at: new Date()
        };

        if (selectedUserId) {
            updates.selected_user_id = selectedUserId;
        }

    this.logger.debug(`💾 Actualizando estado de la decisión ${decisionId}`);
        await this.databaseService.db
            .update(import_decisions)
            .set(updates)
            .where(eq(import_decisions.id, decisionId));
            
    this.logger.debug(`✅ Decisión ${decisionId} procesada exitosamente con acción: ${action}`);
    }

    /**
     * Ejecuta la creación de un nuevo usuario basado en una decisión
     */
    private async executeCreateNewUser(decision: any): Promise<void> {
        try {
            this.logger.debug(`🔨 Creando nuevo usuario desde decisión ${decision.id}`);
            this.logger.debug(`📋 CSV Row Data completo:`, decision.csv_row_data);
            
            // Validar que csv_row_data existe
            if (!decision.csv_row_data) {
                throw new Error(`No hay datos CSV disponibles para la decisión ${decision.id}. csv_row_data es ${decision.csv_row_data}`);
            }
            
            // Recrear ProcessedUserData a partir del CSV row data original
            const userData: ProcessedUserData = this.normalizeCSVRow(decision.csv_row_data, decision.id);
            
            this.logger.debug(`👤 Datos del usuario a crear (completos):`, {
                name: userData.name,
                dni: userData.dni,
                email: userData.email,
                nss: userData.nss,
                company_name: userData.company_name,
                center_name: userData.center_name,
                professional_category: userData.professional_category,
                birth_date: userData.birth_date
            });

            // CREAR DIRECTAMENTE SIN processUserRecord para evitar verificaciones de similitud
            // 1. Buscar o crear empresa
            const company = await this.findOrCreateCompany(userData);
            
            // 2. Buscar o crear centro
            const center = await this.findOrCreateCenter(userData, company.id_company);
            
            // 3. Crear usuario directamente
            const newUser = await this.createNewUser(userData);
            
            // 4. Crear/actualizar relación usuario-centro
            await this.processUserCenterRelation(newUser.id_user, center.id_center, userData);

            // 5. Verificar centro principal
            await this.ensureMainCenter(newUser.id_user);
            
            this.logger.debug(`✅ Usuario creado exitosamente:`, {
                id_user: newUser.id_user,
                dni: newUser.dni,
                company_id: company.id_company,
                center_id: center.id_center
            });

        } catch (error) {
            this.logger.error(`❌ Error ejecutando creación de usuario para decisión ${decision.id}:`, error);
            throw error;
        }
    }

    /**
     * Ejecuta update_and_link: actualiza datos del usuario BD y procesa empresa/centro del CSV
     */
    private async executeUpdateAndLink(decision: any, selectedUserId?: number): Promise<void> {
        try {
            const userId = selectedUserId || decision.selected_user_id;
            
            if (!userId) {
                throw new Error('No se proporcionó ID de usuario para update_and_link');
            }

            this.logger.debug(`🔄 Ejecutando update_and_link para usuario ${userId} con decisión ${decision.id}`);
            
            // Recrear ProcessedUserData del CSV
            const csvData: ProcessedUserData = this.normalizeCSVRow(decision.csv_row_data, decision.id);
            
            // 1. Obtener datos actuales del usuario en BD
            const [existingUser] = await this.databaseService.db
                .select()
                .from(users)
                .where(eq(users.id_user, userId))
                .limit(1);

            if (!existingUser) {
                throw new Error(`Usuario con ID ${userId} no encontrado`);
            }

            this.logger.debug(`📋 Datos actuales del usuario en BD:`, {
                dni: existingUser.dni,
                name: existingUser.name,
                first_surname: existingUser.first_surname,
                second_surname: existingUser.second_surname,
                email: existingUser.email
            });

            this.logger.debug(`📋 Datos del CSV para actualizar:`, {
                dni: csvData.dni,
                name: csvData.name,
                first_surname: csvData.first_surname,
                second_surname: csvData.second_surname,
                email: csvData.email
            });

            // 2. Preparar metadatos de cambio para reversión
            const changeMetadata = {
                action: "update_and_link",
                change_date: new Date().toISOString(),
                
                // Datos CSV originales
                original_csv: {
                    dni: csvData.dni,
                    nss: csvData.nss,
                    name: csvData.name,
                    first_surname: csvData.first_surname,
                    second_surname: csvData.second_surname,
                    email: csvData.email
                },
                
                // Datos BD antes del cambio (para reversión)
                original_bd: {
                    dni: existingUser.dni,
                    nss: existingUser.nss,
                    name: existingUser.name,
                    first_surname: existingUser.first_surname,
                    second_surname: existingUser.second_surname,
                    email: existingUser.email
                },
                
                // Datos BD después del cambio
                updated_bd: {
                    dni: csvData.dni,
                    nss: csvData.nss || existingUser.nss,
                    name: csvData.name,
                    first_surname: csvData.first_surname,
                    second_surname: csvData.second_surname,
                    email: csvData.email || existingUser.email
                },
                
                // Incluir 'nss' porque en la acción manual actualizamos NSS desde el CSV
                updated_fields: ["dni", "nss", "name", "first_surname", "second_surname", "email"],
                can_revert: true
            };

            // 3. Actualizar usuario en BD con datos del CSV
            await this.databaseService.db
                .update(users)
                .set({
                    dni: csvData.dni,
                    // Sobrescribir NSS con el valor del CSV si existe, en caso contrario mantener el existente
                    nss: csvData.nss || existingUser.nss,
                    name: csvData.name,
                    first_surname: csvData.first_surname,
                    second_surname: csvData.second_surname,
                    email: csvData.email || existingUser.email, // Usar email CSV o mantener BD
                    updatedAt: new Date()
                })
                .where(eq(users.id_user, userId));

            this.logger.debug(`✅ Usuario actualizado en BD con datos del CSV`);

            // 4. Actualizar registro import_decisions para futuras comparaciones
            await this.databaseService.db
                .update(import_decisions)
                .set({
                    // Actualizar campos de comparación con datos BD actuales (para evitar futuras decisiones)
                    dni_csv: existingUser.dni,           // DNI que ESTABA en BD
                    name_csv: existingUser.name,         // Nombre que ESTABA en BD  
                    first_surname_csv: existingUser.first_surname,
                    second_surname_csv: existingUser.second_surname,
                    
                    // Guardar metadatos del cambio
                    change_metadata: changeMetadata,
                    
                    // Marcar como procesado
                    processed: true,
                    decision_action: 'update_and_link',
                    updated_at: new Date()
                })
                .where(eq(import_decisions.id, decision.id));

            this.logger.debug(`✅ Registro import_decisions actualizado para futuras comparaciones`);

            // 5. Procesar empresa/centro del CSV (reutilizar lógica existente)
            const result = await this.linkUserToCSVData(userId, csvData);
            
            if (!result.success) {
                throw new Error(result.error_message || 'Error procesando empresa/centro del CSV');
            }

            this.logger.debug(`✅ Update_and_link completado exitosamente:`, {
                user_id: userId,
                company_id: result.company_id,
                center_id: result.center_id,
                updated_fields: changeMetadata.updated_fields
            });

        } catch (error) {
            this.logger.error(`❌ Error ejecutando update_and_link para decisión ${decision.id}:`, error);
            throw error;
        }
    }

    /**
     * Revierte un update_and_link restaurando los datos originales del usuario
     */
    private async revertUpdateAndLink(decisionRecord: any, reason?: string): Promise<void> {
        try {
            const metadata = decisionRecord.change_metadata;
            
            if (!metadata || !metadata.original_bd) {
                throw new Error('No se puede revertir update_and_link: faltan metadatos de cambio originales');
            }

            const userId = decisionRecord.selected_user_id;
            if (!userId) {
                throw new Error('No se puede revertir update_and_link: falta selected_user_id');
            }

            this.logger.debug(`🔄 Revirtiendo update_and_link para usuario ${userId}, decisión ${decisionRecord.id}`);
            this.logger.debug(`📋 Restaurando datos originales de BD:`, metadata.original_bd);

            // 1. Restaurar datos originales del usuario en BD
            await this.databaseService.db
                .update(users)
                .set({
                    dni: metadata.original_bd.dni,
                    name: metadata.original_bd.name,
                    first_surname: metadata.original_bd.first_surname,
                    second_surname: metadata.original_bd.second_surname,
                    email: metadata.original_bd.email,
                    updatedAt: new Date()
                })
                .where(eq(users.id_user, userId));

            this.logger.debug(`✅ Datos del usuario restaurados en BD`);

            // 2. Restaurar campos de comparación originales en import_decisions
            await this.databaseService.db
                .update(import_decisions)
                .set({
                    processed: false,
                    decision_action: null,
                    
                    // Restaurar campos de comparación originales del CSV
                    dni_csv: metadata.original_csv.dni,
                    name_csv: metadata.original_csv.name,
                    first_surname_csv: metadata.original_csv.first_surname,
                    second_surname_csv: metadata.original_csv.second_surname,
                    
                    // Limpiar metadatos
                    change_metadata: null,
                    
                    // Agregar nota de reversión
                    notes: reason ? 
                        `${decisionRecord.notes || ''}\n[REVERTIDA UPDATE_AND_LINK] ${reason}`.trim() : 
                        `${decisionRecord.notes || ''}\n[REVERTIDA UPDATE_AND_LINK] ${new Date().toISOString()}`.trim(),
                    
                    updated_at: new Date()
                })
                .where(eq(import_decisions.id, decisionRecord.id));

            this.logger.debug(`✅ Registro import_decisions restaurado a estado pendiente`);

            // 3. NOTA: No revertir relaciones empresa/centro por seguridad
            // Las relaciones laborales se mantienen ya que podrían afectar otros datos

            this.logger.debug(`✅ Update_and_link revertido exitosamente. Datos personales restaurados, relaciones laborales mantenidas.`);

        } catch (error: any) {
            this.logger.error(`❌ Error revirtiendo update_and_link:`, error.message);
            throw new Error(`Error revirtiendo update_and_link: ${error.message}`);
        }
    }

    /**
     * Fuerza la creación de un usuario usando processUserRecord pero saltando búsquedas de similitud
     */
    private async forceCreateUserRecord(data: ProcessedUserData): Promise<ProcessingResult> {
        try {
            // 1. Buscar o crear empresa (reutilizar lógica existente)
            const company = await this.findOrCreateCompany(data);
            
            // 2. Buscar o crear centro (reutilizar lógica existente)
            const center = await this.findOrCreateCenter(data, company.id_company);
            
            // 3. Crear usuario directamente (saltear búsquedas de similitud)
            const newUser = await this.createNewUser(data);
            
            // 4. Crear/actualizar relación usuario-centro (reutilizar lógica existente)
            await this.processUserCenterRelation(newUser.id_user, center.id_center, data);

            // 5. Verificar centro principal (reutilizar lógica existente)
            await this.ensureMainCenter(newUser.id_user);

            return {
                success: true,
                action: 'created',
                user_id: newUser.id_user,
                company_id: company.id_company,
                center_id: center.id_center
            };

        } catch (error: any) {
            this.logger.error(`Error en creación forzada de usuario: ${error?.message || error}`, data);
            
            // CRÍTICO: Asegurar que el usuario se guarde en el sistema de respaldo
            await this.createFailedUserRecord(data, `Error en forceCreateUserRecord: ${error?.message || error}`);
            
            return {
                success: false,
                action: 'error',
                error_message: error?.message || error.toString()
            };
        }
    }

    /**
     * Ejecuta el enlace con un usuario existente procesando todos los datos del CSV
     */
    private async executeLinkUser(decision: any, selectedUserId?: number): Promise<void> {
        try {
            const userId = selectedUserId || decision.selected_user_id;
            
            if (!userId) {
                throw new Error('No se proporcionó ID de usuario para vincular');
            }

            // Recrear ProcessedUserData para obtener TODOS los datos del CSV
            const userData: ProcessedUserData = this.normalizeCSVRow(decision.csv_row_data, decision.id);
            
            this.logger.debug(`🔗 Vinculando usuario ${userId} con datos del CSV`);
            this.logger.debug(`🏢 Procesando empresa y centro para vinculación:`, {
                company_name: userData.company_name,
                center_name: userData.center_name,
                start_date: userData.start_date,
                end_date: userData.end_date
            });
            
            // Verificar que el usuario existe
            const [existingUser] = await this.databaseService.db
                .select()
                .from(users)
                .where(eq(users.id_user, userId))
                .limit(1);

            if (!existingUser) {
                throw new Error(`Usuario con ID ${userId} no encontrado`);
            }

            // Usar linkUserToCSVData que procesa todos los datos del CSV sin sobrescribir datos del usuario
            const result = await this.linkUserToCSVData(userId, userData);
            
            if (result.success) {
                this.logger.debug(`✅ Usuario ${userId} vinculado exitosamente con datos del CSV procesados:`, {
                    action: result.action,
                    company_id: result.company_id,
                    center_id: result.center_id
                });
            } else {
                throw new Error(result.error_message || 'Error vinculando usuario con datos CSV');
            }
            
        } catch (error) {
            this.logger.error(`❌ Error ejecutando vinculación para decisión ${decision.id}:`, error);
            throw error;
        }
    }

    /**
     * Vincula un usuario existente con datos del CSV (empresa/centro/fechas)
     */
    private async linkUserToCSVData(userId: number, data: ProcessedUserData): Promise<ProcessingResult> {
        try {
            this.logger.debug(`🔗 Procesando vinculación de usuario ${userId} con datos del CSV:`, {
                company: data.company_name,
                center: data.center_name,
                start_date: data.start_date?.toISOString().split('T')[0],
                end_date: data.end_date?.toISOString().split('T')[0]
            });

            // 1. Buscar o crear empresa (reutilizar lógica existente)
            const company = await this.findOrCreateCompany(data);
            this.logger.debug(`🏢 Empresa procesada: ${company.company_name} (ID: ${company.id_company})`);
            
            // 2. Buscar o crear centro (reutilizar lógica existente)
            const center = await this.findOrCreateCenter(data, company.id_company);
            this.logger.debug(`🏬 Centro procesado: ${center.center_name} (ID: ${center.id_center})`);
            
            // 3. Crear/actualizar relación usuario-centro con fechas del CSV (reutilizar lógica existente)
            await this.processUserCenterRelation(userId, center.id_center, data);
            this.logger.debug(`📅 Relación usuario-centro procesada con fechas del CSV`);

            // 4. Verificar centro principal (reutilizar lógica existente)
            await this.ensureMainCenter(userId);

            return {
                success: true,
                action: 'linked',
                user_id: userId,
                company_id: company.id_company,
                center_id: center.id_center
            };

        } catch (error: any) {
            this.logger.error(`Error vinculando usuario ${userId} con datos CSV: ${error?.message || error}`, data);
            
            return {
                success: false,
                action: 'error',
                error_message: error?.message || error.toString()
            };
        }
    }

    /**
     * Obtiene los usuarios que fallaron al importarse
     */
    async getFailedUsers(page: number = 1, limit: number = 50) {
        try {
            const offset = (page - 1) * limit;
            
            // Crear tabla si no existe
            await this.databaseService.db.execute(sql`
                CREATE TABLE IF NOT EXISTS failed_user_imports (
                    id SERIAL PRIMARY KEY,
                    dni VARCHAR(20),
                    name VARCHAR(100),
                    first_surname VARCHAR(100),
                    second_surname VARCHAR(100),
                    email VARCHAR(255),
                    import_id VARCHAR(50),
                    nss VARCHAR(20),
                    company_name VARCHAR(255),
                    center_name VARCHAR(255),
                    csv_row_data JSONB NOT NULL,
                    failure_reason TEXT,
                    import_source VARCHAR(50) DEFAULT 'sage',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);

            // Obtener usuarios fallidos con paginación
            const results = await this.databaseService.db.execute(sql`
                SELECT 
                    id, dni, name, first_surname, second_surname, email, 
                    import_id, nss, company_name, center_name, 
                    failure_reason, import_source, created_at
                FROM failed_user_imports 
                ORDER BY created_at DESC 
                LIMIT ${limit} OFFSET ${offset}
            `);

            // Obtener el total de registros
            const countResult = await this.databaseService.db.execute(sql`
                SELECT COUNT(*) as total FROM failed_user_imports
            `);

            const total = (countResult as any).rows?.[0]?.total || 0;

            return {
                users: (results as any).rows || [],
                pagination: {
                    page,
                    limit,
                    total: parseInt(total),
                    totalPages: Math.ceil(parseInt(total) / limit)
                }
            };

        } catch (error: any) {
            this.logger.error('Error obteniendo usuarios fallidos:', error.message);
            return {
                users: [],
                pagination: { page, limit, total: 0, totalPages: 0 }
            };
        }
    }

    /**
     * Obtiene estadísticas de usuarios fallidos
     */
    async getFailedUsersStats() {
        try {
            await this.databaseService.db.execute(sql`
                CREATE TABLE IF NOT EXISTS failed_user_imports (
                    id SERIAL PRIMARY KEY,
                    dni VARCHAR(20),
                    name VARCHAR(100),
                    first_surname VARCHAR(100),
                    second_surname VARCHAR(100),
                    email VARCHAR(255),
                    import_id VARCHAR(50),
                    nss VARCHAR(20),
                    company_name VARCHAR(255),
                    center_name VARCHAR(255),
                    csv_row_data JSONB NOT NULL,
                    failure_reason TEXT,
                    import_source VARCHAR(50) DEFAULT 'sage',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                )
            `);

            const stats = await this.databaseService.db.execute(sql`
                SELECT 
                    COUNT(*) as total,
                    COUNT(DISTINCT company_name) as companies,
                    COUNT(DISTINCT center_name) as centers,
                    COUNT(DISTINCT failure_reason) as unique_errors
                FROM failed_user_imports
            `);

            const reasonStats = await this.databaseService.db.execute(sql`
                SELECT 
                    failure_reason,
                    COUNT(*) as count
                FROM failed_user_imports
                GROUP BY failure_reason
                ORDER BY count DESC
            `);

            return {
                total: (stats as any).rows?.[0]?.total || 0,
                companies: (stats as any).rows?.[0]?.companies || 0,
                centers: (stats as any).rows?.[0]?.centers || 0,
                uniqueErrors: (stats as any).rows?.[0]?.unique_errors || 0,
                errorBreakdown: (reasonStats as any).rows || []
            };

        } catch (error: any) {
            this.logger.error('Error obteniendo estadísticas de usuarios fallidos:', error.message);
            return {
                total: 0,
                companies: 0,
                centers: 0,
                uniqueErrors: 0,
                errorBreakdown: []
            };
        }
    }

    /**
     * Obtiene las decisiones procesadas (completadas)
     */
    async getProcessedDecisions(filters?: {
        action?: string;
        startDate?: Date;
        endDate?: Date;
        search?: string;
    }) {
        try {
            const conditions = [eq(import_decisions.processed, true)];

            // Aplicar filtros
            if (filters?.action) {
                conditions.push(eq(import_decisions.decision_action, filters.action));
            }

            if (filters?.startDate) {
                conditions.push(gte(import_decisions.created_at, filters.startDate));
            }

            if (filters?.endDate) {
                conditions.push(lte(import_decisions.created_at, filters.endDate));
            }

            const decisions = await this.databaseService.db
                .select()
                .from(import_decisions)
                .where(and(...conditions))
                .orderBy(desc(import_decisions.created_at));

            // Aplicar filtro de búsqueda después de obtener los datos
            if (filters?.search) {
                const searchLower = filters.search.toLowerCase();
                return decisions.filter(decision => 
                    decision.name_csv?.toLowerCase().includes(searchLower) ||
                    decision.first_surname_csv?.toLowerCase().includes(searchLower) ||
                    decision.dni_csv?.toLowerCase().includes(searchLower)
                );
            }

            return decisions;

        } catch (error: any) {
            this.logger.error('Error obteniendo decisiones procesadas:', error.message);
            throw new Error(`Error obteniendo decisiones procesadas: ${error.message}`);
        }
    }

    /**
     * Revierte una decisión procesada para que vuelva a estar pendiente
     */
    async revertDecision(decisionId: number, reason?: string): Promise<void> {
        try {
            // Verificar que la decisión existe y está procesada
            const decision = await this.databaseService.db
                .select()
                .from(import_decisions)
                .where(eq(import_decisions.id, decisionId))
                .limit(1);

            if (!decision.length) {
                throw new Error('Decisión no encontrada');
            }

            const decisionRecord = decision[0];

            if (!decisionRecord.processed) {
                throw new Error('La decisión no está procesada');
            }

            // Solo permitir revertir decisiones de tipo "skip", "link" y "update_and_link"
            if (!['skip', 'link', 'update_and_link'].includes(decisionRecord.decision_action)) {
                throw new Error('Solo se pueden revertir decisiones omitidas (skip), vinculadas (link) o actualizadas (update_and_link)');
            }

            // Manejar reversión especial para update_and_link
            if (decisionRecord.decision_action === 'update_and_link') {
                await this.revertUpdateAndLink(decisionRecord, reason);
                return;
            }

            // Revertir la decisión normal (skip/link)
            await this.databaseService.db
                .update(import_decisions)
                .set({
                    processed: false,
                    decision_action: null,
                    notes: reason ? `${decisionRecord.notes || ''}\n[REVERTIDA] ${reason}`.trim() : decisionRecord.notes,
                    updated_at: new Date()
                })
                .where(eq(import_decisions.id, decisionId));

            this.logger.debug(`Decisión ${decisionId} revertida a pendiente. Razón: ${reason || 'No especificada'}`);

        } catch (error: any) {
            this.logger.error('Error revirtiendo decisión:', error.message);
            throw new Error(`Error revirtiendo decisión: ${error.message}`);
        }
    }
}