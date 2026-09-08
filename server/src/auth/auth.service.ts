import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { randomUUID } from "crypto";
import { LoginDTO } from "src/dto/auth/login.dto";
import { compareHashWithSalt } from "src/utils/crypto/password-hashing.util";
import { AuthUserService } from "./auth_user/auth_user.service";
import { CreateUserDTO } from "src/dto/auth/create-user.dto";
import { hashWithSalt } from "src/utils/crypto/password-hashing.util";
import { Role } from "src/guards/role.enum";
import { RevokedTokenService } from "./revoked-token.service";

export type JwtPayload = {
  id: number;
  username: string;
  role: Role;
  // Permiso puntual, independiente del rol — ver auth_users.can_manage_candidates.
  // Como no hay refresh token, un cambio de flag no se aplica a una sesión ya
  // emitida hasta que el usuario vuelva a iniciar sesión (igual que el rol).
  can_manage_candidates?: boolean;
  jti: string;
  exp?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: AuthUserService,
    private readonly jwtService: JwtService,
    private readonly revokedTokenService: RevokedTokenService,
  ) {}

  async signIn({ username, password }: LoginDTO) {
    const user = await this.usersService.findByUsername(username);
    if (!user?.password || !compareHashWithSalt(user.password, password))
      throw new UnauthorizedException();

    const payload = {
      id: user.id,
      username: user.username,
      role: user.role,
      can_manage_candidates: user.can_manage_candidates,
      jti: randomUUID(),
    };

    const {password: _, ...userWithoutPassword} = user;

    return { token: await this.jwtService.signAsync(payload, {
      secret: process.env.JWT_SECRET,
    }), user: userWithoutPassword };
  }

  async logout(jti: string, exp: number): Promise<void> {
    await this.revokedTokenService.revoke(jti, exp);
  }

  /**
   * Reautenticación puntual: comprueba la contraseña del usuario YA
   * autenticado (identificado por el JWT, no por lo que mande el body) contra
   * su hash almacenado — mismo mecanismo que `signIn`, sin emitir un token
   * nuevo. Usado como paso de confirmación antes de acciones sensibles
   * (p. ej. importar Preinscripciones INAEM).
   */
  async verifyPassword(userId: number, password: string): Promise<boolean> {
    const user = await this.usersService.findById(userId);
    if (!user?.password) return false;
    return compareHashWithSalt(user.password, password);
  }

  async signUp(createUserDto: CreateUserDTO) {
    const { username, password, email, name, lastName, role } = createUserDto;
    const hashedPassword = hashWithSalt(password);
    const newUser = await this.usersService.createUser({ username, password: hashedPassword, email, name, lastName, role });
    return newUser;
  }
}
