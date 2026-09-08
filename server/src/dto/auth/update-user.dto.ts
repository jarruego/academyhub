import { IsString, IsEmail, MinLength, IsEnum, IsOptional, IsBoolean } from 'class-validator';
import { Role } from 'src/guards/role.enum';

export class UpdateUserDTO {
  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsString()
  @IsEnum(Role)
  role?: Role;

  // Permiso puntual, independiente del rol: importar Preinscritos INAEM
  // acotado a una edición — ver auth_users.can_import_inaem.
  @IsOptional()
  @IsBoolean()
  can_import_inaem?: boolean;
}
