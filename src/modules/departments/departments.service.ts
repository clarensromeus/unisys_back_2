import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PaginationQueryDto, paginated, pagination } from '../../common/dto';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { codeFromName, defaultOrganizationId } from '../../common/utils/tenant.util';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private headInclude() {
    return {
      user: { select: { email: true, firstName: true, lastName: true, role: true } },
      teacher: true,
      staff: true,
      headedFaculty: true,
    } satisfies Prisma.EmployeeInclude;
  }

  private async validateHead(organizationId: string, headId?: string, currentDepartmentId?: string) {
    if (!headId) return;
    const [employee, existingHeadship] = await Promise.all([
      this.prisma.employee.findFirst({
        where: { id: headId, organizationId, deletedAt: null },
        include: { user: { select: { email: true, firstName: true, lastName: true } } },
      }),
      this.prisma.department.findFirst({
        where: { organizationId, headId, id: currentDepartmentId ? { not: currentDepartmentId } : undefined },
        select: { name: true },
      }),
    ]);

    if (!employee) throw new BadRequestException('Selected department head does not exist');

    if (existingHeadship) {
      const employeeName = [employee.user.firstName, employee.user.lastName].filter(Boolean).join(' ') || employee.user.email;
      throw new ConflictException(`${employeeName} is already the head of ${existingHeadship.name}`);
    }
  }

  private async validateFaculty(organizationId: string, facultyId?: string) {
    if (!facultyId) return;
    const faculty = await this.prisma.faculty.findFirst({
      where: { id: facultyId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!faculty) throw new BadRequestException('Selected faculty does not exist');
  }

  async findAll(query: PaginationQueryDto & { code?: string; name?: string; facultyId?: string }) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const { skip, take, page, limit } = pagination(query);
    const where: Prisma.DepartmentWhereInput = {
      organizationId,
      deletedAt: null,
      code: query.code ? { equals: query.code, mode: 'insensitive' } : undefined,
      name: query.name ? { equals: query.name, mode: 'insensitive' } : undefined,
      facultyId: query.facultyId,
      OR: query.search
        ? [{ name: { contains: query.search, mode: 'insensitive' } }, { code: { contains: query.search, mode: 'insensitive' } }]
        : undefined,
    };
    const [items, total] = await Promise.all([
      this.prisma.department.findMany({
        where,
        skip,
        take,
        include: { head: { include: this.headInclude() }, _count: { select: { students: true, teachers: true, courses: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.department.count({ where }),
    ]);
    return paginated(items, total, page, limit);
  }

  async findOne(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    return this.prisma.department.findFirstOrThrow({
      where: { id, organizationId, deletedAt: null },
      include: { head: { include: this.headInclude() }, students: true, teachers: true, courses: true },
    });
  }

  async create(dto: CreateDepartmentDto) {
    const organizationId = await defaultOrganizationId(this.prisma);

    await this.validateHead(organizationId, dto.headId);
    await this.validateFaculty(organizationId, dto.facultyId);

    return this.prisma.department.create({
      data: {
        organizationId,
        facultyId: dto.facultyId,
        name: dto.name.trim(),
        code: dto.code ? codeFromName(dto.code) : codeFromName(dto.name),
        headId: dto.headId,
      },
      include: { faculty: true, head: { include: this.headInclude() }, _count: { select: { students: true, teachers: true, courses: true } } },
    });
  }

  async update(id: string, dto: UpdateDepartmentDto) {
    const organizationId = await defaultOrganizationId(this.prisma);
    const current = await this.prisma.department.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { organizationId: true } });
    await this.validateHead(current.organizationId, dto.headId, id);
    await this.validateFaculty(current.organizationId, dto.facultyId);
    return this.prisma.department.update({
      where: { id },
      data: dto,
      include: { faculty: true, head: { include: this.headInclude() }, _count: { select: { students: true, teachers: true, courses: true } } },
    });
  }

  async remove(id: string) {
    const organizationId = await defaultOrganizationId(this.prisma);
    await this.prisma.department.findFirstOrThrow({ where: { id, organizationId, deletedAt: null }, select: { id: true } });
    return this.prisma.department.delete({ where: { id } });
  }
}
