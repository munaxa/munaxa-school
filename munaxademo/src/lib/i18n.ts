/**
 * Minimal i18n — vendored pattern from @school/i18n. EN/AR catalogs + direction.
 * Numbers, money, IDs and dates always stay LTR (handled by the `.mono` utility).
 */

export const Locale = { EN: 'en', AR: 'ar' } as const;
export type Locale = (typeof Locale)[keyof typeof Locale];
export const SUPPORTED_LOCALES: Locale[] = ['en', 'ar'];
export const DEFAULT_LOCALE: Locale = 'en';

export type TextDirection = 'ltr' | 'rtl';
export function directionForLocale(locale: Locale): TextDirection {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

const en = {
  common: {
    appName: 'Munaxa',
    loading: 'Loading…',
    save: 'Save',
    cancel: 'Cancel',
    search: 'Search',
    add: 'Add',
    signOut: 'Sign out',
  },
  nav: {
    dashboard: 'Dashboard',
    admissions: 'Admissions',
    students: 'Students',
    attendance: 'Attendance',
    academics: 'Academics',
    finance: 'Finance',
    hr: 'HR & Staff',
    transport: 'Transport',
    library: 'Library',
    communication: 'Communication',
    events: 'Events',
    reports: 'Reports',
    analytics: 'Analytics',
    parentPortal: 'Parent portal',
    studentPortal: 'Student portal',
    teacherPortal: 'Teacher portal',
    requests: 'Demo requests',
    accounts: 'Demo accounts',
  },
  notFound: {
    code: '404',
    badge: 'Page not found',
    title: 'This page is out of session',
    description:
      'The page you were looking for may have been moved, renamed, or never existed. ' +
      'Let’s get you back to where your school runs smoothly.',
    ctaHome: 'Back to home',
    illustrationAlt: 'Munaxa 404 — page not found',
  },
};

const ar: typeof en = {
  common: {
    appName: 'مُناقسة',
    loading: 'جارٍ التحميل…',
    save: 'حفظ',
    cancel: 'إلغاء',
    search: 'بحث',
    add: 'إضافة',
    signOut: 'تسجيل الخروج',
  },
  nav: {
    dashboard: 'لوحة التحكم',
    admissions: 'القبول',
    students: 'الطلاب',
    attendance: 'الحضور',
    academics: 'الأكاديميات',
    finance: 'المالية',
    hr: 'الموارد البشرية',
    transport: 'النقل',
    library: 'المكتبة',
    communication: 'التواصل',
    events: 'الفعاليات',
    reports: 'التقارير',
    analytics: 'التحليلات',
    parentPortal: 'بوابة ولي الأمر',
    studentPortal: 'بوابة الطالب',
    teacherPortal: 'بوابة المعلم',
    requests: 'طلبات العرض',
    accounts: 'حسابات العرض',
  },
  notFound: {
    code: '404',
    badge: 'الصفحة غير موجودة',
    title: 'هذه الصفحة خارج الدوام',
    description:
      'ربما تم نقل الصفحة التي تبحث عنها أو تغيير اسمها أو أنها لم تكن موجودة أصلاً. ' +
      'دعنا نعيدك إلى حيث تسير مدرستك بسلاسة.',
    ctaHome: 'العودة إلى الرئيسية',
    illustrationAlt: 'Munaxa 404 — الصفحة غير موجودة',
  },
};

export type Messages = typeof en;
const catalogs: Record<Locale, Messages> = { en, ar };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale] ?? en;
}

export function resolveMessage(messages: Messages, path: string): string {
  const val = path
    .split('.')
    .reduce<unknown>(
      (acc, k) =>
        acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined,
      messages,
    );
  return typeof val === 'string' ? val : path;
}
