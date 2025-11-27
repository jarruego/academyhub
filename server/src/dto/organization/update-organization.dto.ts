import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsObject } from "class-validator";

export class UpdateOrganizationSettingsDTO {
  @ApiPropertyOptional({ description: 'Free-form settings JSON for the organization' })
  @IsOptional()
  @IsObject()
  settings?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Encrypted secrets JSON (opaque)' })
  @IsOptional()
  @IsObject()
  encrypted_secrets?: Record<string, any>;
}
