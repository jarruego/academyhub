import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsBoolean, IsString, ValidateNested } from "class-validator";
import { Type } from "class-transformer";
import { ReportFilterDTO } from "src/dto/reports/report-filter.dto";

export class ReportExportDTO {
  @ApiPropertyOptional({ type: ReportFilterDTO })
  @IsOptional()
  @ValidateNested()
  @Type(() => ReportFilterDTO)
  filter?: ReportFilterDTO;

  @ApiPropertyOptional({ description: 'Report type, e.g. dedication' })
  @IsOptional()
  @IsString()
  report_type?: string;

  @ApiPropertyOptional({ description: 'Include passwords in the export (sensitive) - default false' })
  @IsOptional()
  @IsBoolean()
  include_passwords?: boolean;

  @ApiPropertyOptional({ description: 'Output format - currently only pdf' })
  @IsOptional()
  @IsString()
  format?: 'pdf' | 'csv';

  @ApiPropertyOptional({ description: 'Explicit selected row keys to export (overrides filter)' })
  @IsOptional()
  selected_keys?: string[];

  @ApiPropertyOptional({ description: 'If true, export all matching rows and apply deselected_keys as exclusions' })
  @IsOptional()
  select_all_matching?: boolean;

  @ApiPropertyOptional({ description: 'List of keys to exclude when select_all_matching is true' })
  @IsOptional()
  deselected_keys?: string[];
}
