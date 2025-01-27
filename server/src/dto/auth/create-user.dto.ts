
import { IsNotEmpty, IsString, IsEmail, MinLength } from 'class-validator';

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
}