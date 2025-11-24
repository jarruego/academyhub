import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsInt, IsString, IsDateString, IsArray } from "class-validator";
import { Type } from "class-transformer";

export class ReportFilterDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  id_company?: number[];

  @ApiPropertyOptional({ type: [Number] })
  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true })
  id_center?: number[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  id_course?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  id_role?: number;

  @ApiPropertyOptional({ type: String, description: 'Search across name, dni and email' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: String, description: 'Start date (ISO) to filter group start_date >= start_date' })
  @IsOptional()
  @IsDateString()
  start_date?: string;

  @ApiPropertyOptional({ type: String, description: 'End date (ISO) to filter group end_date <= end_date' })
  @IsOptional()
  @IsDateString()
  end_date?: string;

  @ApiPropertyOptional({ type: String, description: 'Field to sort by (column key)' })
  @IsOptional()
  @IsString()
  sort_field?: string;

  @ApiPropertyOptional({ type: String, description: 'Sort order: asc or desc' })
  @IsOptional()
  @IsString()
  sort_order?: 'asc' | 'desc';
}
