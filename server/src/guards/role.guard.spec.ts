import { UnauthorizedException } from '@nestjs/common';
import { RoleGuard } from './role.guard';
import { Role } from './role.enum';

describe('RoleGuard', () => {
  const ctx = (user?: any) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as any;

  const makeGuard = (roles: Role[]) => new (RoleGuard(roles))();

  it('permite el acceso a un rol incluido en la lista', () => {
    const guard = makeGuard([Role.ADMIN, Role.MANAGER]);
    expect(guard.canActivate(ctx({ role: Role.ADMIN }))).toBe(true);
    expect(guard.canActivate(ctx({ role: Role.MANAGER }))).toBe(true);
  });

  it('rechaza un rol no incluido', () => {
    const guard = makeGuard([Role.ADMIN]);
    expect(() => guard.canActivate(ctx({ role: Role.VIEWER }))).toThrow(UnauthorizedException);
  });

  it('rechaza cuando no hay usuario en la request', () => {
    const guard = makeGuard([Role.ADMIN]);
    expect(() => guard.canActivate(ctx(undefined))).toThrow(UnauthorizedException);
  });
});
