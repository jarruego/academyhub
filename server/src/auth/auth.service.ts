
import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { LoginDTO } from "src/dto/auth/login.dto";
import { compareHashWithSalt } from "src/utils/crypto/password-hashing.util";
import { UserService } from "./user/user.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UserService,
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

    return { token: await this.jwtService.signAsync(payload) };
  }
}
