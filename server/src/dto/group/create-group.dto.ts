import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsString, IsInt, IsDate, IsOptional, IsEnum } from "class-validator";
import { GroupActiveMode } from "src/types/group/group-active-mode.enum";

export class CreateGroupDTO {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  moodle_id: number;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  group_name: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsInt()
  id_course: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  start_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDate()
  @Type(() => Date)
  end_date: Date;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fundae_id: string;

  @ApiPropertyOptional({ enum: GroupActiveMode })
  @IsOptional()
  @IsEnum(GroupActiveMode)
  active_mode?: GroupActiveMode;
}
