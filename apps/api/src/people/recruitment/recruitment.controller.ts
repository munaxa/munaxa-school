import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { RecruitmentService } from './recruitment.service';
import {
  CreateApplicantDto,
  CreateInterviewDto,
  CreateJobPostingDto,
  HireApplicantDto,
  ListJobPostingsQueryDto,
  UpdateApplicantDto,
  UpdateInterviewDto,
  UpdateJobPostingDto,
} from './recruitment.dto';

/** Recruitment: job postings, applicants, interviews, and hiring. */
@ApiTags('recruitment')
@ApiBearerAuth()
@Controller({ path: 'hr', version: '1' })
export class RecruitmentController {
  constructor(private readonly service: RecruitmentService) {}

  // ----- Postings ------------------------------------------------------------
  @Get('job-postings')
  @RequirePermissions(Permission.RECRUITMENT_READ)
  listPostings(@Query() query: ListJobPostingsQueryDto) {
    return this.service.listPostings(query.status);
  }

  @Post('job-postings')
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  createPosting(@Body() dto: CreateJobPostingDto) {
    return this.service.createPosting(dto);
  }

  @Patch('job-postings/:id')
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  updatePosting(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateJobPostingDto) {
    return this.service.updatePosting(id, dto);
  }

  @Delete('job-postings/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  removePosting(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removePosting(id);
  }

  // ----- Applicants ----------------------------------------------------------
  @Get('job-postings/:id/applicants')
  @RequirePermissions(Permission.RECRUITMENT_READ)
  listApplicants(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.listApplicants(id);
  }

  @Post('job-postings/:id/applicants')
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  createApplicant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateApplicantDto) {
    return this.service.createApplicant(id, dto);
  }

  @Get('applicants/:id')
  @RequirePermissions(Permission.RECRUITMENT_READ)
  getApplicant(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getApplicant(id);
  }

  @Patch('applicants/:id')
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  updateApplicant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateApplicantDto) {
    return this.service.updateApplicant(id, dto);
  }

  @Post('applicants/:id/hire')
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  hire(@Param('id', ParseUUIDPipe) id: string, @Body() dto: HireApplicantDto) {
    return this.service.hire(id, dto);
  }

  // ----- Interviews ----------------------------------------------------------
  @Post('applicants/:id/interviews')
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  createInterview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateInterviewDto) {
    return this.service.createInterview(id, dto);
  }

  @Patch('interviews/:id')
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  updateInterview(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateInterviewDto) {
    return this.service.updateInterview(id, dto);
  }

  @Delete('interviews/:id')
  @HttpCode(204)
  @RequirePermissions(Permission.RECRUITMENT_MANAGE)
  removeInterview(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.removeInterview(id);
  }
}
