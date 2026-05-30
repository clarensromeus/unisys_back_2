import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { hashSecret } from '../../common/utils/password.util';
import { ConfigService } from '@nestjs/config';
import { CreateUserDto } from './dto/create-user.dto';
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
}
