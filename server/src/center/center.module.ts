
import { Module } from '@nestjs/common';
import { CenterService } from './center.service';
import { CenterController } from './center.controller';
import { CenterRepository } from 'src/database/repository/center/center.repository';

@Module({
  providers: [CenterService, CenterRepository],
  controllers: [CenterController],
  exports: [CenterService],
})
export class CenterModule {}