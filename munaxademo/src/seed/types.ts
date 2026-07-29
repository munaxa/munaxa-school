/** Entity model for the demo dataset. Mirrors the shape of the Munaxa domain, but is
 *  fictional, in-memory, and database-free. */

export type Gender = 'M' | 'F';
export type StudentStatus = 'ACTIVE' | 'GRADUATED' | 'WITHDRAWN';
export type AdmissionStage =
  | 'INQUIRY'
  | 'APPLIED'
  | 'ASSESSMENT'
  | 'OFFER'
  | 'ENROLLED'
  | 'REJECTED';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';
export type InvoiceStatus = 'PAID' | 'PARTIAL' | 'PENDING' | 'OVERDUE';
export type PaymentMethod = 'CASH' | 'CLIQ' | 'CARD' | 'BANK_TRANSFER' | 'CHEQUE';

export interface Grade {
  id: string;
  level: number; // -1 = KG, 0..12 = Grade N (0 = transitional), here 1..12 + KG
  nameEn: string;
  nameAr: string;
}

export interface Section {
  id: string;
  gradeId: string;
  name: string; // A | B | C
  homeroomTeacherId: string;
  capacity: number;
  room: string;
}

export interface Subject {
  id: string;
  code: string;
  nameEn: string;
  nameAr: string;
}

export interface Teacher {
  id: string;
  firstNameEn: string;
  firstNameAr: string;
  familyEn: string;
  familyAr: string;
  gender: Gender;
  email: string;
  phone: string;
  employeeNo: string;
  hireDate: string;
  subjectIds: string[];
  sectionIds: string[];
  homeroomSectionId?: string;
}

export interface Staff {
  id: string;
  nameEn: string;
  nameAr: string;
  gender: Gender;
  titleEn: string;
  department: string;
  email: string;
  phone: string;
  employeeNo: string;
  hireDate: string;
}

export interface Parent {
  id: string;
  nameEn: string;
  nameAr: string;
  relation: 'Father' | 'Mother' | 'Guardian';
  phone: string;
  email: string;
  nationalId: string;
  occupation: string;
  studentIds: string[];
}

export interface Student {
  id: string;
  firstNameEn: string;
  firstNameAr: string;
  fatherNameEn: string;
  familyEn: string;
  familyAr: string;
  gender: Gender;
  dob: string;
  gradeId: string;
  sectionId: string;
  studentNo: string;
  nationalId: string;
  admissionDate: string;
  status: StudentStatus;
  parentIds: string[];
  hasTransport: boolean;
}

export interface AdmissionApplication {
  id: string;
  applicantEn: string;
  applicantAr: string;
  gender: Gender;
  gradeId: string;
  stage: AdmissionStage;
  guardianName: string;
  guardianPhone: string;
  appliedAt: string;
  notes?: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
}

export interface GradeRecord {
  id: string;
  studentId: string;
  subjectId: string;
  term: string;
  classworkPct: number; // 0..100
  examPct: number; // 0..100
  totalPct: number; // 0..100
  letter: string;
}

export interface Invoice {
  id: string;
  number: string;
  studentId: string;
  descriptionEn: string;
  descriptionAr: string;
  issuedAt: string;
  dueDate: string;
  amount: number;
  paid: number;
  status: InvoiceStatus;
}

export interface Payment {
  id: string;
  invoiceId: string;
  studentId: string;
  amount: number;
  method: PaymentMethod;
  paidAt: string;
  reference: string;
}

export interface Bus {
  id: string;
  plate: string;
  capacity: number;
  driverId: string;
  routeId: string;
}

export interface BusRoute {
  id: string;
  nameEn: string;
  nameAr: string;
  area: string;
  stops: string[];
  studentIds: string[];
}

export interface Driver {
  id: string;
  nameEn: string;
  nameAr: string;
  phone: string;
  licenseNo: string;
}

export interface BusAttendance {
  id: string;
  studentId: string;
  busId: string;
  date: string;
  boardedAt?: string;
  alightedAt?: string;
  direction: 'AM' | 'PM';
  scanned: boolean;
}

export interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  copies: number;
  available: number;
}

export interface BookLoan {
  id: string;
  bookId: string;
  studentId: string;
  borrowedAt: string;
  dueDate: string;
  returnedAt?: string;
  status: 'BORROWED' | 'RETURNED' | 'OVERDUE';
}

export interface Employee {
  id: string;
  personId: string; // teacher or staff id
  kind: 'TEACHER' | 'STAFF';
  nameEn: string;
  nameAr: string;
  department: string;
  titleEn: string;
  employeeNo: string;
  hireDate: string;
  monthlySalary: number;
  leaveBalance: number;
  contract: 'FULL_TIME' | 'PART_TIME';
}

export interface SchoolEvent {
  id: string;
  titleEn: string;
  titleAr: string;
  date: string;
  category: 'ACADEMIC' | 'SPORTS' | 'CULTURAL' | 'HOLIDAY' | 'MEETING';
  audience: string;
  location: string;
}

export interface Announcement {
  id: string;
  titleEn: string;
  titleAr: string;
  body: string;
  audience: string;
  authorName: string;
  publishedAt: string;
  channels: string[];
}

export interface Notification {
  id: string;
  titleEn: string;
  titleAr: string;
  body: string;
  at: string;
  read: boolean;
  tone: 'default' | 'success' | 'warning' | 'danger';
}

/** Outbox entry recorded by the mocked external integrations (never sent anywhere). */
export interface OutboxMessage {
  id: string;
  channel: 'EMAIL' | 'SMS' | 'WHATSAPP' | 'PUSH' | 'JOFOTARA' | 'PAYMENT';
  to: string;
  summary: string;
  at: string;
  status: 'MOCKED';
}

export interface School {
  nameEn: string;
  nameAr: string;
  academicYear: string;
  term: string;
  principal: string;
  city: string;
  established: number;
}

export interface Baseline {
  school: School;
  grades: Grade[];
  sections: Section[];
  subjects: Subject[];
  teachers: Teacher[];
  staff: Staff[];
  parents: Parent[];
  students: Student[];
  admissions: AdmissionApplication[];
  attendance: AttendanceRecord[];
  grades_records: GradeRecord[];
  invoices: Invoice[];
  payments: Payment[];
  buses: Bus[];
  routes: BusRoute[];
  drivers: Driver[];
  busAttendance: BusAttendance[];
  books: Book[];
  loans: BookLoan[];
  employees: Employee[];
  events: SchoolEvent[];
  announcements: Announcement[];
  notifications: Notification[];
  outbox: OutboxMessage[];
}
