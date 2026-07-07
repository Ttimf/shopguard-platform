import { IsIn } from 'class-validator';

export class UpdateStatusHttpDto {
  @IsIn(['NEW', 'REVIEWED', 'FALSE_ALARM'])
  status: 'NEW' | 'REVIEWED' | 'FALSE_ALARM';
}
