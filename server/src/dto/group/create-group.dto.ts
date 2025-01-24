import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsNotEmpty, IsString, IsInt, IsDate, IsOptional } from "class-validator";

export class CreateGroupDTO {
  @ApiProperty()
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

  @ApiProperty()
  @IsOptional()
  @IsString()
  description: string;

  // @ApiProperty()
  // @IsOptional()
  // @IsDate()
  // @Type(() => Date)
  // start_date: Date;

  // @ApiProperty()
  // @IsOptional()
  // @IsDate()
  // @Type(() => Date)
  // end_date: Date;
}
