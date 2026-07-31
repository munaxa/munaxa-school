/**
 * Domain components: small, app-specific compositions over the @munaxa/ui primitives
 * (e.g. status → toned Badge). They depend on app data types / enums, so they live in
 * the app rather than the generic @munaxa/ui package. Each owns the single source of
 * truth for its domain's status colours.
 */
export { ChargeStatusBadge } from './charge-status-badge';
export { TransactionStatusBadge } from './transaction-status-badge';
export { ClinicOutcomeBadge } from './clinic-outcome-badge';
export { LoanStatusBadge } from './loan-status-badge';
export { StatusBadge as EmploymentStatusBadge } from '../status-badge';
export { RecordHeader } from './record-header';
export { ParentProfileDialog } from './parent-profile-dialog';
export { ParentEditDialog } from './parent-edit-dialog';
