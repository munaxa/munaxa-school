-- ============================================================================
-- Munaxa — close the Supabase performance-advisor findings
--
-- The linter reported two fixable classes on this schema:
--
--   WARN multiple_permissive_policies (56x) : catalog_write / permission_write
--   INFO unindexed_foreign_keys       (210x): FK columns with no covering index
--
-- 1) Permissive-policy overlap
--    20260621131000_advisor_security_fixes and 20260717120000_saas_subscription_platform
--    paired a `*_read` SELECT policy with a `*_write` policy declared FOR ALL.
--    FOR ALL includes SELECT, so every read on those eight tables evaluated two
--    permissive policies and OR-ed them — the platform predicate is redundant work
--    on the read path (the read policy already admits platform sessions).
--    Restricting the write policies to INSERT/UPDATE/DELETE leaves exactly one
--    SELECT policy per table. Effective permissions are unchanged: platform
--    sessions still satisfy `catalog_read`/`permission_read` on SELECT, and writes
--    remain platform-only.
--
-- 2) Unindexed foreign keys
--    Tenant-scoped tables index `(tenantId, fkColumn)`, which serves tenant-filtered
--    reads but cannot answer a lookup on the FK column alone. Postgres needs that
--    lookup on every parent DELETE/UPDATE to enforce the constraint (and for
--    SetNull/Cascade fan-out), so those checks were falling back to sequential
--    scans. This adds the single-column covering index Prisma would emit for
--    `@@index([fkColumn])`; the schema.prisma change in the same commit keeps the
--    declarative source in sync so a future `prisma migrate diff` stays empty.
--    Purely additive — no existing index is dropped and no query plan regresses.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Split the FOR ALL write policies into INSERT / UPDATE / DELETE
--    Same table lists as 20260717120000_saas_subscription_platform and
--    20260718120000_saas_v2_enterprise, kept in the same DO-loop form.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  t text;
  catalog_tables text[] := ARRAY[
    'Organization', 'PriceBook', 'PlanVersion', 'FeatureCatalog', 'BillingTaxRate',
    'SubscriptionPlan', 'SubscriptionFeature'
  ];
BEGIN
  FOREACH t IN ARRAY catalog_tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS catalog_write ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_write_insert ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_write_update ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS catalog_write_delete ON %I', t);
    EXECUTE format($f$
      CREATE POLICY catalog_write_insert ON %I FOR INSERT
        WITH CHECK (app_is_platform())
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY catalog_write_update ON %I FOR UPDATE
        USING (app_is_platform()) WITH CHECK (app_is_platform())
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY catalog_write_delete ON %I FOR DELETE
        USING (app_is_platform())
    $f$, t);
  END LOOP;
END $$;

-- Permission — same shape, introduced by 20260621131000_advisor_security_fixes.
DROP POLICY IF EXISTS permission_write        ON "Permission";
DROP POLICY IF EXISTS permission_write_insert ON "Permission";
DROP POLICY IF EXISTS permission_write_update ON "Permission";
DROP POLICY IF EXISTS permission_write_delete ON "Permission";
CREATE POLICY permission_write_insert ON "Permission"
  FOR INSERT WITH CHECK (app_is_platform());
CREATE POLICY permission_write_update ON "Permission"
  FOR UPDATE USING (app_is_platform()) WITH CHECK (app_is_platform());
CREATE POLICY permission_write_delete ON "Permission"
  FOR DELETE USING (app_is_platform());

-- ---------------------------------------------------------------------------
-- 2) Covering indexes for foreign keys
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "AcademicYear_campusId_idx" ON "AcademicYear"("campusId");
CREATE INDEX IF NOT EXISTS "AcademicYear_schoolId_idx" ON "AcademicYear"("schoolId");
CREATE INDEX IF NOT EXISTS "Announcement_sectionId_idx" ON "Announcement"("sectionId");
CREATE INDEX IF NOT EXISTS "Area_academicYearId_idx" ON "Area"("academicYearId");
CREATE INDEX IF NOT EXISTS "Asset_currentAssigneeId_idx" ON "Asset"("currentAssigneeId");
CREATE INDEX IF NOT EXISTS "AssetAssignment_assetId_idx" ON "AssetAssignment"("assetId");
CREATE INDEX IF NOT EXISTS "AssetAssignment_assignedById_idx" ON "AssetAssignment"("assignedById");
CREATE INDEX IF NOT EXISTS "AssetAssignment_employeeId_idx" ON "AssetAssignment"("employeeId");
CREATE INDEX IF NOT EXISTS "AttendanceCorrectionApproval_decidedById_idx" ON "AttendanceCorrectionApproval"("decidedById");
CREATE INDEX IF NOT EXISTS "AttendanceCorrectionRequest_employeeId_idx" ON "AttendanceCorrectionRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "AttendanceCorrectionRequest_requestedById_idx" ON "AttendanceCorrectionRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "AttendanceLock_campusId_idx" ON "AttendanceLock"("campusId");
CREATE INDEX IF NOT EXISTS "AttendanceLock_lockedById_idx" ON "AttendanceLock"("lockedById");
CREATE INDEX IF NOT EXISTS "AttendanceLock_releasedById_idx" ON "AttendanceLock"("releasedById");
CREATE INDEX IF NOT EXISTS "AttendancePolicy_campusId_idx" ON "AttendancePolicy"("campusId");
CREATE INDEX IF NOT EXISTS "BehaviorLog_studentId_idx" ON "BehaviorLog"("studentId");
CREATE INDEX IF NOT EXISTS "BellSchedule_campusId_idx" ON "BellSchedule"("campusId");
CREATE INDEX IF NOT EXISTS "BillingPayment_invoiceId_idx" ON "BillingPayment"("invoiceId");
CREATE INDEX IF NOT EXISTS "BiometricRawPunch_employeeId_idx" ON "BiometricRawPunch"("employeeId");
CREATE INDEX IF NOT EXISTS "BookLoan_bookId_idx" ON "BookLoan"("bookId");
CREATE INDEX IF NOT EXISTS "BookLoan_studentId_idx" ON "BookLoan"("studentId");
CREATE INDEX IF NOT EXISTS "Bus_routeId_idx" ON "Bus"("routeId");
CREATE INDEX IF NOT EXISTS "BusAttendanceEvent_busId_idx" ON "BusAttendanceEvent"("busId");
CREATE INDEX IF NOT EXISTS "BusAttendanceEvent_studentId_idx" ON "BusAttendanceEvent"("studentId");
CREATE INDEX IF NOT EXISTS "BusRoute_academicYearId_idx" ON "BusRoute"("academicYearId");
CREATE INDEX IF NOT EXISTS "Campus_schoolId_idx" ON "Campus"("schoolId");
CREATE INDEX IF NOT EXISTS "Certificate_documentId_idx" ON "Certificate"("documentId");
CREATE INDEX IF NOT EXISTS "Certificate_employeeId_idx" ON "Certificate"("employeeId");
CREATE INDEX IF NOT EXISTS "Charge_academicYearId_idx" ON "Charge"("academicYearId");
CREATE INDEX IF NOT EXISTS "Charge_accountId_idx" ON "Charge"("accountId");
CREATE INDEX IF NOT EXISTS "Charge_feeItemId_idx" ON "Charge"("feeItemId");
CREATE INDEX IF NOT EXISTS "Charge_gradeId_idx" ON "Charge"("gradeId");
CREATE INDEX IF NOT EXISTS "Charge_studentId_idx" ON "Charge"("studentId");
CREATE INDEX IF NOT EXISTS "Classroom_campusId_idx" ON "Classroom"("campusId");
CREATE INDEX IF NOT EXISTS "ClinicVisit_studentId_idx" ON "ClinicVisit"("studentId");
CREATE INDEX IF NOT EXISTS "Credit_accountId_idx" ON "Credit"("accountId");
CREATE INDEX IF NOT EXISTS "Credit_payerId_idx" ON "Credit"("payerId");
CREATE INDEX IF NOT EXISTS "Credit_paymentId_idx" ON "Credit"("paymentId");
CREATE INDEX IF NOT EXISTS "Department_campusId_idx" ON "Department"("campusId");
CREATE INDEX IF NOT EXISTS "Department_headEmployeeId_idx" ON "Department"("headEmployeeId");
CREATE INDEX IF NOT EXISTS "Department_parentId_idx" ON "Department"("parentId");
CREATE INDEX IF NOT EXISTS "Dependent_employeeId_idx" ON "Dependent"("employeeId");
CREATE INDEX IF NOT EXISTS "DeviceToken_userId_idx" ON "DeviceToken"("userId");
CREATE INDEX IF NOT EXISTS "Document_studentId_idx" ON "Document"("studentId");
CREATE INDEX IF NOT EXISTS "Document_uploadedById_idx" ON "Document"("uploadedById");
CREATE INDEX IF NOT EXISTS "DocumentAccessLog_documentId_idx" ON "DocumentAccessLog"("documentId");
CREATE INDEX IF NOT EXISTS "DocumentEmailLog_documentId_idx" ON "DocumentEmailLog"("documentId");
CREATE INDEX IF NOT EXISTS "DriverInfraction_driverProfileId_idx" ON "DriverInfraction"("driverProfileId");
CREATE INDEX IF NOT EXISTS "DunningEvent_caseId_idx" ON "DunningEvent"("caseId");
CREATE INDEX IF NOT EXISTS "EInvoiceDocument_chargeId_idx" ON "EInvoiceDocument"("chargeId");
CREATE INDEX IF NOT EXISTS "EInvoiceDocument_originalDocumentId_idx" ON "EInvoiceDocument"("originalDocumentId");
CREATE INDEX IF NOT EXISTS "EInvoiceDocument_paymentId_idx" ON "EInvoiceDocument"("paymentId");
CREATE INDEX IF NOT EXISTS "EInvoiceDocument_studentId_idx" ON "EInvoiceDocument"("studentId");
CREATE INDEX IF NOT EXISTS "EInvoiceLog_documentId_idx" ON "EInvoiceLog"("documentId");
CREATE INDEX IF NOT EXISTS "EmergencyContact_employeeId_idx" ON "EmergencyContact"("employeeId");
CREATE INDEX IF NOT EXISTS "Employee_campusId_idx" ON "Employee"("campusId");
CREATE INDEX IF NOT EXISTS "Employee_createdById_idx" ON "Employee"("createdById");
CREATE INDEX IF NOT EXISTS "Employee_departmentId_idx" ON "Employee"("departmentId");
CREATE INDEX IF NOT EXISTS "Employee_positionId_idx" ON "Employee"("positionId");
CREATE INDEX IF NOT EXISTS "Employee_updatedById_idx" ON "Employee"("updatedById");
CREATE INDEX IF NOT EXISTS "EmployeeBankAccount_employeeId_idx" ON "EmployeeBankAccount"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeDocument_supersedesId_idx" ON "EmployeeDocument"("supersedesId");
CREATE INDEX IF NOT EXISTS "EmployeeDocument_uploadedById_idx" ON "EmployeeDocument"("uploadedById");
CREATE INDEX IF NOT EXISTS "EmployeeEducation_employeeId_idx" ON "EmployeeEducation"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeShiftAssignment_createdById_idx" ON "EmployeeShiftAssignment"("createdById");
CREATE INDEX IF NOT EXISTS "EmployeeShiftAssignment_employeeId_idx" ON "EmployeeShiftAssignment"("employeeId");
CREATE INDEX IF NOT EXISTS "EmployeeShiftAssignment_shiftId_idx" ON "EmployeeShiftAssignment"("shiftId");
CREATE INDEX IF NOT EXISTS "EmployeeStatusHistory_actorUserId_idx" ON "EmployeeStatusHistory"("actorUserId");
CREATE INDEX IF NOT EXISTS "EmployeeStatusHistory_employeeId_idx" ON "EmployeeStatusHistory"("employeeId");
CREATE INDEX IF NOT EXISTS "EmploymentContract_createdById_idx" ON "EmploymentContract"("createdById");
CREATE INDEX IF NOT EXISTS "EmploymentContract_employeeId_idx" ON "EmploymentContract"("employeeId");
CREATE INDEX IF NOT EXISTS "EmploymentContract_renewedFromId_idx" ON "EmploymentContract"("renewedFromId");
CREATE INDEX IF NOT EXISTS "EmploymentContract_signedDocumentId_idx" ON "EmploymentContract"("signedDocumentId");
CREATE INDEX IF NOT EXISTS "EmploymentContract_updatedById_idx" ON "EmploymentContract"("updatedById");
CREATE INDEX IF NOT EXISTS "Enrollment_academicYearId_idx" ON "Enrollment"("academicYearId");
CREATE INDEX IF NOT EXISTS "Enrollment_areaId_idx" ON "Enrollment"("areaId");
CREATE INDEX IF NOT EXISTS "Enrollment_campusId_idx" ON "Enrollment"("campusId");
CREATE INDEX IF NOT EXISTS "Enrollment_classroomId_idx" ON "Enrollment"("classroomId");
CREATE INDEX IF NOT EXISTS "Enrollment_gradeId_idx" ON "Enrollment"("gradeId");
CREATE INDEX IF NOT EXISTS "Enrollment_sectionId_idx" ON "Enrollment"("sectionId");
CREATE INDEX IF NOT EXISTS "Enrollment_studentId_idx" ON "Enrollment"("studentId");
CREATE INDEX IF NOT EXISTS "EnrollmentQuote_academicYearId_idx" ON "EnrollmentQuote"("academicYearId");
CREATE INDEX IF NOT EXISTS "EnrollmentQuote_gradeId_idx" ON "EnrollmentQuote"("gradeId");
CREATE INDEX IF NOT EXISTS "EnrollmentQuote_studentId_idx" ON "EnrollmentQuote"("studentId");
CREATE INDEX IF NOT EXISTS "EnrollmentQuoteItem_quoteId_idx" ON "EnrollmentQuoteItem"("quoteId");
CREATE INDEX IF NOT EXISTS "FeeAdjustment_accountId_idx" ON "FeeAdjustment"("accountId");
CREATE INDEX IF NOT EXISTS "FeeAdjustment_chargeId_idx" ON "FeeAdjustment"("chargeId");
CREATE INDEX IF NOT EXISTS "FeeAdjustment_studentId_idx" ON "FeeAdjustment"("studentId");
CREATE INDEX IF NOT EXISTS "FeeModification_enrollmentId_idx" ON "FeeModification"("enrollmentId");
CREATE INDEX IF NOT EXISTS "FinancialAccountPlan_academicYearId_idx" ON "FinancialAccountPlan"("academicYearId");
CREATE INDEX IF NOT EXISTS "FinancialAccountPlan_payerId_idx" ON "FinancialAccountPlan"("payerId");
CREATE INDEX IF NOT EXISTS "FinancialArrangement_enrollmentId_idx" ON "FinancialArrangement"("enrollmentId");
CREATE INDEX IF NOT EXISTS "FinancialArrangement_studentId_idx" ON "FinancialArrangement"("studentId");
CREATE INDEX IF NOT EXISTS "GeneratedDocument_academicYearId_idx" ON "GeneratedDocument"("academicYearId");
CREATE INDEX IF NOT EXISTS "GeneratedDocument_parentId_idx" ON "GeneratedDocument"("parentId");
CREATE INDEX IF NOT EXISTS "GeneratedDocument_studentId_idx" ON "GeneratedDocument"("studentId");
CREATE INDEX IF NOT EXISTS "Grade_campusId_idx" ON "Grade"("campusId");
CREATE INDEX IF NOT EXISTS "GradeFeeItem_academicYearId_idx" ON "GradeFeeItem"("academicYearId");
CREATE INDEX IF NOT EXISTS "GradeFeeItem_feeItemId_idx" ON "GradeFeeItem"("feeItemId");
CREATE INDEX IF NOT EXISTS "GradeFeeItem_gradeId_idx" ON "GradeFeeItem"("gradeId");
CREATE INDEX IF NOT EXISTS "GradeFeeSchedule_academicYearId_idx" ON "GradeFeeSchedule"("academicYearId");
CREATE INDEX IF NOT EXISTS "GradeFeeSchedule_gradeId_idx" ON "GradeFeeSchedule"("gradeId");
CREATE INDEX IF NOT EXISTS "GradeRecord_sectionId_idx" ON "GradeRecord"("sectionId");
CREATE INDEX IF NOT EXISTS "GradeRecord_semesterId_idx" ON "GradeRecord"("semesterId");
CREATE INDEX IF NOT EXISTS "GradeRecord_studentId_idx" ON "GradeRecord"("studentId");
CREATE INDEX IF NOT EXISTS "Homework_sectionId_idx" ON "Homework"("sectionId");
CREATE INDEX IF NOT EXISTS "HomeworkAttachment_homeworkId_idx" ON "HomeworkAttachment"("homeworkId");
CREATE INDEX IF NOT EXISTS "Installment_chargeId_idx" ON "Installment"("chargeId");
CREATE INDEX IF NOT EXISTS "Installment_planId_idx" ON "Installment"("planId");
CREATE INDEX IF NOT EXISTS "Interview_applicantId_idx" ON "Interview"("applicantId");
CREATE INDEX IF NOT EXISTS "Interview_interviewerId_idx" ON "Interview"("interviewerId");
CREATE INDEX IF NOT EXISTS "InventoryTransaction_itemId_idx" ON "InventoryTransaction"("itemId");
CREATE INDEX IF NOT EXISTS "JobApplicant_postingId_idx" ON "JobApplicant"("postingId");
CREATE INDEX IF NOT EXISTS "JobPosting_departmentId_idx" ON "JobPosting"("departmentId");
CREATE INDEX IF NOT EXISTS "JobPosting_positionId_idx" ON "JobPosting"("positionId");
CREATE INDEX IF NOT EXISTS "LeaveRequest_requestedById_idx" ON "LeaveRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "LeaveRequest_reviewedById_idx" ON "LeaveRequest"("reviewedById");
CREATE INDEX IF NOT EXISTS "LeaveRequest_studentId_idx" ON "LeaveRequest"("studentId");
CREATE INDEX IF NOT EXISTS "Notification_announcementId_idx" ON "Notification"("announcementId");
CREATE INDEX IF NOT EXISTS "Notification_userId_idx" ON "Notification"("userId");
CREATE INDEX IF NOT EXISTS "NotificationAudit_notificationId_idx" ON "NotificationAudit"("notificationId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX IF NOT EXISTS "Payer_parentId_idx" ON "Payer"("parentId");
CREATE INDEX IF NOT EXISTS "Payment_accountId_idx" ON "Payment"("accountId");
CREATE INDEX IF NOT EXISTS "Payment_payerId_idx" ON "Payment"("payerId");
CREATE INDEX IF NOT EXISTS "Payment_studentId_idx" ON "Payment"("studentId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_installmentId_idx" ON "PaymentAllocation"("installmentId");
CREATE INDEX IF NOT EXISTS "PaymentAllocation_paymentId_idx" ON "PaymentAllocation"("paymentId");
CREATE INDEX IF NOT EXISTS "PaymentPlan_financialPlanId_idx" ON "PaymentPlan"("financialPlanId");
CREATE INDEX IF NOT EXISTS "PerformanceGoal_employeeId_idx" ON "PerformanceGoal"("employeeId");
CREATE INDEX IF NOT EXISTS "PerformanceGoal_reviewId_idx" ON "PerformanceGoal"("reviewId");
CREATE INDEX IF NOT EXISTS "PerformanceReview_cycleId_idx" ON "PerformanceReview"("cycleId");
CREATE INDEX IF NOT EXISTS "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId");
CREATE INDEX IF NOT EXISTS "PerformanceReview_reviewerId_idx" ON "PerformanceReview"("reviewerId");
CREATE INDEX IF NOT EXISTS "PlanChangeHistory_fromPlanId_idx" ON "PlanChangeHistory"("fromPlanId");
CREATE INDEX IF NOT EXISTS "PlanChangeHistory_toPlanId_idx" ON "PlanChangeHistory"("toPlanId");
CREATE INDEX IF NOT EXISTS "Position_departmentId_idx" ON "Position"("departmentId");
CREATE INDEX IF NOT EXISTS "PromiseToPay_caseId_idx" ON "PromiseToPay"("caseId");
CREATE INDEX IF NOT EXISTS "PtmBooking_bookedById_idx" ON "PtmBooking"("bookedById");
CREATE INDEX IF NOT EXISTS "PtmBooking_studentId_idx" ON "PtmBooking"("studentId");
CREATE INDEX IF NOT EXISTS "PtmSlot_createdById_idx" ON "PtmSlot"("createdById");
CREATE INDEX IF NOT EXISTS "PtmSlot_sectionId_idx" ON "PtmSlot"("sectionId");
CREATE INDEX IF NOT EXISTS "PtmSlot_teacherId_idx" ON "PtmSlot"("teacherId");
CREATE INDEX IF NOT EXISTS "RefreshToken_userId_idx" ON "RefreshToken"("userId");
CREATE INDEX IF NOT EXISTS "Refund_accountId_idx" ON "Refund"("accountId");
CREATE INDEX IF NOT EXISTS "Refund_payerId_idx" ON "Refund"("payerId");
CREATE INDEX IF NOT EXISTS "Refund_studentId_idx" ON "Refund"("studentId");
CREATE INDEX IF NOT EXISTS "RefundConsumption_creditId_idx" ON "RefundConsumption"("creditId");
CREATE INDEX IF NOT EXISTS "RefundConsumption_refundId_idx" ON "RefundConsumption"("refundId");
CREATE INDEX IF NOT EXISTS "RegistrationAgreement_academicYearId_idx" ON "RegistrationAgreement"("academicYearId");
CREATE INDEX IF NOT EXISTS "RegistrationAgreement_enrollmentId_idx" ON "RegistrationAgreement"("enrollmentId");
CREATE INDEX IF NOT EXISTS "RegistrationAgreement_parentId_idx" ON "RegistrationAgreement"("parentId");
CREATE INDEX IF NOT EXISTS "RegistrationAgreement_studentId_idx" ON "RegistrationAgreement"("studentId");
CREATE INDEX IF NOT EXISTS "RegistrationAgreement_supersedesId_idx" ON "RegistrationAgreement"("supersedesId");
CREATE INDEX IF NOT EXISTS "Resource_gradeId_idx" ON "Resource"("gradeId");
CREATE INDEX IF NOT EXISTS "Resource_sectionId_idx" ON "Resource"("sectionId");
CREATE INDEX IF NOT EXISTS "Resource_uploadedById_idx" ON "Resource"("uploadedById");
CREATE INDEX IF NOT EXISTS "ScheduleException_locationId_idx" ON "ScheduleException"("locationId");
CREATE INDEX IF NOT EXISTS "ScheduleException_sectionId_idx" ON "ScheduleException"("sectionId");
CREATE INDEX IF NOT EXISTS "ScheduleException_subjectId_idx" ON "ScheduleException"("subjectId");
CREATE INDEX IF NOT EXISTS "ScheduleException_substituteTeacherId_idx" ON "ScheduleException"("substituteTeacherId");
CREATE INDEX IF NOT EXISTS "ScheduleException_teacherId_idx" ON "ScheduleException"("teacherId");
CREATE INDEX IF NOT EXISTS "SchedulePlan_academicYearId_idx" ON "SchedulePlan"("academicYearId");
CREATE INDEX IF NOT EXISTS "SchedulePlan_campusId_idx" ON "SchedulePlan"("campusId");
CREATE INDEX IF NOT EXISTS "ScheduledClass_locationId_idx" ON "ScheduledClass"("locationId");
CREATE INDEX IF NOT EXISTS "ScheduledClass_subjectId_idx" ON "ScheduledClass"("subjectId");
CREATE INDEX IF NOT EXISTS "ScheduledClass_teacherId_idx" ON "ScheduledClass"("teacherId");
CREATE INDEX IF NOT EXISTS "Section_classroomId_idx" ON "Section"("classroomId");
CREATE INDEX IF NOT EXISTS "Section_gradeId_idx" ON "Section"("gradeId");
CREATE INDEX IF NOT EXISTS "SectionTimetable_sectionId_idx" ON "SectionTimetable"("sectionId");
CREATE INDEX IF NOT EXISTS "Semester_academicYearId_idx" ON "Semester"("academicYearId");
CREATE INDEX IF NOT EXISTS "Shift_campusId_idx" ON "Shift"("campusId");
CREATE INDEX IF NOT EXISTS "Shift_policyId_idx" ON "Shift"("policyId");
CREATE INDEX IF NOT EXISTS "SpecialLocation_campusId_idx" ON "SpecialLocation"("campusId");
CREATE INDEX IF NOT EXISTS "StaffAttendance_correctedById_idx" ON "StaffAttendance"("correctedById");
CREATE INDEX IF NOT EXISTS "StaffAttendance_employeeId_idx" ON "StaffAttendance"("employeeId");
CREATE INDEX IF NOT EXISTS "StaffAttendance_markedById_idx" ON "StaffAttendance"("markedById");
CREATE INDEX IF NOT EXISTS "StaffLeaveApproval_approverId_idx" ON "StaffLeaveApproval"("approverId");
CREATE INDEX IF NOT EXISTS "StaffLeaveApproval_requestId_idx" ON "StaffLeaveApproval"("requestId");
CREATE INDEX IF NOT EXISTS "StaffLeaveBalance_leaveTypeId_idx" ON "StaffLeaveBalance"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "StaffLeaveRequest_employeeId_idx" ON "StaffLeaveRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "StaffLeaveRequest_leaveTypeId_idx" ON "StaffLeaveRequest"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "StaffLeaveRequest_requestedById_idx" ON "StaffLeaveRequest"("requestedById");
CREATE INDEX IF NOT EXISTS "Student_areaId_idx" ON "Student"("areaId");
CREATE INDEX IF NOT EXISTS "Student_sectionId_idx" ON "Student"("sectionId");
CREATE INDEX IF NOT EXISTS "StudentAchievement_achievementId_idx" ON "StudentAchievement"("achievementId");
CREATE INDEX IF NOT EXISTS "StudentAchievement_awardedById_idx" ON "StudentAchievement"("awardedById");
CREATE INDEX IF NOT EXISTS "StudentAttendance_markedById_idx" ON "StudentAttendance"("markedById");
CREATE INDEX IF NOT EXISTS "StudentAttendance_sectionId_idx" ON "StudentAttendance"("sectionId");
CREATE INDEX IF NOT EXISTS "StudentAttendance_studentId_idx" ON "StudentAttendance"("studentId");
CREATE INDEX IF NOT EXISTS "StudentBusAssignment_routeId_idx" ON "StudentBusAssignment"("routeId");
CREATE INDEX IF NOT EXISTS "StudentBusAssignment_stopId_idx" ON "StudentBusAssignment"("stopId");
CREATE INDEX IF NOT EXISTS "StudentBusAssignment_studentId_idx" ON "StudentBusAssignment"("studentId");
CREATE INDEX IF NOT EXISTS "StudentCard_studentId_idx" ON "StudentCard"("studentId");
CREATE INDEX IF NOT EXISTS "StudentFinancialAccount_payerId_idx" ON "StudentFinancialAccount"("payerId");
CREATE INDEX IF NOT EXISTS "StudentPresenceEvent_studentId_idx" ON "StudentPresenceEvent"("studentId");
CREATE INDEX IF NOT EXISTS "StudentVaccine_studentId_idx" ON "StudentVaccine"("studentId");
CREATE INDEX IF NOT EXISTS "TeacherAttendance_markedById_idx" ON "TeacherAttendance"("markedById");
CREATE INDEX IF NOT EXISTS "TeacherAttendance_teacherId_idx" ON "TeacherAttendance"("teacherId");
CREATE INDEX IF NOT EXISTS "TenantSubscription_couponId_idx" ON "TenantSubscription"("couponId");
CREATE INDEX IF NOT EXISTS "TenantSubscription_planVersionId_idx" ON "TenantSubscription"("planVersionId");
CREATE INDEX IF NOT EXISTS "TrainingRecord_certificateId_idx" ON "TrainingRecord"("certificateId");
CREATE INDEX IF NOT EXISTS "TrainingRecord_courseId_idx" ON "TrainingRecord"("courseId");
CREATE INDEX IF NOT EXISTS "TrainingRecord_employeeId_idx" ON "TrainingRecord"("employeeId");
CREATE INDEX IF NOT EXISTS "TransportFare_academicYearId_idx" ON "TransportFare"("academicYearId");
CREATE INDEX IF NOT EXISTS "Trial_planId_idx" ON "Trial"("planId");
CREATE INDEX IF NOT EXISTS "UpgradeRequest_fromPlanId_idx" ON "UpgradeRequest"("fromPlanId");
CREATE INDEX IF NOT EXISTS "UpgradeRequest_requestedPlanId_idx" ON "UpgradeRequest"("requestedPlanId");
