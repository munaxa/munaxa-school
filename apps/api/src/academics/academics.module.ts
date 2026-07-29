import { Module } from '@nestjs/common';
import { StorageService } from '../common/storage.service';
import { HomeworkController } from './homework/homework.controller';
import { HomeworkService } from './homework/homework.service';
import { HomeworkRepository } from './homework/homework.repository';
import { BehaviorController } from './behavior/behavior.controller';
import { BehaviorService } from './behavior/behavior.service';
import { BehaviorRepository } from './behavior/behavior.repository';
import { GradeController } from './grades/grade.controller';
import { GradeService } from './grades/grade.service';
import { GradeRepository } from './grades/grade.repository';

/**
 * Academics: Homework (+ S3 attachments), Behavior logs, and the Grade import engine
 * (+ CSV) with grade reports for the parent/student academic views.
 */
@Module({
  controllers: [HomeworkController, BehaviorController, GradeController],
  providers: [
    StorageService,
    HomeworkService,
    HomeworkRepository,
    BehaviorService,
    BehaviorRepository,
    GradeService,
    GradeRepository,
  ],
})
export class AcademicsModule {}
