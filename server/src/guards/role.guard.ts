import { CanActivate, ExecutionContext, Injectable, mixin, Type, UnauthorizedException } from "@nestjs/common";
import { JwtPayload } from "src/auth/auth.service";
import { Role } from "./role.enum";


export function RoleGuard(roles: Role[]): Type<CanActivate> {
    @Injectable()
    class RoleGuardMixin implements CanActivate {
        canActivate(context: ExecutionContext): boolean {
            const request = context.switchToHttp().getRequest();
            const user = request.user as JwtPayload;

            if (!user) throw new UnauthorizedException();
            if (!roles.includes(user.role)) throw new UnauthorizedException();

            return true;
        }
    }

    return mixin(RoleGuardMixin);
}