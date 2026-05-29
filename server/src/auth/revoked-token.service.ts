import { Injectable } from "@nestjs/common";
import { RevokedTokenRepository } from "./revoked-token.repository";

@Injectable()
export class RevokedTokenService {
  constructor(private readonly revokedTokenRepository: RevokedTokenRepository) {}

  async revoke(jti: string, exp: number): Promise<void> {
    await this.revokedTokenRepository.insert(jti, new Date(exp * 1000));
  }

  async isRevoked(jti: string): Promise<boolean> {
    return this.revokedTokenRepository.exists(jti);
  }

  async cleanupExpired(): Promise<void> {
    await this.revokedTokenRepository.deleteExpired();
  }
}
