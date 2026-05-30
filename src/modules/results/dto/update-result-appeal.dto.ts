import { PartialType } from '@nestjs/swagger';
import { CreateResultAppealDto } from './create-result-appeal.dto';

export class UpdateResultAppealDto extends PartialType(CreateResultAppealDto) {}
