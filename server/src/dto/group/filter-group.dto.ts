
import { Type } from "class-transformer";
import { IsOptional, IsString, IsInt, IsDate } from "class-validator";
import { GroupSelectModel } from "src/database/schema/tables/group.table";

export class FilterGroupDTO implements Partial<GroupSelectModel> {
  @IsOptional()
  @IsInt()
  moodle_id?: number;

  @IsOptional()
  @IsString()
  group_name?: string;

  @IsOptional()
  @IsInt()
  id_course?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date?: Date;

  @IsOptional()
  @IsDate()
  @Type(() => Date)
  end_date?: Date;

  
  @IsOptional()
  @IsString()
  fundae_id?: string;
}