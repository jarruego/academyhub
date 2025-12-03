import { ApiPropertyOptional } from "@nestjs/swagger";

export class ReportRowDTO {
  @ApiPropertyOptional()
  id_user?: number;

  @ApiPropertyOptional()
  id_group?: number;
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional()
  first_surname?: string;

  @ApiPropertyOptional()
  second_surname?: string;

  @ApiPropertyOptional()
  dni?: string;

  @ApiPropertyOptional()
  email?: string;

  @ApiPropertyOptional()
  phone?: string;

  @ApiPropertyOptional()
  center_name?: string;

  @ApiPropertyOptional()
  employer_number?: string;

  @ApiPropertyOptional()
  company_name?: string;

  @ApiPropertyOptional()
  company_cif?: string;

  @ApiPropertyOptional()
  group_name?: string;

  @ApiPropertyOptional()
  group_start_date?: Date | string;

  @ApiPropertyOptional()
  group_end_date?: Date | string;

  @ApiPropertyOptional()
  role_shortname?: string;

  @ApiPropertyOptional()
  completion_percentage?: number | string;

  @ApiPropertyOptional()
  course_name?: string;

  @ApiPropertyOptional()
  hours?: number;

  @ApiPropertyOptional()
  modality?: string;

  @ApiPropertyOptional()
  moodle_id?: number | null;

  @ApiPropertyOptional()
  moodle_username?: string | null;

  @ApiPropertyOptional()
  moodle_password?: string | null;
}
