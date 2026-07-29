import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { SentryModule } from '@sentry/nestjs/setup';
import { validateEnv } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { StructureModule } from './structure/structure.module';
import { PeopleModule } from './people/people.module';
import { EmployeeRecordsModule } from './people/employee-records/employee-records.module';
import { LeaveModule } from './people/leave/leave.module';
import { StaffAttendanceModule } from './people/attendance/attendance.module';
import { PerformanceModule } from './people/performance/performance.module';
import { TrainingModule } from './people/training/training.module';
import { AssetModule } from './people/assets/asset.module';
import { RecruitmentModule } from './people/recruitment/recruitment.module';
import { SelfServiceModule } from './people/self-service/self-service.module';
import { HrDashboardModule } from './people/hr-dashboard/hr-dashboard.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AcademicsModule } from './academics/academics.module';
import { FinanceModule } from './finance/finance.module';
import { CommunicationModule } from './communication/communication.module';
import { ParentPortalModule } from './parent-portal/parent-portal.module';
import { StudentPortalModule } from './student-portal/student-portal.module';
import { ReportingModule } from './reporting/reporting.module';
import { FeatureFlagsModule } from './feature-flags/feature-flags.module';
import { EInvoicingModule } from './einvoicing/einvoicing.module';
import { CardsModule } from './cards/cards.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { RolesModule } from './roles/roles.module';
import { UsersModule } from './users/users.module';
import { MailModule } from './mail/mail.module';
import { PresenceModule } from './presence/presence.module';
import { AdvancedModule } from './advanced/advanced.module';
import { PlatformModule } from './platform/platform.module';
import { EventsModule } from './events/events.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { BillingModule } from './billing/billing.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { PlatformConsoleModule } from './platform/console/platform-console.module';
import { PlanFeatureGuard } from './subscription/plan-feature.guard';
import { ReadOnlyStateGuard } from './subscription/read-only-state.guard';
import { OrganizationModule } from './organization/organization.module';
import { DocumentsModule } from './documents/documents.module';
import { YearEndModule } from './year-end/year-end.module';
import { EnrollmentExitModule } from './enrollment-exit/enrollment-exit.module';
import { EnrollmentChangeModule } from './enrollment-change/enrollment-change.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { MustChangePasswordGuard } from './auth/guards/must-change-password.guard';
import { CsrfGuard } from './auth/guards/csrf.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { TenantIsolationGuard } from './auth/guards/tenant-isolation.guard';
import { TenantContextInterceptor } from './auth/tenant-context.interceptor';
import { LoggingInterceptor } from './observability/logging.interceptor';

/**
 * Application root module.
 * Global concerns: config validation, Sentry, rate limiting, Prisma, health, and — from
 * Phase 3 — authentication (JWT), RBAC, and tenant-isolation guards + context binding.
 *
 * Guard order matters: rate limit → authenticate → temp-password gate → CSRF → authorize
 * (permissions) → tenant isolation.
 */
@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ThrottlerModule.forRoot({
      throttlers: [
        {
          ttl: Number(process.env.THROTTLE_TTL ?? '60') * 1000,
          limit: Number(process.env.THROTTLE_LIMIT ?? '120'),
        },
      ],
      // The e2e suite fires hundreds of requests from one IP in seconds; rate limiting is
      // covered by its own dedicated assertions, not by destabilizing every other suite.
      skipIf: () => process.env.NODE_ENV === 'test',
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    StructureModule,
    PeopleModule,
    EmployeeRecordsModule,
    LeaveModule,
    StaffAttendanceModule,
    PerformanceModule,
    TrainingModule,
    AssetModule,
    RecruitmentModule,
    SelfServiceModule,
    HrDashboardModule,
    SchedulingModule,
    AttendanceModule,
    AcademicsModule,
    FinanceModule,
    CommunicationModule,
    ParentPortalModule,
    StudentPortalModule,
    ReportingModule,
    FeatureFlagsModule,
    AdvancedModule,
    EInvoicingModule,
    CardsModule,
    DashboardModule,
    RolesModule,
    UsersModule,
    MailModule,
    PresenceModule,
    PlatformModule,
    EventsModule,
    WebhooksModule,
    SubscriptionModule,
    BillingModule,
    PlatformConsoleModule,
    OrganizationModule,
    DocumentsModule,
    YearEndModule,
    EnrollmentExitModule,
    EnrollmentChangeModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: MustChangePasswordGuard },
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: PlanFeatureGuard },
    { provide: APP_GUARD, useClass: ReadOnlyStateGuard },
    { provide: APP_GUARD, useClass: TenantIsolationGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TenantContextInterceptor },
  ],
})
export class AppModule {}
