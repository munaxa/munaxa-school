import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  FeeItemKind,
  FinancialAccountOwnerType,
  Gender,
  ParentRelation,
  QuotePaymentMode,
  TransportDirection,
} from '@prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ── Fee-item catalog ──
export class CreateFeeItemDto {
  @ApiProperty({ enum: FeeItemKind }) @IsEnum(FeeItemKind) kind!: FeeItemKind;
  @ApiProperty() @IsString() nameEn!: string;
  @ApiProperty() @IsString() nameAr!: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mandatory?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() discountable?: boolean;
}

export class UpdateFeeItemDto {
  @ApiPropertyOptional() @IsOptional() @IsString() nameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() nameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mandatory?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() discountable?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpsertGradeFeeItemDto {
  @ApiProperty() @IsUUID() feeItemId!: string;
  @ApiProperty() @IsUUID() gradeId!: string;
  @ApiProperty() @IsUUID() academicYearId!: string;
  @ApiProperty() @IsNumber() amount!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() mandatory?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() discountable?: boolean;
  @ApiPropertyOptional({ example: '2026-09-01' }) @IsOptional() @IsString() effectiveFrom?: string;
}

// ── Registrar fee override on a quote line ──
export class FeeOverrideDto {
  @ApiProperty({ enum: FeeItemKind }) @IsEnum(FeeItemKind) kind!: FeeItemKind;
  @ApiProperty({ description: 'New (overridden) amount in JOD' }) @IsNumber() amount!: number;
  @ApiProperty() @IsString() reason!: string;
}

// ── Quote ──
export class QuoteDto {
  @ApiProperty() @IsUUID() gradeId!: string;
  @ApiProperty() @IsUUID() academicYearId!: string;
  @ApiPropertyOptional({ description: 'Returning student to attach the quote to' })
  @IsOptional()
  @IsUUID()
  studentId?: string;

  @ApiPropertyOptional({ enum: TransportDirection, default: TransportDirection.NONE })
  @IsOptional()
  @IsEnum(TransportDirection)
  transportDirection?: TransportDirection;

  @ApiPropertyOptional({
    example: 'A,B,C',
    description: 'Route group to price transport against (must match a configured fare).',
  })
  @IsOptional()
  @IsString()
  transportRouteGroup?: string;

  @ApiPropertyOptional({ enum: QuotePaymentMode, default: QuotePaymentMode.INSTALLMENTS })
  @IsOptional()
  @IsEnum(QuotePaymentMode)
  paymentMode?: QuotePaymentMode;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(9)
  installments?: number;

  @ApiPropertyOptional({ example: '2026-09-01' }) @IsOptional() @IsString() firstDueDate?: string;

  @ApiPropertyOptional({ type: [FeeOverrideDto], description: 'Registrar fee overrides' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FeeOverrideDto)
  overrides?: FeeOverrideDto[];

  @ApiPropertyOptional({ default: false, description: 'Persist this quote for later commit' })
  @IsOptional()
  @IsBoolean()
  persist?: boolean;
}

// ── Registration commit ──
class StudentInfoDto {
  @ApiProperty() @IsString() firstNameEn!: string;
  @ApiProperty() @IsString() lastNameEn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstNameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastNameAr?: string;
  @ApiPropertyOptional({ enum: Gender }) @IsOptional() @IsEnum(Gender) gender?: Gender;
  @ApiPropertyOptional({ example: '2015-05-01' }) @IsOptional() @IsString() dateOfBirth?: string;
  // National ID is mandatory for every new student (student information requirement).
  @ApiProperty({ description: 'National ID (mandatory)' })
  @IsString()
  @MinLength(1)
  nationalId!: string;
}

class ParentInfoDto {
  @ApiProperty() @IsString() firstNameEn!: string;
  @ApiProperty() @IsString() lastNameEn!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() firstNameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() lastNameAr?: string;
  @ApiProperty({ description: 'Primary mobile number (mandatory)' })
  @IsString()
  @MinLength(1)
  phone!: string;
  @ApiPropertyOptional({ description: 'Secondary/alternate mobile number' })
  @IsOptional()
  @IsString()
  phoneAlt?: string;
  @ApiPropertyOptional() @IsOptional() @IsEmail() email?: string;
  @ApiPropertyOptional({ enum: ParentRelation, description: 'Relation to the student' })
  @IsOptional()
  @IsEnum(ParentRelation)
  relation?: ParentRelation;
}

export class CommitDto {
  @ApiProperty({ description: 'Persisted quote id from POST /admissions/quote' })
  @IsUUID()
  quoteId!: string;

  @ApiProperty() @IsString() idempotencyKey!: string;

  @ApiPropertyOptional({ description: 'Existing student id (returning student re-enrollment)' })
  @IsOptional()
  @IsUUID()
  existingStudentId?: string;

  @ApiPropertyOptional({ type: StudentInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StudentInfoDto)
  student?: StudentInfoDto;

  @ApiPropertyOptional({ type: ParentInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ParentInfoDto)
  parent?: ParentInfoDto;

  @ApiPropertyOptional({
    description: 'Existing parent to link (chosen instead of entering a new parent).',
  })
  @IsOptional()
  @IsUUID()
  existingParentId?: string;

  @ApiPropertyOptional({ description: 'Section to place the student into' })
  @IsOptional()
  @IsUUID()
  sectionId?: string;

  @ApiPropertyOptional({ description: 'Fleet route to assign the student to (bus tracking).' })
  @IsOptional()
  @IsUUID()
  busRouteId?: string;

  @ApiPropertyOptional({
    enum: [1, 2],
    description: 'Trip of the route the student rides (1 or 2).',
  })
  @IsOptional()
  @IsInt()
  @IsIn([1, 2])
  busTripRound?: number;

  @ApiPropertyOptional({
    description: "Geographic area the student lives in (drives Fleet's Area Planning).",
  })
  @IsOptional()
  @IsUUID()
  areaId?: string;

  @ApiPropertyOptional({
    description: 'Whether the parent requested transportation (feeds the Unassigned queue).',
  })
  @IsOptional()
  @IsBoolean()
  transportRequested?: boolean;

  @ApiPropertyOptional({
    description:
      'Whether the one-time registration fee was paid at registration (the usual case; default ' +
      'true). When false the registration fee is folded into the monthly installment plan instead ' +
      'of being billed as its own one-off charge.',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  registrationFeePaid?: boolean;
}

// ── Family (Financial-Account) registration commit ──
// One guardian/customer pays for one or more students. Each student carries its own persisted quote
// (its own fees); the payment plan (mode + installment count + first due date) belongs to the FAMILY,
// so a chosen "9 installments" yields exactly 9 family installments — never 9 per student.
class FamilyStudentEntryDto {
  @ApiProperty({ description: 'Persisted quote id for THIS student (POST /admissions/quote)' })
  @IsUUID()
  quoteId!: string;

  @ApiPropertyOptional({ description: 'Existing student id (returning student)' })
  @IsOptional()
  @IsUUID()
  existingStudentId?: string;

  @ApiPropertyOptional({ type: StudentInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StudentInfoDto)
  student?: StudentInfoDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() busRouteId?: string;
  @ApiPropertyOptional({ enum: [1, 2] }) @IsOptional() @IsInt() @IsIn([1, 2]) busTripRound?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() transportRequested?: boolean;
}

export class FamilyCommitDto {
  @ApiProperty() @IsString() idempotencyKey!: string;

  @ApiProperty({ description: 'Academic year the whole family is enrolling for' })
  @IsUUID()
  academicYearId!: string;

  // Guardian: link an existing parent, or enter a new one (dedup by mobile).
  @ApiPropertyOptional({ description: 'Existing guardian to bill through' })
  @IsOptional()
  @IsUUID()
  existingParentId?: string;

  @ApiPropertyOptional({ type: ParentInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ParentInfoDto)
  parent?: ParentInfoDto;

  @ApiPropertyOptional({
    enum: FinancialAccountOwnerType,
    default: FinancialAccountOwnerType.GUARDIAN,
    description: 'Who the paying customer is (guardian by default; may be a company/sponsor/etc.)',
  })
  @IsOptional()
  @IsEnum(FinancialAccountOwnerType)
  ownerType?: FinancialAccountOwnerType;

  // Family payment plan — belongs to the account, shared by every student.
  @ApiProperty({ enum: QuotePaymentMode }) @IsEnum(QuotePaymentMode) paymentMode!: QuotePaymentMode;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(12)
  installments?: number;

  @ApiPropertyOptional({ example: '2026-09-01' }) @IsOptional() @IsString() firstDueDate?: string;

  @ApiPropertyOptional({ default: true }) @IsOptional() @IsBoolean() registrationFeePaid?: boolean;

  @ApiProperty({ type: [FamilyStudentEntryDto], description: 'One or more students (unlimited)' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyStudentEntryDto)
  students!: FamilyStudentEntryDto[];
}

// ── Add a student to an EXISTING family (the existing-family wizard) ──
export enum AddFamilyStudentMode {
  MERGE = 'MERGE', // fold into the existing family plan; recompute only remaining unpaid installments
  SEPARATE = 'SEPARATE', // bill through the family account but on the student's own independent plan
  NEW_PLAN = 'NEW_PLAN', // start a brand-new family payment plan (requires confirmation)
}

export class AddFamilyStudentDto {
  @ApiProperty() @IsString() idempotencyKey!: string;

  @ApiProperty({ description: 'Persisted quote id for the new student' })
  @IsUUID()
  quoteId!: string;

  @ApiProperty({ enum: AddFamilyStudentMode })
  @IsEnum(AddFamilyStudentMode)
  mode!: AddFamilyStudentMode;

  @ApiPropertyOptional({ description: 'Existing student id (returning student)' })
  @IsOptional()
  @IsUUID()
  existingStudentId?: string;

  @ApiPropertyOptional({ type: StudentInfoDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => StudentInfoDto)
  student?: StudentInfoDto;

  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() busRouteId?: string;
  @ApiPropertyOptional({ enum: [1, 2] }) @IsOptional() @IsInt() @IsIn([1, 2]) busTripRound?: number;
  @ApiPropertyOptional() @IsOptional() @IsUUID() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() transportRequested?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() registrationFeePaid?: boolean;

  // NEW_PLAN parameters (a fresh family plan). Also used when MERGE finds no existing active plan.
  @ApiPropertyOptional({ enum: QuotePaymentMode })
  @IsOptional()
  @IsEnum(QuotePaymentMode)
  paymentMode?: QuotePaymentMode;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(12) installments?: number;
  @ApiPropertyOptional({ example: '2026-09-01' }) @IsOptional() @IsString() firstDueDate?: string;

  @ApiPropertyOptional({
    description: 'Required (true) to confirm a NEW_PLAN — it affects accounting.',
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

// ── Re-enrollment (a returning/Case-C student joins a NEW academic year) ──
// A student-centric wrapper over the shared enrollment pipeline: the returning student's Financial
// Account is derived automatically, and a new Enrollment is created for the quote's year. Prior
// enrollments and their ledgers are never touched (Decisions 3, 11, 12).
export class ReEnrollDto {
  @ApiProperty({ description: 'The returning student (must already exist — never recreated).' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ description: 'Persisted quote for the NEW academic year.' })
  @IsUUID()
  quoteId!: string;

  @ApiProperty() @IsString() idempotencyKey!: string;

  @ApiPropertyOptional({
    description: 'Financial Account to bill through; defaults to the student’s existing account.',
  })
  @IsOptional()
  @IsUUID()
  financialAccountId?: string;

  @ApiPropertyOptional({ enum: AddFamilyStudentMode, default: AddFamilyStudentMode.NEW_PLAN })
  @IsOptional()
  @IsEnum(AddFamilyStudentMode)
  mode?: AddFamilyStudentMode;

  // New year-scoped placement (Decisions 4 & 13) — never copied from the previous year (Decision 10).
  @ApiPropertyOptional() @IsOptional() @IsUUID() sectionId?: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() areaId?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() transportRequested?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() registrationFeePaid?: boolean;

  @ApiPropertyOptional({ enum: QuotePaymentMode })
  @IsOptional()
  @IsEnum(QuotePaymentMode)
  paymentMode?: QuotePaymentMode;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(12) installments?: number;
  @ApiPropertyOptional({ example: '2026-09-01' }) @IsOptional() @IsString() firstDueDate?: string;

  @ApiPropertyOptional({
    description: 'Required (true) to confirm a NEW_PLAN — it affects accounting.',
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

// ── Approvals & arrangements ──
export class ApprovalDecisionDto {
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class CreateArrangementDto {
  @ApiProperty() @IsUUID() studentId!: string;
  @ApiPropertyOptional() @IsOptional() @IsUUID() enrollmentId?: string;
  @ApiProperty() @IsString() description!: string;
}
