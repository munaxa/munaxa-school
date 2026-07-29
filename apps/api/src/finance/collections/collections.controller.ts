import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Permission } from '@school/domain';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import { CollectionsService } from './collections.service';
import {
  LogCommunicationDto,
  PushOutstandingDto,
  RecordPromiseDto,
  ResolvePromiseDto,
  SendReminderDto,
  SetCollectionsDto,
  SuspendTransportDto,
} from './collections.dto';

/**
 * Fee collections (Phase 18): the per-student legal/collections tag shown on the finance card,
 * and late-payment reminders (in-app + SMS) to parents. LEGAL-tagged students are excluded
 * from reminders.
 */
@ApiTags('finance')
@ApiBearerAuth()
@Controller({ path: 'finance/collections', version: '1' })
export class CollectionsController {
  constructor(private readonly service: CollectionsService) {}

  @Get('students/:studentId')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({
    summary: 'Collections tag + reminder snapshot + reminder history (finance card)',
  })
  profile(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.getProfile(studentId);
  }

  @Put('students/:studentId')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Set the collections/legal tag (NONE / FINANCIAL_ISSUE / LEGAL)' })
  setStatus(@Param('studentId', ParseUUIDPipe) studentId: string, @Body() dto: SetCollectionsDto) {
    return this.service.setCollections(studentId, dto);
  }

  @Post('students/:studentId/reminders')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: "Send a late-payment reminder to this student's parents (in-app/SMS)" })
  remind(@Param('studentId', ParseUUIDPipe) studentId: string, @Body() dto: SendReminderDto) {
    return this.service.sendForStudent(studentId, dto);
  }

  @Post('reminders/send')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({
    summary: 'Bulk late-payment reminders to all due/overdue accounts (excludes LEGAL-tagged)',
  })
  remindAll(@Body() dto: SendReminderDto) {
    return this.service.sendBatch(dto);
  }

  @Post('reminders/push-outstanding')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({
    summary:
      'Push outstanding balances to parents, filtered by overdue age (>30/60/90 days) and/or a minimum amount',
  })
  pushOutstanding(@Body() dto: PushOutstandingDto) {
    return this.service.pushOutstanding(dto);
  }

  @Get('dashboard')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({
    summary:
      'Operational finance dashboard: promises due today, missed promises, transport suspensions, ' +
      'largest outstanding balances, and collection workload counts',
  })
  dashboard() {
    return this.service.dashboard();
  }

  @Get('aging')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({
    summary: 'Aging report (outstanding by 30/60/90-day buckets) + collection effectiveness',
  })
  aging() {
    return this.service.agingReport();
  }

  @Get('students/:studentId/aging')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'Outstanding balance bucketed by age for one student' })
  studentAging(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.aging(studentId);
  }

  // ── Promise to Pay ──────────────────────────────────────────────────────────
  @Post('students/:studentId/promises')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Record a promise-to-pay (amount + expected date) for this student' })
  recordPromise(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: RecordPromiseDto,
  ) {
    return this.service.recordPromise(studentId, dto);
  }

  @Get('students/:studentId/promises')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'List this student’s promises-to-pay (with derived status)' })
  listPromises(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.listPromises(studentId);
  }

  @Post('promises/:promiseId/resolve')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Resolve a promise-to-pay as kept or broken' })
  resolvePromise(
    @Param('promiseId', ParseUUIDPipe) promiseId: string,
    @Body() dto: ResolvePromiseDto,
  ) {
    return this.service.resolvePromise(promiseId, dto.kept);
  }

  // ── Communication Log ───────────────────────────────────────────────────────
  @Post('students/:studentId/communications')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Log a parent contact (call/WhatsApp/SMS/email/meeting/note)' })
  logCommunication(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: LogCommunicationDto,
  ) {
    return this.service.logCommunication(studentId, dto);
  }

  @Get('students/:studentId/communications')
  @RequirePermissions(Permission.FINANCE_READ)
  @ApiOperation({ summary: 'The student’s communication log (logged parent contacts)' })
  listCommunications(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.listCommunications(studentId);
  }

  @Post('students/:studentId/transport/evaluate')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({
    summary: 'Reconcile this student transport suspension against the overdue policy threshold',
  })
  evaluateTransport(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.evaluateTransport(studentId);
  }

  @Post('transport/evaluate')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({
    summary: 'Sweep all accounts: suspend overdue transport and restore those caught up',
  })
  evaluateTransportAll() {
    return this.service.evaluateTransportBatch();
  }

  @Post('students/:studentId/transport/suspend')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Manually suspend this student’s transport (records the reason + who)' })
  suspendTransport(
    @Param('studentId', ParseUUIDPipe) studentId: string,
    @Body() dto: SuspendTransportDto,
  ) {
    return this.service.suspendTransport(studentId, dto.reason);
  }

  @Post('students/:studentId/transport/reinstate')
  @RequirePermissions(Permission.FINANCE_MANAGE)
  @ApiOperation({ summary: 'Manually reinstate this student’s transport' })
  reinstateTransport(@Param('studentId', ParseUUIDPipe) studentId: string) {
    return this.service.reinstateTransport(studentId);
  }
}
