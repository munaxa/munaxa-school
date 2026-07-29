/**
 * buildBaseline() — generates the entire fictional "Munaxa Academy" dataset
 * deterministically from a fixed seed. The result is the IMMUTABLE source of
 * truth: the demo never writes back to it, so every reset returns to this exact
 * state. All people, money, and records here are invented.
 */
import { Prng } from './prng';
import { MALE_FIRST, FEMALE_FIRST, FAMILY } from './names';
import type {
  Baseline,
  Grade,
  Section,
  Subject,
  Teacher,
  Staff,
  Parent,
  Student,
  AdmissionApplication,
  AttendanceRecord,
  GradeRecord,
  Invoice,
  Payment,
  Bus,
  BusRoute,
  Driver,
  BusAttendance,
  Book,
  BookLoan,
  Employee,
  SchoolEvent,
  Announcement,
  Notification,
  Gender,
  AttendanceStatus,
  InvoiceStatus,
} from './types';

const VOL = {
  students: 500,
  parents: 700,
  teachers: 50,
  staff: 30,
  sectionsPerGrade: 3,
  books: 120,
  loans: 220,
  attendanceDays: 18,
  buses: 12,
} as const;

const SUBJECTS: Array<{ code: string; en: string; ar: string }> = [
  { code: 'ARB', en: 'Arabic', ar: 'اللغة العربية' },
  { code: 'ENG', en: 'English', ar: 'اللغة الإنجليزية' },
  { code: 'MATH', en: 'Mathematics', ar: 'الرياضيات' },
  { code: 'SCI', en: 'Science', ar: 'العلوم' },
  { code: 'ISL', en: 'Islamic Studies', ar: 'التربية الإسلامية' },
  { code: 'SOC', en: 'Social Studies', ar: 'الدراسات الاجتماعية' },
  { code: 'ICT', en: 'Computer Science', ar: 'علوم الحاسوب' },
  { code: 'ART', en: 'Art', ar: 'الفنون' },
  { code: 'PE', en: 'Physical Education', ar: 'التربية الرياضية' },
  { code: 'FRN', en: 'French', ar: 'اللغة الفرنسية' },
];

const DEPARTMENTS = [
  'Administration',
  'Finance',
  'IT',
  'Facilities',
  'Health',
  'Library',
  'Transport',
  'Reception',
];
const STAFF_TITLES = [
  'Accountant',
  'IT Technician',
  'Receptionist',
  'Nurse',
  'Librarian',
  'Facilities Officer',
  'HR Officer',
  'Cafeteria Supervisor',
  'Lab Assistant',
  'Security Officer',
];
const OCCUPATIONS = [
  'Engineer',
  'Physician',
  'Teacher',
  'Accountant',
  'Business Owner',
  'Pharmacist',
  'Lawyer',
  'Architect',
  'Civil Servant',
  'Nurse',
];
const BOOK_CATEGORIES = [
  'Fiction',
  'Science',
  'History',
  'Reference',
  'Children',
  'Arabic Literature',
  'Biography',
  'Geography',
];
const AREAS = [
  'Abdoun',
  'Sweifieh',
  'Khalda',
  'Dabouq',
  'Jubeiha',
  'Marj Al-Hamam',
  'Tla’ Al-Ali',
  'Shmeisani',
  'Deir Ghbar',
  'Um Uthaina',
  'Al-Rabieh',
  'Marka',
];

function pad(n: number, len: number): string {
  return String(n).padStart(len, '0');
}
function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function letterFor(total: number): string {
  if (total >= 90) return 'A';
  if (total >= 80) return 'B';
  if (total >= 70) return 'C';
  if (total >= 60) return 'D';
  return 'F';
}

function gradeName(level: number): { en: string; ar: string } {
  if (level === 0) return { en: 'Kindergarten', ar: 'الروضة' };
  const arNums = [
    '',
    'الأول',
    'الثاني',
    'الثالث',
    'الرابع',
    'الخامس',
    'السادس',
    'السابع',
    'الثامن',
    'التاسع',
    'العاشر',
    'الحادي عشر',
    'الثاني عشر',
  ];
  return { en: `Grade ${level}`, ar: `الصف ${arNums[level] ?? level}` };
}

function buildOnce(): Baseline {
  const rng = new Prng();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const YEAR = '2025/2026';
  const TERM = 'Term 1';

  const phone = () => `07${rng.pick([7, 8, 9])}${pad(rng.int(0, 9999999), 7)}`;
  const nationalId = () => `${rng.pick([2, 9])}${pad(rng.int(0, 999999999), 9)}`;
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

  /* ── Grades & sections ── */
  const grades: Grade[] = [];
  for (let level = 0; level <= 12; level++) {
    const nm = gradeName(level);
    grades.push({ id: `grade-${level}`, level, nameEn: nm.en, nameAr: nm.ar });
  }

  const subjects: Subject[] = SUBJECTS.map((s) => ({
    id: `subj-${s.code}`,
    code: s.code,
    nameEn: s.en,
    nameAr: s.ar,
  }));

  /* ── Teachers ── */
  const teachers: Teacher[] = [];
  for (let i = 0; i < VOL.teachers; i++) {
    const gender: Gender = rng.chance(0.55) ? 'F' : 'M';
    const first = rng.pick(gender === 'F' ? FEMALE_FIRST : MALE_FIRST);
    const fam = rng.pick(FAMILY);
    const subs = rng.sample(subjects, rng.int(1, 2)).map((s) => s.id);
    const hire = addDays(today, -rng.int(120, 3200));
    teachers.push({
      id: `teacher-${i + 1}`,
      firstNameEn: first.en,
      firstNameAr: first.ar,
      familyEn: fam.en,
      familyAr: fam.ar,
      gender,
      email: `${slug(first.en)}.${slug(fam.en)}@munaxa-academy.edu.jo`,
      phone: phone(),
      employeeNo: `T-${pad(i + 1, 4)}`,
      hireDate: isoDate(hire),
      subjectIds: subs,
      sectionIds: [],
    });
  }

  /* ── Sections (3 per grade), homeroom teacher assigned round-robin ── */
  const sections: Section[] = [];
  let tIdx = 0;
  for (const g of grades) {
    for (let s = 0; s < VOL.sectionsPerGrade; s++) {
      const name = String.fromCharCode(65 + s); // A, B, C
      const teacher = teachers[tIdx % teachers.length]!;
      tIdx++;
      const sec: Section = {
        id: `sec-${g.level}-${name}`,
        gradeId: g.id,
        name,
        homeroomTeacherId: teacher.id,
        capacity: 28,
        room: `${g.level === 0 ? 'KG' : g.level}${name}`,
      };
      teacher.homeroomSectionId = sec.id;
      teacher.sectionIds.push(sec.id);
      sections.push(sec);
    }
  }
  // Spread teaching assignments so every teacher covers a few sections.
  for (const t of teachers) {
    for (const sec of rng.sample(sections, rng.int(2, 4))) {
      if (!t.sectionIds.includes(sec.id)) t.sectionIds.push(sec.id);
    }
  }

  /* ── Staff (non-teaching) ── */
  const staff: Staff[] = [];
  for (let i = 0; i < VOL.staff; i++) {
    const gender: Gender = rng.chance(0.5) ? 'F' : 'M';
    const first = rng.pick(gender === 'F' ? FEMALE_FIRST : MALE_FIRST);
    const fam = rng.pick(FAMILY);
    staff.push({
      id: `staff-${i + 1}`,
      nameEn: `${first.en} ${fam.en}`,
      nameAr: `${first.ar} ${fam.ar}`,
      gender,
      titleEn: rng.pick(STAFF_TITLES),
      department: rng.pick(DEPARTMENTS),
      email: `${slug(first.en)}.${slug(fam.en)}@munaxa-academy.edu.jo`,
      phone: phone(),
      employeeNo: `S-${pad(i + 1, 4)}`,
      hireDate: isoDate(addDays(today, -rng.int(120, 3200))),
    });
  }

  /* ── Families → students + parents (siblings share parents) ── */
  const students: Student[] = [];
  const parents: Parent[] = [];
  const sectionsByGrade = new Map<string, Section[]>();
  for (const sec of sections) {
    const list = sectionsByGrade.get(sec.gradeId) ?? [];
    list.push(sec);
    sectionsByGrade.set(sec.gradeId, list);
  }

  let studentSeq = 0;
  let parentSeq = 0;
  while (students.length < VOL.students && parents.length < VOL.parents) {
    const fam = rng.pick(FAMILY);
    const fatherFirst = rng.pick(MALE_FIRST);
    const motherFirst = rng.pick(FEMALE_FIRST);

    // Parents for this family.
    const familyParents: Parent[] = [];
    const father: Parent = {
      id: `parent-${++parentSeq}`,
      nameEn: `${fatherFirst.en} ${fam.en}`,
      nameAr: `${fatherFirst.ar} ${fam.ar}`,
      relation: 'Father',
      phone: phone(),
      email: `${slug(fatherFirst.en)}.${slug(fam.en)}@example.com`,
      nationalId: nationalId(),
      occupation: rng.pick(OCCUPATIONS),
      studentIds: [],
    };
    familyParents.push(father);
    if (parents.length + familyParents.length < VOL.parents && rng.chance(0.8)) {
      familyParents.push({
        id: `parent-${++parentSeq}`,
        nameEn: `${motherFirst.en} ${fam.en}`,
        nameAr: `${motherFirst.ar} ${fam.ar}`,
        relation: 'Mother',
        phone: phone(),
        email: `${slug(motherFirst.en)}.${slug(fam.en)}@example.com`,
        nationalId: nationalId(),
        occupation: rng.pick(OCCUPATIONS),
        studentIds: [],
      });
    }

    // Children (1..3).
    const childCount = Math.min(rng.int(1, 3), VOL.students - students.length);
    for (let c = 0; c < childCount; c++) {
      const gender: Gender = rng.chance(0.5) ? 'F' : 'M';
      const first = rng.pick(gender === 'F' ? FEMALE_FIRST : MALE_FIRST);
      const grade = rng.pick(grades);
      const secList = sectionsByGrade.get(grade.id)!;
      const section = rng.pick(secList);
      const age = 5 + grade.level + rng.int(0, 1);
      const dob = new Date(today.getFullYear() - age, rng.int(0, 11), rng.int(1, 28));
      const id = `student-${++studentSeq}`;
      const student: Student = {
        id,
        firstNameEn: first.en,
        firstNameAr: first.ar,
        fatherNameEn: fatherFirst.en,
        familyEn: fam.en,
        familyAr: fam.ar,
        gender,
        dob: isoDate(dob),
        gradeId: grade.id,
        sectionId: section.id,
        studentNo: `${today.getFullYear()}${pad(studentSeq, 5)}`,
        nationalId: nationalId(),
        admissionDate: isoDate(addDays(today, -rng.int(60, 2000))),
        status: 'ACTIVE',
        parentIds: familyParents.map((p) => p.id),
        hasTransport: rng.chance(0.3),
      };
      for (const p of familyParents) p.studentIds.push(id);
      students.push(student);
    }
    parents.push(...familyParents);
  }

  /* ── Admissions pipeline ── */
  const STAGES: AdmissionApplication['stage'][] = [
    'INQUIRY',
    'APPLIED',
    'ASSESSMENT',
    'OFFER',
    'ENROLLED',
    'REJECTED',
  ];
  const admissions: AdmissionApplication[] = [];
  for (let i = 0; i < 60; i++) {
    const gender: Gender = rng.chance(0.5) ? 'F' : 'M';
    const first = rng.pick(gender === 'F' ? FEMALE_FIRST : MALE_FIRST);
    const fam = rng.pick(FAMILY);
    const guardianFirst = rng.pick(MALE_FIRST);
    admissions.push({
      id: `adm-${i + 1}`,
      applicantEn: `${first.en} ${fam.en}`,
      applicantAr: `${first.ar} ${fam.ar}`,
      gender,
      gradeId: rng.pick(grades).id,
      stage: rng.pick(STAGES),
      guardianName: `${guardianFirst.en} ${fam.en}`,
      guardianPhone: phone(),
      appliedAt: isoDate(addDays(today, -rng.int(1, 90))),
    });
  }

  /* ── Attendance (recent school days, Fri/Sat = weekend) ── */
  const schoolDays: string[] = [];
  {
    let d = new Date(today);
    while (schoolDays.length < VOL.attendanceDays) {
      const dow = d.getDay(); // 5 = Fri, 6 = Sat
      if (dow !== 5 && dow !== 6) schoolDays.push(isoDate(d));
      d = addDays(d, -1);
    }
  }
  const attendance: AttendanceRecord[] = [];
  let attSeq = 0;
  for (const s of students) {
    // Per-student behaviour profile → stable-ish attendance.
    const absentRate = rng.next() * 0.12;
    const lateRate = rng.next() * 0.1;
    for (const date of schoolDays) {
      const r = rng.next();
      let status: AttendanceStatus = 'PRESENT';
      if (r < absentRate) status = rng.chance(0.4) ? 'EXCUSED' : 'ABSENT';
      else if (r < absentRate + lateRate) status = 'LATE';
      attendance.push({ id: `att-${++attSeq}`, studentId: s.id, date, status });
    }
  }

  /* ── Grade records (current term, all subjects) ── */
  const grades_records: GradeRecord[] = [];
  let grSeq = 0;
  for (const s of students) {
    const ability = 55 + rng.next() * 40; // 55..95 baseline
    for (const subj of subjects) {
      const classwork = Math.max(40, Math.min(100, Math.round(ability + (rng.next() - 0.5) * 24)));
      const exam = Math.max(35, Math.min(100, Math.round(ability + (rng.next() - 0.5) * 30)));
      const total = Math.round(classwork * 0.4 + exam * 0.6);
      grades_records.push({
        id: `gr-${++grSeq}`,
        studentId: s.id,
        subjectId: subj.id,
        term: TERM,
        classworkPct: classwork,
        examPct: exam,
        totalPct: total,
        letter: letterFor(total),
      });
    }
  }

  /* ── Finance: invoices + payments ── */
  const invoices: Invoice[] = [];
  const payments: Payment[] = [];
  let invSeq = 0;
  let paySeq = 0;
  const baseTuition = (level: number) => 1800 + level * 110; // JOD per term
  for (const s of students) {
    const level = grades.find((g) => g.id === s.gradeId)?.level ?? 1;
    const lines: Array<{ en: string; ar: string; amount: number; due: number }> = [
      {
        en: 'Tuition — Term 1',
        ar: 'رسوم دراسية — الفصل الأول',
        amount: baseTuition(level),
        due: -20,
      },
      { en: 'Books & Materials', ar: 'كتب ومواد', amount: 180 + rng.int(0, 80), due: -40 },
    ];
    if (s.hasTransport)
      lines.push({ en: 'Transport — Term 1', ar: 'نقل — الفصل الأول', amount: 320, due: -10 });
    if (rng.chance(0.3))
      lines.push({ en: 'Activities Fee', ar: 'رسوم أنشطة', amount: 90, due: 15 });

    for (const line of lines) {
      const amount = line.amount;
      const issued = addDays(today, line.due - 30);
      const due = addDays(today, line.due);
      // Payment behaviour
      const roll = rng.next();
      let paid = 0;
      if (roll < 0.55) paid = amount;
      else if (roll < 0.8) paid = Math.round(amount * (0.3 + rng.next() * 0.5));
      else paid = 0;

      let status: InvoiceStatus;
      if (paid >= amount) status = 'PAID';
      else if (paid > 0) status = due.getTime() < today.getTime() ? 'OVERDUE' : 'PARTIAL';
      else status = due.getTime() < today.getTime() ? 'OVERDUE' : 'PENDING';

      const invId = `inv-${++invSeq}`;
      invoices.push({
        id: invId,
        number: `INV-2026-${pad(invSeq, 5)}`,
        studentId: s.id,
        descriptionEn: line.en,
        descriptionAr: line.ar,
        issuedAt: isoDate(issued),
        dueDate: isoDate(due),
        amount,
        paid,
        status,
      });
      if (paid > 0) {
        payments.push({
          id: `pay-${++paySeq}`,
          invoiceId: invId,
          studentId: s.id,
          amount: paid,
          method: rng.pick(['CASH', 'CLIQ', 'CARD', 'BANK_TRANSFER', 'CHEQUE']),
          paidAt: isoDate(addDays(issued, rng.int(1, 25))),
          reference: `RCPT-${pad(paySeq, 6)}`,
        });
      }
    }
  }

  /* ── Transport: drivers, routes, buses, bus attendance ── */
  const drivers: Driver[] = [];
  for (let i = 0; i < VOL.buses; i++) {
    const first = rng.pick(MALE_FIRST);
    const fam = rng.pick(FAMILY);
    drivers.push({
      id: `driver-${i + 1}`,
      nameEn: `${first.en} ${fam.en}`,
      nameAr: `${first.ar} ${fam.ar}`,
      phone: phone(),
      licenseNo: `DL-${pad(rng.int(100000, 999999), 6)}`,
    });
  }
  const transportStudents = students.filter((s) => s.hasTransport);
  const routes: BusRoute[] = [];
  const buses: Bus[] = [];
  for (let i = 0; i < VOL.buses; i++) {
    const area = AREAS[i % AREAS.length]!;
    const assigned = transportStudents.filter((_, idx) => idx % VOL.buses === i).map((s) => s.id);
    routes.push({
      id: `route-${i + 1}`,
      nameEn: `Route ${i + 1} — ${area}`,
      nameAr: `المسار ${i + 1} — ${area}`,
      area,
      stops: rng.sample(AREAS, rng.int(3, 5)),
      studentIds: assigned,
    });
    buses.push({
      id: `bus-${i + 1}`,
      plate: `${rng.int(10, 49)}-${pad(rng.int(10000, 99999), 5)}`,
      capacity: 30,
      driverId: `driver-${i + 1}`,
      routeId: `route-${i + 1}`,
    });
  }
  const busAttendance: BusAttendance[] = [];
  let baSeq = 0;
  const recentBusDays = schoolDays.slice(0, 3);
  for (const bus of buses) {
    const route = routes.find((r) => r.id === bus.routeId)!;
    for (const date of recentBusDays) {
      for (const sid of route.studentIds) {
        for (const direction of ['AM', 'PM'] as const) {
          const scanned = rng.chance(0.92);
          busAttendance.push({
            id: `ba-${++baSeq}`,
            studentId: sid,
            busId: bus.id,
            date,
            direction,
            scanned,
            ...(scanned
              ? { boardedAt: direction === 'AM' ? '07:1' + rng.int(0, 9) : '14:3' + rng.int(0, 9) }
              : {}),
          });
        }
      }
    }
  }

  /* ── Library: books + loans ── */
  const BOOK_TITLES = [
    'The Silent Sea',
    'Atoms & Stars',
    'Petra: A History',
    'The Young Inventor',
    'Desert Tales',
    'Numbers in Nature',
    'The Lighthouse',
    'Voyage of Ibn Battuta',
    'Green Earth',
    'The Code Breakers',
    'Tales of Amman',
    'Wonders of Physics',
    'The Brave Explorer',
    'River of Time',
    'Stars Above',
  ];
  const books: Book[] = [];
  for (let i = 0; i < VOL.books; i++) {
    const copies = rng.int(1, 6);
    books.push({
      id: `book-${i + 1}`,
      title: `${rng.pick(BOOK_TITLES)} ${i > 14 ? `Vol. ${rng.int(1, 4)}` : ''}`.trim(),
      author: `${rng.pick(MALE_FIRST).en} ${rng.pick(FAMILY).en}`,
      isbn: `978-${rng.int(0, 9)}-${pad(rng.int(0, 99999), 5)}-${pad(rng.int(0, 999), 3)}-${rng.int(0, 9)}`,
      category: rng.pick(BOOK_CATEGORIES),
      copies,
      available: copies,
    });
  }
  const loans: BookLoan[] = [];
  for (let i = 0; i < VOL.loans; i++) {
    const book = rng.pick(books);
    if (book.available <= 0) continue;
    const student = rng.pick(students);
    const borrowed = addDays(today, -rng.int(1, 40));
    const due = addDays(borrowed, 14);
    const returned = rng.chance(0.6);
    let status: BookLoan['status'] = 'BORROWED';
    if (returned) status = 'RETURNED';
    else if (due.getTime() < today.getTime()) status = 'OVERDUE';
    if (!returned) book.available -= 1;
    loans.push({
      id: `loan-${i + 1}`,
      bookId: book.id,
      studentId: student.id,
      borrowedAt: isoDate(borrowed),
      dueDate: isoDate(due),
      ...(returned ? { returnedAt: isoDate(addDays(borrowed, rng.int(3, 14))) } : {}),
      status,
    });
  }

  /* ── HR employees (teachers + staff) ── */
  const employees: Employee[] = [
    ...teachers.map<Employee>((t) => ({
      id: `emp-${t.id}`,
      personId: t.id,
      kind: 'TEACHER',
      nameEn: `${t.firstNameEn} ${t.familyEn}`,
      nameAr: `${t.firstNameAr} ${t.familyAr}`,
      department: 'Academic',
      titleEn: 'Teacher',
      employeeNo: t.employeeNo,
      hireDate: t.hireDate,
      monthlySalary: 520 + rng.int(0, 460),
      leaveBalance: rng.int(4, 21),
      contract: rng.chance(0.85) ? 'FULL_TIME' : 'PART_TIME',
    })),
    ...staff.map<Employee>((s) => ({
      id: `emp-${s.id}`,
      personId: s.id,
      kind: 'STAFF',
      nameEn: s.nameEn,
      nameAr: s.nameAr,
      department: s.department,
      titleEn: s.titleEn,
      employeeNo: s.employeeNo,
      hireDate: s.hireDate,
      monthlySalary: 430 + rng.int(0, 520),
      leaveBalance: rng.int(4, 21),
      contract: rng.chance(0.9) ? 'FULL_TIME' : 'PART_TIME',
    })),
  ];

  /* ── Events ── */
  const events: SchoolEvent[] = [
    {
      id: 'ev-1',
      titleEn: 'Parent–Teacher Conference',
      titleAr: 'اجتماع أولياء الأمور والمعلمين',
      date: isoDate(addDays(today, 6)),
      category: 'MEETING',
      audience: 'All parents',
      location: 'Main Hall',
    },
    {
      id: 'ev-2',
      titleEn: 'Science Fair',
      titleAr: 'معرض العلوم',
      date: isoDate(addDays(today, 13)),
      category: 'ACADEMIC',
      audience: 'Grades 4–9',
      location: 'Gymnasium',
    },
    {
      id: 'ev-3',
      titleEn: 'Sports Day',
      titleAr: 'اليوم الرياضي',
      date: isoDate(addDays(today, 20)),
      category: 'SPORTS',
      audience: 'Whole school',
      location: 'Sports Field',
    },
    {
      id: 'ev-4',
      titleEn: 'Independence Day Assembly',
      titleAr: 'احتفال عيد الاستقلال',
      date: isoDate(addDays(today, -4)),
      category: 'CULTURAL',
      audience: 'Whole school',
      location: 'Courtyard',
    },
    {
      id: 'ev-5',
      titleEn: 'Mid-term Exams Begin',
      titleAr: 'بدء امتحانات منتصف الفصل',
      date: isoDate(addDays(today, 27)),
      category: 'ACADEMIC',
      audience: 'Grades 1–12',
      location: 'Exam Halls',
    },
    {
      id: 'ev-6',
      titleEn: 'Spring Break',
      titleAr: 'عطلة الربيع',
      date: isoDate(addDays(today, 40)),
      category: 'HOLIDAY',
      audience: 'Whole school',
      location: '—',
    },
    {
      id: 'ev-7',
      titleEn: 'KG Open Day',
      titleAr: 'يوم مفتوح للروضة',
      date: isoDate(addDays(today, 9)),
      category: 'CULTURAL',
      audience: 'KG families',
      location: 'KG Wing',
    },
    {
      id: 'ev-8',
      titleEn: 'Robotics Workshop',
      titleAr: 'ورشة الروبوتات',
      date: isoDate(addDays(today, 16)),
      category: 'ACADEMIC',
      audience: 'Grades 7–12',
      location: 'ICT Lab',
    },
  ];

  /* ── Announcements ── */
  const announcements: Announcement[] = [
    {
      id: 'ann-1',
      titleEn: 'Welcome back to Term 1',
      titleAr: 'أهلاً بعودتكم للفصل الأول',
      body: 'We are excited to welcome all students and families to the new term at Munaxa Academy.',
      audience: 'All',
      authorName: 'Dr. Samir Khoury',
      publishedAt: isoDate(addDays(today, -25)),
      channels: ['IN_APP', 'EMAIL'],
    },
    {
      id: 'ann-2',
      titleEn: 'Term 1 fees now available',
      titleAr: 'رسوم الفصل الأول متاحة الآن',
      body: 'Tuition invoices for Term 1 are now available in the Finance portal. Early payment discounts apply until the end of the month.',
      audience: 'All parents',
      authorName: 'Omar Nseirat',
      publishedAt: isoDate(addDays(today, -20)),
      channels: ['IN_APP', 'SMS'],
    },
    {
      id: 'ann-3',
      titleEn: 'Bus routes published',
      titleAr: 'نشر مسارات الباصات',
      body: 'Transport routes and pick-up times for this term are published. Please review your child’s assigned route.',
      audience: 'Transport families',
      authorName: 'Faisal Odeh',
      publishedAt: isoDate(addDays(today, -14)),
      channels: ['IN_APP'],
    },
    {
      id: 'ann-4',
      titleEn: 'Parent–Teacher Conference sign-up',
      titleAr: 'التسجيل لاجتماع أولياء الأمور',
      body: 'Booking is open for the upcoming Parent–Teacher Conference. Reserve your slot from the Parent portal.',
      audience: 'All parents',
      authorName: 'Lina Aqel',
      publishedAt: isoDate(addDays(today, -3)),
      channels: ['IN_APP', 'EMAIL'],
    },
  ];

  /* ── Notifications (feed) ── */
  const notifications: Notification[] = [
    {
      id: 'ntf-1',
      titleEn: 'Attendance submitted',
      titleAr: 'تم إرسال الحضور',
      body: 'Homeroom attendance for today has been recorded for 38 sections.',
      at: isoDate(today),
      read: false,
      tone: 'success',
    },
    {
      id: 'ntf-2',
      titleEn: 'Overdue invoices',
      titleAr: 'فواتير متأخرة',
      body: 'There are outstanding balances flagged for follow-up this week.',
      at: isoDate(addDays(today, -1)),
      read: false,
      tone: 'warning',
    },
    {
      id: 'ntf-3',
      titleEn: 'New admission application',
      titleAr: 'طلب التحاق جديد',
      body: 'A new application was submitted for Grade 3.',
      at: isoDate(addDays(today, -1)),
      read: true,
      tone: 'default',
    },
    {
      id: 'ntf-4',
      titleEn: 'Bus delay reported',
      titleAr: 'تأخير باص',
      body: 'Route 4 — Dabouq reported a 10-minute delay this morning.',
      at: isoDate(addDays(today, -2)),
      read: true,
      tone: 'danger',
    },
  ];

  return {
    school: {
      nameEn: 'Munaxa Academy',
      nameAr: 'أكاديمية مُناقسة',
      academicYear: YEAR,
      term: TERM,
      principal: 'Dr. Samir Khoury',
      city: 'Amman',
      established: 2009,
    },
    grades,
    sections,
    subjects,
    teachers,
    staff,
    parents,
    students,
    admissions,
    attendance,
    grades_records,
    invoices,
    payments,
    buses,
    routes,
    drivers,
    busAttendance,
    books,
    loans,
    employees,
    events,
    announcements,
    notifications,
    outbox: [],
  };
}

let cached: Baseline | null = null;

/** Build (once, memoized) the immutable baseline dataset. */
export function buildBaseline(): Baseline {
  if (!cached) cached = buildOnce();
  return cached;
}

/** A deep, mutable clone of the baseline — what a demo session edits. */
export function cloneBaseline(): Baseline {
  return structuredClone(buildBaseline());
}
