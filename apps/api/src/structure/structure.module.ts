import { Module } from '@nestjs/common';
import { SchoolController } from './schools/school.controller';
import { SchoolService } from './schools/school.service';
import { SchoolRepository } from './schools/school.repository';
import { CampusController } from './campuses/campus.controller';
import { CampusService } from './campuses/campus.service';
import { CampusRepository } from './campuses/campus.repository';
import { AcademicYearController } from './academic-years/academic-year.controller';
import { AcademicYearService } from './academic-years/academic-year.service';
import { AcademicYearRepository } from './academic-years/academic-year.repository';
import { SemesterController } from './semesters/semester.controller';
import { SemesterService } from './semesters/semester.service';
import { SemesterRepository } from './semesters/semester.repository';
import { GradeController } from './grades/grade.controller';
import { GradeService } from './grades/grade.service';
import { GradeRepository } from './grades/grade.repository';
import { ClassroomController } from './classrooms/classroom.controller';
import { ClassroomService } from './classrooms/classroom.service';
import { ClassroomRepository } from './classrooms/classroom.repository';
import { SectionController } from './sections/section.controller';
import { SectionService } from './sections/section.service';
import { SectionRepository } from './sections/section.repository';

/** School structure management: School → Campus → AcademicYear/Semester, Grade → Section, Classroom. */
@Module({
  controllers: [
    SchoolController,
    CampusController,
    AcademicYearController,
    SemesterController,
    GradeController,
    ClassroomController,
    SectionController,
  ],
  providers: [
    SchoolService,
    SchoolRepository,
    CampusService,
    CampusRepository,
    AcademicYearService,
    AcademicYearRepository,
    SemesterService,
    SemesterRepository,
    GradeService,
    GradeRepository,
    ClassroomService,
    ClassroomRepository,
    SectionService,
    SectionRepository,
  ],
})
export class StructureModule {}
