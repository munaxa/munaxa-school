import { Module } from '@nestjs/common';
import { FinanceModule } from '../finance/finance.module';
import { StudentController } from './students/student.controller';
import { StudentService } from './students/student.service';
import { StudentRepository } from './students/student.repository';
import { ParentController } from './parents/parent.controller';
import { ParentService } from './parents/parent.service';
import { ParentRepository } from './parents/parent.repository';
import { TeacherController } from './teachers/teacher.controller';
import { TeacherService } from './teachers/teacher.service';
import { TeacherRepository } from './teachers/teacher.repository';
import { EmployeeController } from './employees/employee.controller';
import { EmployeeService } from './employees/employee.service';
import { EmployeeRepository } from './employees/employee.repository';
import { DepartmentController } from './org/department.controller';
import { DepartmentService } from './org/department.service';
import { DepartmentRepository } from './org/department.repository';
import { PositionController } from './org/position.controller';
import { PositionService } from './org/position.service';
import { PositionRepository } from './org/position.repository';
import { EnrollmentLifecycleService } from './enrollment-lifecycle/enrollment-lifecycle.service';
import { EnrollmentLifecycleRepository } from './enrollment-lifecycle/enrollment-lifecycle.repository';

/**
 * People management: Students (+ QR + parent linking + CSV import), Parents,
 * Teachers (+ section assignment), Employees (incl. secretary accounts).
 */
@Module({
  imports: [FinanceModule],
  controllers: [
    StudentController,
    ParentController,
    TeacherController,
    EmployeeController,
    DepartmentController,
    PositionController,
  ],
  providers: [
    StudentService,
    StudentRepository,
    ParentService,
    ParentRepository,
    TeacherService,
    TeacherRepository,
    EmployeeService,
    EmployeeRepository,
    DepartmentService,
    DepartmentRepository,
    PositionService,
    PositionRepository,
    EnrollmentLifecycleService,
    EnrollmentLifecycleRepository,
  ],
  // EmployeeService is reused by the recruitment module to hire an applicant into an Employee.
  exports: [EnrollmentLifecycleService, EmployeeService],
})
export class PeopleModule {}
