import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsObject } from "class-validator";

export class UpdateOrganizationSettingsDTO {
  @ApiPropertyOptional({ description: 'Free-form settings JSON for the organization. Recommended keys: settings.company.cif, settings.company.razon_social, settings.company.direccion, settings.company.ciudad, settings.company.responsable_nombre, settings.company.responsable_dni, settings.sftp (con campos host, port, user, password, path)' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Encrypted secrets JSON (opaque)' })
  @IsOptional()
  @IsObject()
  encrypted_secrets?: Record<string, any>;
}

