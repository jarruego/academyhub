import { UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from './auth.guard';

describe('AuthGuard', () => {
  let guard: AuthGuard;
  let jwtService: { verifyAsync: jest.Mock };
  let reflector: { getAllAndOverride: jest.Mock };
  let revokedTokenService: { isRevoked: jest.Mock };

  beforeEach(() => {
    jwtService = { verifyAsync: jest.fn() };
    reflector = { getAllAndOverride: jest.fn().mockReturnValue(false) };
    revokedTokenService = { isRevoked: jest.fn().mockResolvedValue(false) };
    guard = new AuthGuard(jwtService as any, reflector as any, revokedTokenService as any);
  });

  const ctx = (req: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as any;

  it('permite rutas públicas sin token y sin validar JWT', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const req = { headers: {} };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('rechaza cuando no hay token', async () => {
    await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rechaza cuando la cabecera no es Bearer', async () => {
    await expect(
      guard.canActivate(ctx({ headers: { authorization: 'Basic abc' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
  });

  it('acepta un token válido no revocado y adjunta el payload a request.user', async () => {
    const payload = { id: 1, username: 'admin', role: 'admin', jti: 'jti-1' };
    jwtService.verifyAsync.mockResolvedValue(payload);
    const req: any = { headers: { authorization: 'Bearer good-token' } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toEqual(payload);
  });

  it('rechaza un token cuyo jti está revocado', async () => {
    jwtService.verifyAsync.mockResolvedValue({ id: 1, role: 'admin', jti: 'revoked' });
    revokedTokenService.isRevoked.mockResolvedValue(true);
    await expect(
      guard.canActivate(ctx({ headers: { authorization: 'Bearer t' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(revokedTokenService.isRevoked).toHaveBeenCalledWith('revoked');
  });

  it('rechaza un token inválido (verifyAsync lanza)', async () => {
    jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));
    await expect(
      guard.canActivate(ctx({ headers: { authorization: 'Bearer bad' } })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
