import { ApiPropertyOptional, ApiProperty } from "@nestjs/swagger";
import { IsOptional, IsString, ValidateNested, IsArray, IsIn, IsInt, IsEmail, ArrayNotEmpty } from "class-validator";
import { Type } from "class-transformer";
import { ReportFilterDTO } from "src/dto/reports/report-filter.dto";

/**
 * 'dedication_passwords' es un adjunto DISTINTO (no un modificador de
 * 'dedication'): un PDF de Dedicación aparte que además incluye usuario/clave
 * Moodle, para poder enviar ambos a la vez (uno "limpio" para el centro, otro
 * con credenciales) o solo el que corresponda. Restringido a ADMIN/MANAGER en
 * el controlador — ver docs/security.md.
 */
export type ReportAttachmentType = 'dedication' | 'dedication_passwords' | 'certification';

export class ReportSendRecipientDTO {
  /** Clave del grupo devuelta por `POST /reports/send/groups` (`req:<id_request>` o `ctr:<id_center>`). */
  @ApiProperty()
  @IsString()
  group_key: string;

  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayNotEmpty()
  @IsEmail({}, { each: true })
  emails: string[];
}

/**
 * Envío por correo de los informes de Dedicación/Certificado, agrupados por
 * **petición** (un correo por petición, con el `contact_email` de esa petición
 * como destinatario por defecto): los alumnos que no se puedan asociar a
 * ninguna petición (matriculados a mano/Excel/Moodle) caen en un grupo de
 * fallback por **centro**, sin destinatario sugerido — ver
 * `ReportsMailService.buildSendGroups`. Comparte la selección de filas con
 * ReportExportDTO (filter/selected_keys/select_all_matching/deselected_keys)
 * para reutilizar ReportsService.resolveRows.
 */
export class ReportSendDTO {
  @ApiPropertyOptional({ type: ReportFilterDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportFilterDTO)
  filter?: ReportFilterDTO;

  @ApiPropertyOptional({ description: 'Claves explícitas id_user-id_group a enviar (overrides filter)' })
  @IsOptional()
  selected_keys?: string[];

  @ApiPropertyOptional({ description: 'Si es true, envía todo lo que matchea el filtro salvo deselected_keys' })
  @IsOptional()
  select_all_matching?: boolean;

  @ApiPropertyOptional({ description: 'Claves a excluir cuando select_all_matching es true' })
  @IsOptional()
  deselected_keys?: string[];

  @ApiProperty({ type: [String], enum: ['dedication', 'dedication_passwords', 'certification'], isArray: true })
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(['dedication', 'dedication_passwords', 'certification'], { each: true })
  attach: ReportAttachmentType[];

  @ApiPropertyOptional({ type: [ReportSendRecipientDTO], description: 'Destinatarios resueltos por centro (requerido salvo en /send/test)' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportSendRecipientDTO)
  recipients?: ReportSendRecipientDTO[];

  @ApiProperty({ enum: ['template', 'custom'] })
  @IsIn(['template', 'custom'])
  send_mode: 'template' | 'custom';

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  template_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from_email?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  from_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reply_to?: string;

  @ApiPropertyOptional({ description: 'Solo para /reports/send/test: envía una única copia a esta dirección' })
  @IsOptional()
  @IsEmail()
  test_email?: string;
}
