import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/settings/locale_controller.dart';

/// Lightweight bilingual string catalog (en/ar), looked up by key. Mirrors the web app's
/// `@school/i18n` t() approach without Flutter codegen, so it is fully analyzable here and
/// switches live with [localeProvider]. Falls back to English, then the key itself.
class AppStrings {
  const AppStrings(this.lang);

  final String lang;

  String t(String key) {
    final entry = _catalog[key];
    if (entry == null) return key;
    return entry[lang] ?? entry['en'] ?? key;
  }
}

/// Active strings for the current locale. `final s = ref.watch(stringsProvider); s.t('auth.signIn')`.
final stringsProvider = Provider<AppStrings>((ref) {
  return AppStrings(ref.watch(localeProvider).languageCode);
});

const Map<String, Map<String, String>> _catalog = {
  // Common chrome
  'common.signOut': {'en': 'Sign out', 'ar': 'تسجيل الخروج'},
  'common.retry': {'en': 'Retry', 'ar': 'إعادة المحاولة'},
  'common.loadError': {'en': 'Could not load this content.', 'ar': 'تعذّر تحميل المحتوى.'},
  'common.english': {'en': 'English', 'ar': 'الإنجليزية'},
  'common.arabic': {'en': 'Arabic', 'ar': 'العربية'},
  'common.syncNow': {'en': 'Sync now', 'ar': 'مزامنة الآن'},

  // Auth — login
  'auth.brand': {'en': 'Munaxa', 'ar': 'منَخَة'},
  'auth.schoolOptional': {'en': 'School (optional)', 'ar': 'المدرسة (اختياري)'},
  'auth.identifier': {'en': 'Email or username', 'ar': 'البريد الإلكتروني أو اسم المستخدم'},
  'auth.password': {'en': 'Password', 'ar': 'كلمة المرور'},
  'auth.identifierRequired': {
    'en': 'Enter your email or username',
    'ar': 'أدخل بريدك الإلكتروني أو اسم المستخدم'
  },
  'auth.passwordRequired': {'en': 'Enter your password', 'ar': 'أدخل كلمة المرور'},
  'auth.signIn': {'en': 'Sign in', 'ar': 'تسجيل الدخول'},
  'auth.signingIn': {'en': 'Signing in…', 'ar': 'جارٍ تسجيل الدخول…'},
  'auth.signInFailed': {
    'en': 'Sign in failed. Check your credentials.',
    'ar': 'فشل تسجيل الدخول. تحقّق من بياناتك.'
  },

  // Auth — change password
  'auth.setNewPassword': {'en': 'Set a new password', 'ar': 'تعيين كلمة مرور جديدة'},
  'auth.chooseNewPassword': {'en': 'Choose a new password', 'ar': 'اختر كلمة مرور جديدة'},
  'auth.tempPasswordHint': {
    'en': 'Your account uses a temporary password. Set your own to continue.',
    'ar': 'يستخدم حسابك كلمة مرور مؤقتة. عيّن كلمتك للمتابعة.'
  },
  'auth.currentPassword': {
    'en': 'Current (temporary) password',
    'ar': 'كلمة المرور الحالية (المؤقتة)'
  },
  'auth.newPassword': {'en': 'New password', 'ar': 'كلمة المرور الجديدة'},
  'auth.currentPasswordRequired': {
    'en': 'Enter the current password',
    'ar': 'أدخل كلمة المرور الحالية'
  },
  'auth.passwordRule': {
    'en': 'At least 10 characters, with upper, lower and a digit',
    'ar': '10 أحرف على الأقل، مع حرف كبير وصغير ورقم'
  },
  'auth.savePassword': {'en': 'Save password', 'ar': 'حفظ كلمة المرور'},
  'auth.saving': {'en': 'Saving…', 'ar': 'جارٍ الحفظ…'},
  'auth.changePasswordFailed': {
    'en': 'Could not change the password. Check the current one and try again.',
    'ar': 'تعذّر تغيير كلمة المرور. تحقّق من الحالية وحاول مجددًا.'
  },

  // Parent tabs
  'parent.tab.home': {'en': 'Home', 'ar': 'الرئيسية'},
  'parent.tab.requests': {'en': 'Requests', 'ar': 'الطلبات'},
  'parent.tab.meetings': {'en': 'Meetings', 'ar': 'الاجتماعات'},
  'parent.tab.documents': {'en': 'Documents', 'ar': 'المستندات'},
  'parent.tab.grades': {'en': 'Grades', 'ar': 'الدرجات'},

  // Student tabs
  'student.tab.home': {'en': 'My day', 'ar': 'يومي'},
  'student.tab.timetable': {'en': 'Timetable', 'ar': 'الجدول'},
  'student.tab.homework': {'en': 'Homework', 'ar': 'الواجبات'},
  'student.tab.resources': {'en': 'Resources', 'ar': 'المصادر'},
  'student.tab.grades': {'en': 'Grades', 'ar': 'الدرجات'},

  // Grades view
  'grades.overall': {'en': 'Overall', 'ar': 'المعدل العام'},
  'grades.subjects': {'en': 'Subjects', 'ar': 'المواد'},
  'grades.empty': {'en': 'No grades recorded yet.', 'ar': 'لا توجد درجات مسجّلة بعد.'},
  'grades.assessments': {'en': 'assessments', 'ar': 'تقييم'},
  'grades.selectChild': {'en': 'Select a child to view grades.', 'ar': 'اختر طفلًا لعرض الدرجات.'},

  // Teacher tabs
  'teacher.tab.class': {'en': 'My class', 'ar': 'صفّي'},
  'teacher.tab.notifications': {'en': 'Notifications', 'ar': 'الإشعارات'},
  'teacher.tab.account': {'en': 'Account', 'ar': 'الحساب'},

  // Dashboard metric labels (shared parent/student)
  'metric.attendance30': {'en': 'Attendance (30d)', 'ar': 'الحضور (30 يومًا)'},
  'metric.upcomingHomework': {'en': 'Upcoming homework', 'ar': 'الواجبات القادمة'},
  'metric.homeworkDue': {'en': 'Homework due', 'ar': 'واجبات مستحقة'},
  'metric.outstanding': {'en': 'Outstanding', 'ar': 'المبلغ المستحق'},
  'metric.unread': {'en': 'Unread', 'ar': 'غير مقروء'},
  'metric.pendingLeave': {'en': 'Pending leave', 'ar': 'إجازات معلّقة'},
  'metric.ptmBookings': {'en': 'PTM bookings', 'ar': 'حجوزات اللقاءات'},
  'metric.points': {'en': 'Points', 'ar': 'النقاط'},
  'metric.level': {'en': 'Level', 'ar': 'المستوى'},
  'metric.streak': {'en': 'Streak', 'ar': 'التتابع'},
  'metric.achievements': {'en': 'Achievements', 'ar': 'الإنجازات'},
  'metric.unreadNotifications': {'en': 'Unread notifications', 'ar': 'إشعارات غير مقروءة'},

  // Empty states
  'empty.noChildren': {
    'en': 'No children are linked to your account yet.',
    'ar': 'لا يوجد أبناء مرتبطون بحسابك بعد.'
  },
  'empty.noTimetable': {'en': 'No timetable yet.', 'ar': 'لا يوجد جدول بعد.'},
  'empty.noHomework': {'en': 'No homework. Enjoy! 🎉', 'ar': 'لا توجد واجبات. استمتع! 🎉'},
  'empty.noResources': {'en': 'No resources yet.', 'ar': 'لا توجد مصادر بعد.'},
  'empty.noNotifications': {'en': 'No notifications.', 'ar': 'لا توجد إشعارات.'},
  'empty.noRequests': {
    'en': 'No leave or absence requests yet.',
    'ar': 'لا توجد طلبات إجازة أو غياب بعد.'
  },
  'empty.noBookings': {'en': 'No bookings yet.', 'ar': 'لا توجد حجوزات بعد.'},
  'empty.noOpenSlots': {'en': 'No open slots right now.', 'ar': 'لا توجد مواعيد متاحة حاليًا.'},
  'empty.noDocuments': {
    'en': 'No documents for this child yet.',
    'ar': 'لا توجد مستندات لهذا الطفل بعد.'
  },
  'empty.noSections': {'en': 'No sections found for this school.', 'ar': 'لا توجد شُعب لهذه المدرسة.'},
  'empty.noStudents': {'en': 'No students in this section.', 'ar': 'لا يوجد طلاب في هذه الشعبة.'},

  // Requests
  'requests.new': {'en': 'New request', 'ar': 'طلب جديد'},
  'requests.leave': {'en': 'Leave', 'ar': 'إجازة'},
  'requests.absence': {'en': 'Absence', 'ar': 'غياب'},
  'requests.startDate': {'en': 'Start date', 'ar': 'تاريخ البدء'},
  'requests.endDate': {'en': 'End date', 'ar': 'تاريخ الانتهاء'},
  'requests.reason': {'en': 'Reason', 'ar': 'السبب'},
  'requests.submit': {'en': 'Submit request', 'ar': 'إرسال الطلب'},
  'requests.submitting': {'en': 'Submitting…', 'ar': 'جارٍ الإرسال…'},
  'requests.selectChildFirst': {'en': 'Select a child first.', 'ar': 'اختر طفلًا أولًا.'},
  'requests.pickDatesReason': {
    'en': 'Pick dates and add a reason.',
    'ar': 'اختر التواريخ وأضف سببًا.'
  },
  'requests.submitFailed': {
    'en': 'Could not submit the request. Try again.',
    'ar': 'تعذّر إرسال الطلب. حاول مجددًا.'
  },
  'common.cancel': {'en': 'Cancel', 'ar': 'إلغاء'},

  // Meetings (PTM)
  'meetings.yourBookings': {'en': 'Your bookings', 'ar': 'حجوزاتك'},
  'meetings.openSlots': {'en': 'Open slots', 'ar': 'المواعيد المتاحة'},
  'meetings.book': {'en': 'Book', 'ar': 'حجز'},
  'meetings.booking': {'en': 'Booking', 'ar': 'حجز'},
  'meetings.locationTbd': {'en': 'Location TBD', 'ar': 'الموقع لاحقًا'},
  'meetings.bookFailed': {'en': 'Could not book this slot.', 'ar': 'تعذّر حجز هذا الموعد.'},

  // Documents
  'documents.upload': {'en': 'Upload', 'ar': 'رفع'},
  'documents.uploading': {'en': 'Uploading…', 'ar': 'جارٍ الرفع…'},
  'documents.uploadTitle': {'en': 'Upload document', 'ar': 'رفع مستند'},
  'documents.title': {'en': 'Title', 'ar': 'العنوان'},
  'documents.category': {'en': 'Category', 'ar': 'الفئة'},
  'documents.addTitle': {'en': 'Add a title.', 'ar': 'أضف عنوانًا.'},
  'documents.uploadFailed': {'en': 'Upload failed. Try again.', 'ar': 'فشل الرفع. حاول مجددًا.'},
  'documents.openFailed': {'en': 'Could not open this document.', 'ar': 'تعذّر فتح هذا المستند.'},
  'resources.openFailed': {'en': 'Could not open this resource.', 'ar': 'تعذّر فتح هذا المصدر.'},

  // Teacher class (attendance)
  'class.section': {'en': 'Section', 'ar': 'الشعبة'},
  'class.period': {'en': 'Period', 'ar': 'الحصة'},
  'class.pickSection': {
    'en': 'Pick a section to load its roster.',
    'ar': 'اختر شعبة لتحميل قائمتها.'
  },
  'class.markAllPresent': {'en': 'Mark all present', 'ar': 'تعليم الجميع حاضرين'},
  'class.marked': {'en': 'marked', 'ar': 'تم تعليمهم'},
  'class.save': {'en': 'Save attendance', 'ar': 'حفظ الحضور'},
  'class.saved': {'en': 'Attendance saved', 'ar': 'تم حفظ الحضور'},
  'class.queued': {
    'en': 'Saved locally — will sync when online.',
    'ar': 'تم الحفظ محليًا — ستتم المزامنة عند الاتصال.'
  },
  'class.pendingSync': {'en': 'mark(s) waiting to sync', 'ar': 'علامة بانتظار المزامنة'},

  // Account
  'account.roles': {'en': 'Roles', 'ar': 'الأدوار'},
  'account.school': {'en': 'School', 'ar': 'المدرسة'},
};
