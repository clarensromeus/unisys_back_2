import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { hashSecret } from '../../common/utils/password.util';
import { ConfigService } from '@nestjs/config';
import { CreateSuperAdminDto } from './dto/create-superadmin.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateSuperAdminDto } from './dto/update-superadmin.dto';
import { UpdateUserPasswordDto } from './dto/update-user-password.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { defaultOrganizationId } from '../../common/utils/tenant.util';

const userSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  student: true,
  employee: true,
  teacher: true,
  staff: true,
};

const platformUserSelect = {
  id: true,
  email: true,
  role: true,
  firstName: true,
  lastName: true,
  phone: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async findAll(query: PaginationQueryDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const where = {
      organizationId,
      deletedAt: null,
      ...(query.search ? { email: { contains: query.search, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take, select: userSelect, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.user.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: userSelect });
  }

  async create(dto: CreateUserDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.user.create({
      data: {
        organizationId,
        email: dto.email,
        role: dto.role,
        password: await hashSecret(dto.password, this.config.get<number>('bcryptRounds') ?? 12),
      },
      select: userSelect,
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.user.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    const data = {
      ...dto,
      password: dto.password
        ? await hashSecret(dto.password, this.config.get<number>('bcryptRounds') ?? 12)
        : undefined,
    };
    return this.prisma.user.update({ where: { id }, data, select: userSelect });
  }

  async updatePassword(id: string, dto: UpdateUserPasswordDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.user.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.user.update({
      where: { id },
      data: {
        password: await hashSecret(dto.password, this.config.get<number>('bcryptRounds') ?? 12),
        refreshToken: null,
      },
      select: userSelect,
    });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.user.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.user.delete({ where: { id }, select: userSelect });
  }

  async findAllSuperAdmins(query: PaginationQueryDto) {
    const { skip, take, page, limit } = pagination(query);
    const where = this.superAdminWhere(query);
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take, select: platformUserSelect, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOneSuperAdmin(id: string) {
    return this.prisma.user.findFirstOrThrow({
      where: { id, role: UserRole.SUPER_ADMIN, deletedAt: null },
      select: platformUserSelect,
    });
  }

  async createSuperAdmin(dto: CreateSuperAdminDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { id: true } });

    return this.prisma.user.create({
      data: {
        organizationId,
        email: dto.email,
        password: await hashSecret(dto.password, this.config.get<number>('bcryptRounds') ?? 12),
        role: UserRole.SUPER_ADMIN,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        isActive: dto.isActive ?? true,
      },
      select: platformUserSelect,
    });
  }

  async updateSuperAdmin(id: string, dto: UpdateSuperAdminDto) {
    await this.findOneSuperAdmin(id);

    return this.prisma.user.update({
      where: { id },
      data: {
        email: dto.email,
        password: dto.password
          ? await hashSecret(dto.password, this.config.get<number>('bcryptRounds') ?? 12)
          : undefined,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        isActive: dto.isActive,
        refreshToken: dto.password ? null : undefined,
      },
      select: platformUserSelect,
    });
  }

  async removeSuperAdmin(id: string) {
    await this.findOneSuperAdmin(id);
    const remainingSuperAdmins = await this.prisma.user.count({
      where: { id: { not: id }, role: UserRole.SUPER_ADMIN, deletedAt: null, isActive: true },
    });
    if (!remainingSuperAdmins) {
      throw new BadRequestException('Cannot delete the last active superadmin');
    }
    return this.prisma.user.delete({ where: { id }, select: platformUserSelect });
  }

  private superAdminWhere(query: PaginationQueryDto): Prisma.UserWhereInput {
    const search = query.search?.trim();
    const email = query.email || query.userEmail;
    return {
      role: UserRole.SUPER_ADMIN,
      deletedAt: null,
      isActive: this.booleanFilter(query.isActive),
      email: email ? { contains: email, mode: 'insensitive' } : undefined,
      OR: search
        ? [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private booleanFilter(value?: string) {
    if (value === undefined) return undefined;
    const normalized = value.toUpperCase();
    if (['1', 'TRUE', 'YES', 'ACTIVE'].includes(normalized)) return true;
    if (['0', 'FALSE', 'NO', 'INACTIVE'].includes(normalized)) return false;
    return undefined;
  }
}
