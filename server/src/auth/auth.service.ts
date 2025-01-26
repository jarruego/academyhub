
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { LoginDTO } from "src/dto/auth/login.dto";
import { compareHashWithSalt } from "src/utils/crypto/password-hashing.util";
import { AuthUserService } from "./auth_user/auth_user.service";

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
      // TODO: rol
    };

    const {password: _, ...userWithoutPassword} = user;

    return { token: await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
    }), user: userWithoutPassword };
  }
}
