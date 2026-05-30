import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles?.length) return true;
    const request = context.switchToHttp().getRequest<{ user?: { role: UserRole } }>();
    if (!request.user) return false;
    if (request.user.role === UserRole.SUPER_ADMIN) return true;
    if (request.user.role === UserRole.TENANT_ADMIN && requiredRoles.includes(UserRole.ADMIN)) return true;
    return requiredRoles.includes(request.user.role);
  }
}
