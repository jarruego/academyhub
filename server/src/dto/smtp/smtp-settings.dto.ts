import { IsString, IsInt, IsBoolean, IsOptional, IsEmail } from 'class-validator';

export class SmtpSettingsDto {
  @IsString()
  host!: string;

  @IsInt()
  port!: number;

  @IsString()
  user!: string;

  @IsString()
  password!: string;

  @IsBoolean()
  secure!: boolean;

  @IsEmail()
  from_email!: string;

  @IsOptional()
  @IsString()
  from_name?: string;
}
