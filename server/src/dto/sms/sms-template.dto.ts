import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SmsTemplateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  message!: string;
}
