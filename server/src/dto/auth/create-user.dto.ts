
import { IsNotEmpty, IsString, IsEmail, MinLength, IsEnum, IsOptional } from 'class-validator';
import { Role } from 'src/guards/role.enum';

export class CreateUserDTO {
  @IsNotEmpty()
  @IsString()
  username: string;

  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  password: string;

  @IsNotEmpty()
  @IsEmail()
  email: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsString()
  lastName?: string;

  @IsString()
  @IsEnum(Role)
  @IsOptional()
  role?: Role;
}