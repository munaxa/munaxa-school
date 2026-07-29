import { Injectable } from '@nestjs/common';

export interface RenderedTemplate {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
}

interface DefaultTemplate {
  titleEn: string;
  titleAr: string;
  bodyEn: string;
  bodyAr: string;
}

/**
 * Built-in bilingual fallback templates per event type. Tenant overrides live in
 * NotificationTemplate; when none exists the renderer falls back to these so every event has a
 * sensible message out of the box. Variables use {{Mustache}} syntax.
 */
const DEFAULTS: Record<string, DefaultTemplate> = {
  AttendanceMarked: {
    titleEn: 'Attendance recorded',
    titleAr: 'تم تسجيل الحضور',
    bodyEn: 'Attendance for {{StudentName}} was recorded on {{AttendanceDate}}.',
    bodyAr: 'تم تسجيل حضور {{StudentName}} بتاريخ {{AttendanceDate}}.',
  },
  StudentAbsent: {
    titleEn: 'Absence alert',
    titleAr: 'تنبيه غياب',
    bodyEn: '{{StudentName}} was marked absent on {{AttendanceDate}}.',
    bodyAr: 'تم تسجيل غياب {{StudentName}} بتاريخ {{AttendanceDate}}.',
  },
  StudentLate: {
    titleEn: 'Late arrival',
    titleAr: 'تأخر في الوصول',
    bodyEn: '{{StudentName}} arrived late on {{AttendanceDate}}.',
    bodyAr: 'وصل {{StudentName}} متأخرًا بتاريخ {{AttendanceDate}}.',
  },
  HomeworkAssigned: {
    titleEn: 'New homework',
    titleAr: 'واجب جديد',
    bodyEn: 'New homework was assigned for {{ClassName}}.',
    bodyAr: 'تم تكليف واجب جديد لصف {{ClassName}}.',
  },
  GradePublished: {
    titleEn: 'Grade published',
    titleAr: 'تم نشر الدرجة',
    bodyEn: 'A new grade was published for {{StudentName}}.',
    bodyAr: 'تم نشر درجة جديدة لـ {{StudentName}}.',
  },
  BehaviorRecorded: {
    titleEn: 'Behavior note',
    titleAr: 'ملاحظة سلوكية',
    bodyEn: 'A behavior note was recorded for {{StudentName}}.',
    bodyAr: 'تم تسجيل ملاحظة سلوكية لـ {{StudentName}}.',
  },
  AnnouncementCreated: {
    titleEn: 'Announcement from {{SchoolName}}',
    titleAr: 'إعلان من {{SchoolName}}',
    bodyEn: '{{Body}}',
    bodyAr: '{{Body}}',
  },
  PaymentDue: {
    titleEn: 'Payment due',
    titleAr: 'دفعة مستحقة',
    bodyEn: 'A payment of {{Amount}} is due on {{DueDate}}.',
    bodyAr: 'هناك دفعة بقيمة {{Amount}} مستحقة بتاريخ {{DueDate}}.',
  },
  PaymentOverdue: {
    titleEn: 'Payment overdue',
    titleAr: 'دفعة متأخرة',
    bodyEn: 'A payment of {{Amount}} is overdue (was due {{DueDate}}).',
    bodyAr: 'هناك دفعة بقيمة {{Amount}} متأخرة (كانت مستحقة بتاريخ {{DueDate}}).',
  },
  PaymentReceived: {
    titleEn: 'Payment received',
    titleAr: 'تم استلام الدفعة',
    bodyEn: 'We received your payment of {{Amount}}. Thank you.',
    bodyAr: 'لقد استلمنا دفعتك بقيمة {{Amount}}. شكرًا لك.',
  },
  PasswordResetRequested: {
    titleEn: 'Password reset',
    titleAr: 'إعادة تعيين كلمة المرور',
    bodyEn: 'A password reset was requested for your account.',
    bodyAr: 'تم طلب إعادة تعيين كلمة المرور لحسابك.',
  },
  EmergencyAlert: {
    titleEn: 'Emergency alert from {{SchoolName}}',
    titleAr: 'تنبيه طارئ من {{SchoolName}}',
    bodyEn: '{{Body}}',
    bodyAr: '{{Body}}',
  },
};

const GENERIC: DefaultTemplate = {
  titleEn: '{{SchoolName}} notification',
  titleAr: 'إشعار من {{SchoolName}}',
  bodyEn: '{{Body}}',
  bodyAr: '{{Body}}',
};

/** Interpolate {{Variable}} placeholders. Missing vars render as empty strings. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
    const v = vars[key];
    return v === undefined || v === null ? '' : String(v);
  });
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

@Injectable()
export class TemplateRenderer {
  /**
   * Render the bilingual title/body for an event. `overrides` (a tenant template body keyed by
   * language) take precedence over the built-in default; both are interpolated with `vars`.
   */
  render(
    eventType: string,
    vars: Record<string, string | number>,
    overrides?: {
      en?: { subject?: string; body?: string };
      ar?: { subject?: string; body?: string };
    },
  ): RenderedTemplate {
    const def = DEFAULTS[eventType] ?? GENERIC;
    const titleEn = interpolate(overrides?.en?.subject ?? def.titleEn, vars).trim();
    const titleAr = interpolate(overrides?.ar?.subject ?? def.titleAr, vars).trim();
    const bodyEn = interpolate(overrides?.en?.body ?? def.bodyEn, vars).trim();
    const bodyAr = interpolate(overrides?.ar?.body ?? def.bodyAr, vars).trim();
    return { titleEn, titleAr, bodyEn, bodyAr };
  }

  /** Wrap an email body in the Munaxa-branded HTML shell (RTL-aware) + return a text fallback. */
  email(params: { title: string; body: string; language: 'en' | 'ar'; schoolName?: string }): {
    html: string;
    text: string;
  } {
    const dir = params.language === 'ar' ? 'rtl' : 'ltr';
    const align = params.language === 'ar' ? 'right' : 'left';
    const html = [
      `<div dir="${dir}" style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a;text-align:${align}">`,
      `<h2 style="color:#7A3FFF;margin-bottom:4px">${escapeHtml(params.title)}</h2>`,
      `<p style="font-size:15px;line-height:1.6">${escapeHtml(params.body).replace(/\n/g, '<br/>')}</p>`,
      `<hr style="border:none;border-top:1px solid #eee;margin:20px 0"/>`,
      `<p style="color:#888;font-size:12px">${escapeHtml(params.schoolName ?? 'Munaxa')} · Munaxa School OS</p>`,
      `</div>`,
    ].join('');
    const text = `${params.title}\n\n${params.body}\n\n${params.schoolName ?? 'Munaxa'} · Munaxa School OS`;
    return { html, text };
  }
}
