import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsDefined,
    IsEmail,
    IsIn,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Max,
    Min,
    ValidateIf,
    ValidateNested,
} from 'class-validator';

/**
 * DTOs de validación para `organization_settings.settings`.
 * La forma canónica del modelo vive en
 * `src/api/organization/organization-settings.model.ts`; estos DTOs validan la
 * entrada del PATCH. Con el ValidationPipe global (`whitelist: true`) cualquier
 * clave desconocida (typo) se elimina en lugar de guardarse en silencio.
 */

const trim = ({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value;

export class OrganizationContactDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional()
    @Transform(trim)
    @ValidateIf((_, value) => typeof value === 'string' && value.length > 0)
    @IsEmail({}, { message: 'contact.email no es un email válido' })
    email?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    phone?: string;
}

export class OrganizationCompanyDto {
    @ApiProperty()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'company.cif es obligatorio' })
    cif!: string;

    @ApiProperty()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'company.razon_social es obligatorio' })
    razon_social!: string;

    @ApiProperty()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'company.direccion es obligatorio' })
    direccion!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    ciudad?: string;

    @ApiProperty()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'company.responsable_nombre es obligatorio' })
    responsable_nombre!: string;

    @ApiProperty()
    @Transform(trim)
    @IsString()
    @IsNotEmpty({ message: 'company.responsable_dni es obligatorio' })
    responsable_dni!: string;
}

export class MoodleCustomFieldDto {
    @ApiProperty({ description: "shortname del custom field en Moodle (p. ej. 'DNI')" })
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    shortname!: string;

    @ApiProperty({ description: "campo origen en la tabla user (p. ej. 'dni')" })
    @Transform(trim)
    @IsString()
    @IsNotEmpty()
    source!: string;
}

export class OrganizationMoodleDto {
    @ApiPropertyOptional({ description: 'URL base del Moodle' })
    @IsOptional()
    @IsString()
    url?: string;

    @ApiPropertyOptional({ type: [MoodleCustomFieldDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => MoodleCustomFieldDto)
    customfields?: MoodleCustomFieldDto[];
}

export class OrganizationFileTransferDto {
    @ApiPropertyOptional({ enum: ['ftp', 'sftp'] })
    @IsOptional()
    @IsIn(['ftp', 'sftp'], { message: "file_transfer.type debe ser 'ftp' o 'sftp'" })
    type?: 'ftp' | 'sftp';

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    host?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @Type(() => Number)
    @IsInt({ message: 'file_transfer.port debe ser un número entero' })
    @Min(1)
    @Max(65535)
    port?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    user?: string;

    @ApiPropertyOptional({
        description:
            'Contraseña FTP/SFTP (solo escritura). Se cifra en encrypted_secrets y nunca se devuelve; vacía = conservar la existente.',
    })
    @IsOptional()
    @IsString()
    password?: string;

    @ApiPropertyOptional({ description: 'Ruta del fichero en el servidor remoto (p. ej. /datos.7z)' })
    @IsOptional()
    @IsString()
    path?: string;
}

export class OrganizationPluginsDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    itop_training?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    configurable_reports?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    certificates?: boolean;

    @ApiPropertyOptional()
    @IsOptional()
    @IsBoolean()
    progress_bar?: boolean;
}

export class OrganizationSettingsDto {
    @ApiPropertyOptional({ description: 'Nombre del centro (informes y cabeceras)' })
    @IsOptional()
    @IsString()
    site_name?: string;

    @ApiPropertyOptional({ type: OrganizationContactDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => OrganizationContactDto)
    contact?: OrganizationContactDto;

    @ApiProperty({ type: OrganizationCompanyDto, description: 'Datos fiscales (obligatorios para informes SEPE/FUNDAE)' })
    @IsDefined({ message: 'company es obligatorio' })
    @ValidateNested()
    @Type(() => OrganizationCompanyDto)
    company!: OrganizationCompanyDto;

    @ApiPropertyOptional({ type: OrganizationMoodleDto })
    @IsOptional()
    @ValidateNested()
    @Type(() => OrganizationMoodleDto)
    moodle?: OrganizationMoodleDto;

    @ApiPropertyOptional({ type: OrganizationFileTransferDto, description: 'Conexión FTP/SFTP para la importación automática SAGE' })
    @IsOptional()
    @ValidateNested()
    @Type(() => OrganizationFileTransferDto)
    file_transfer?: OrganizationFileTransferDto;

    @ApiPropertyOptional({ type: OrganizationPluginsDto, description: 'Plugins instalados en Moodle' })
    @IsOptional()
    @ValidateNested()
    @Type(() => OrganizationPluginsDto)
    plugins?: OrganizationPluginsDto;
}
