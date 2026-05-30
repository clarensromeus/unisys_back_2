import { createHash, randomBytes } from 'crypto';
import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { User, UserRole } from '@prisma/client';
import { EmailService } from '../../common/utils/email.service';
import { notifyUser } from '../../common/utils/notification.util';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../common/utils/redis.service';
import { hashSecret, verifySecret } from '../../common/utils/password.util';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email is already registered');
    const organizationId = await defaultOrganizationId(this.prisma);
    const blockedSelfSignupRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.TENANT_ADMIN, UserRole.ADMIN];
    const role = blockedSelfSignupRoles.includes(dto.role)
      ? UserRole.STUDENT
      : dto.role;

    const user = await this.prisma.user.create({
      data: {
        organizationId,
        email: dto.email,
        password: await hashSecret(dto.password, this.config.get<number>('bcryptRounds') ?? 12),
        role,
      },
    });
    return this.withTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { organization: { select: { slug: true, status: true } } },
    });
    if (!user || !(await verifySecret(dto.password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.isActive || user.deletedAt || user.organization?.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }
    if (dto.tenantSlug && user.role !== UserRole.SUPER_ADMIN && user.organization.slug !== dto.tenantSlug) {
      throw new UnauthorizedException('Invalid tenant for this account');
    }
    return this.withTokens(user);
  }

  async refresh(refreshToken: string) {
    const payload = await this.jwt.verifyAsync<{ sub: string }>(refreshToken, {
      secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
    });
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !(await verifySecret(refreshToken, user.refreshToken))) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    return this.withTokens(user);
  }

  async logout(userId: string, accessToken?: string) {
    await this.prisma.user.update({ where: { id: userId }, data: { refreshToken: null } });
    if (accessToken) await this.redis.blacklistToken(accessToken, 15 * 60);
    return { message: 'Logged out' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email, isActive: true, deletedAt: null },
      select: { id: true, organizationId: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      return { message: 'If an account exists for that email, password reset instructions have been sent.' };
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashToken(token);
    await this.redis.set(`password-reset:${tokenHash}`, { userId: user.id, email: user.email }, 30 * 60);

    const resetUrl = `${this.config.get<string>('frontendUrl') ?? 'http://localhost:5174'}/#reset-password?token=${encodeURIComponent(token)}`;
    const displayName = this.displayName(user);

    try {
      await this.email.send({
        to: user.email,
        subject: 'Reset your UNISYS password',
        idempotencyKey: `password-reset-${tokenHash}`,
        text: `Hello ${displayName}, reset your password using this link. It expires in 30 minutes: ${resetUrl}`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
            <h2 style="margin:0 0 12px">Reset your password</h2>
            <p>Hello ${this.escapeHtml(displayName)},</p>
            <p>Use the secure link below to change your UNISYS ERP password. This link expires in 30 minutes.</p>
            <p><a href="${resetUrl}" style="display:inline-block;margin-top:8px;padding:10px 14px;border-radius:10px;background:#4f46e5;color:#fff;text-decoration:none;font-weight:700">Change password</a></p>
            <p style="margin-top:20px;color:#64748b;font-size:13px">If you did not request this, you can ignore this email.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.warn(`Password reset email failed for ${user.email}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { message: 'If an account exists for that email, password reset instructions have been sent.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const tokenHash = this.hashToken(dto.token);
    const reset = await this.redis.get<{ userId: string; email: string }>(`password-reset:${tokenHash}`);
    if (!reset?.userId) throw new BadRequestException('Password reset link is invalid or expired');

    const user = await this.prisma.user.update({
      where: { id: reset.userId },
      data: {
        password: await hashSecret(dto.password, this.config.get<number>('bcryptRounds') ?? 12),
        refreshToken: null,
      },
      select: {
        id: true,
        organizationId: true,
        email: true,
        firstName: true,
        lastName: true,
      },
    });
    await this.redis.del(`password-reset:${tokenHash}`);

    await notifyUser(this.prisma, {
      organizationId: user.organizationId,
      userId: user.id,
      type: 'SYSTEM',
      priority: 'HIGH',
      title: 'Password changed',
      body: 'Your account password was changed successfully.',
      entityType: 'User',
      entityId: user.id,
      link: '/profile',
    });

    try {
      await this.email.send({
        to: user.email,
        subject: 'Your UNISYS password was changed',
        idempotencyKey: `password-changed-${user.id}-${Date.now()}`,
        text: `Hello ${this.displayName(user)}, your UNISYS ERP password was changed successfully.`,
        html: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
            <h2 style="margin:0 0 12px">Password changed successfully</h2>
            <p>Hello ${this.escapeHtml(this.displayName(user))},</p>
            <p>Your UNISYS ERP password was changed successfully.</p>
            <p style="margin-top:20px;color:#64748b;font-size:13px">If this was not you, contact the university administrator immediately.</p>
          </div>
        `,
      });
    } catch (error) {
      this.logger.warn(`Password changed confirmation email failed for ${user.email}: ${error instanceof Error ? error.message : String(error)}`);
    }

    return { message: 'Password changed successfully. A confirmation email has been sent.' };
  }

  async me(userId: string) {
    return this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        photoUrl: true,
        isActive: true,
        organization: { select: { id: true, name: true, slug: true } },
        createdAt: true,
        updatedAt: true,
        student: true,
        teacher: true,
        staff: true,
      },
    });
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        firstName: dto.firstName?.trim(),
        lastName: dto.lastName?.trim(),
        phone: dto.phone?.trim(),
        photoUrl: dto.photoUrl?.trim(),
      },
      select: {
        id: true,
        organizationId: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        phone: true,
        photoUrl: true,
        isActive: true,
        organization: { select: { id: true, name: true, slug: true } },
        createdAt: true,
        updatedAt: true,
        student: true,
        teacher: true,
        staff: true,
      },
    });
  }

  private async withTokens(user: User) {
    const payload = { sub: user.id, email: user.email, role: user.role, organizationId: user.organizationId };
    const accessTtl = this.config.get<string>('jwt.accessTtl') ?? '15m';
    const refreshTtl = this.config.get<string>('jwt.refreshTtl') ?? '7d';
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.accessSecret'),
        expiresIn: accessTtl as never,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('jwt.refreshSecret'),
        expiresIn: refreshTtl as never,
      }),
    ]);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: await hashSecret(refreshToken, this.config.get<number>('bcryptRounds') ?? 12),
      },
    });

    return {
      user: this.safeUser(user),
      tokens: { accessToken, refreshToken },
    };
  }

  private safeUser(user: User) {
    const { password: _password, refreshToken: _refreshToken, ...safe } = user;
    return safe;
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private displayName(user: { email: string; firstName?: string | null; lastName?: string | null }) {
    return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  }

  private escapeHtml(value: string) {
    return value
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }
}
