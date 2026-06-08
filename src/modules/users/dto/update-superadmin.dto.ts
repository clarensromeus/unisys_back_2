import { PartialType } from '@nestjs/swagger';
import { CreateSuperAdminDto } from './create-superadmin.dto';

export class UpdateSuperAdminDto extends PartialType(CreateSuperAdminDto) {}
