import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsOptional, IsObject, ValidateNested } from "class-validator";
import { OrganizationSettingsDto } from "./organization-settings.dto";

export class UpdateOrganizationSettingsDTO {
  @ApiPropertyOptional({ type: OrganizationSettingsDto, description: 'Ajustes de la organización (forma validada; las claves desconocidas se descartan)' })
  @IsOptional()
  @ValidateNested()
  @Type(() => OrganizationSettingsDto)
  settings?: OrganizationSettingsDto;

  @ApiPropertyOptional({ description: 'Secretos a cifrar/almacenar (opaco). Soporta moodle_token_plain / moodle_url_plain, que se cifran en el servidor.' })
  @IsOptional()
  @IsObject()
  encrypted_secrets?: Record<string, any>;
}
