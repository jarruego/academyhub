import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { LoginDTO } from "src/dto/auth/login.dto";
import { compareHashWithSalt } from "src/utils/crypto/password-hashing.util";
import { AuthUserService } from "./auth_user/auth_user.service";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";
import { hashWithSalt } from "src/utils/crypto/password-hashing.util";
import { Role } from "src/guards/role.enum";

export type JwtPayload = {
  id: number;
  username: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: AuthUserService,
    private readonly jwtService: JwtService
  ) {}

  async signIn({ username, password }: LoginDTO) {
    const user = await this.usersService.findByUsername(username);
    if (!user?.password || !compareHashWithSalt(user.password, password))
      throw new UnauthorizedException();

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
    };

    const {password: _, ...userWithoutPassword} = user;

    return { token: await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
    }), user: userWithoutPassword };
  }

  async signUp(createUserDto: CreateUserDTO) {
    const { username, password, email, name, lastName } = createUserDto;
    const hashedPassword = hashWithSalt(password);
    const newUser = await this.usersService.createUser({ username, password: hashedPassword, email, name, lastName });
    return newUser;
  }
}
