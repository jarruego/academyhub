
import { Module } from '@nestjs/common';
import { MoodleService } from './moodle.service';
import { MoodleController } from './moodle.controller';

@Module({
  providers: [MoodleService],
  controllers: [MoodleController],
})
export class MoodleModule {}