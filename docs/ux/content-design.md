# MUNAXA Content Design System

## Purpose

Content helps school communities understand records, make safe decisions, complete workflows, and recover from problems. It is part of the component contract and is reviewed with design and engineering.

## Principles

- Clear before clever; specific before friendly.
- State the record, action, consequence, scope, and time where relevant.
- Use calm enterprise language; never blame, shame, alarm unnecessarily, or sound childish.
- Write for translation and accessibility; do not concatenate fragments.
- Protect student, finance, health, safeguarding, and staff data in previews and external channels.

## Voice and tone by audience

| Audience | Voice | Tone adjustments | English example | Arabic example |
|---|---|---|---|---|
| School owners | Strategic, accountable, concise | Lead with organizational impact and decisions | Collection rate is 4% below target across two campuses. | معدل التحصيل أقل من المستهدف بنسبة ٤٪ في حرمين. |
| Principals | Operational, calm, action-oriented | Highlight exceptions and ownership | Three attendance cases need review today. | توجد ثلاث حالات حضور تحتاج إلى المراجعة اليوم. |
| Teachers | Direct, supportive, task-focused | Use class and deadline context | Submit Grade 8A attendance by 09:00. | أرسل حضور الصف الثامن أ قبل الساعة ٠٩:٠٠. |
| Finance staff | Precise, neutral, auditable | Include amount, currency, state, and reference | Payment PAY-2041 settled for JOD 500. | تمت تسوية الدفعة PAY-2041 بقيمة ٥٠٠ د.أ. |
| Parents | Respectful, reassuring, plain | Explain child context and next step without internal jargon | Lina’s absence was recorded. Please confirm the reason. | تم تسجيل غياب لينا. يرجى تأكيد السبب. |
| Students | Clear, age-appropriate, respectful | Short instructions; no childish language | Your request was sent to the school office. | تم إرسال طلبك إلى إدارة المدرسة. |

## Microcopy standards

- Buttons begin with a verb and describe the outcome: Save changes, Submit register, Request approval.
- Labels are nouns or noun phrases: Academic year, Payment reference.
- Errors state what failed and how to recover; retain input.
- Success messages confirm the completed record action, not “Success!”
- Warnings explain risk and time; alerts reserve urgency for real impact.
- Use sentence case. Avoid exclamation marks, all caps, slang, idioms, and “click here.”
- Dates, times, currency, grade/class names, and IDs use locale-aware formatting and direction isolation.

## UI copy examples

| Surface | Good English | Bad English | Good Arabic | Bad Arabic |
|---|---|---|---|---|
| Button | Submit attendance | OK | إرسال الحضور | موافق |
| Label | Guardian phone number | Phone data | رقم هاتف ولي الأمر | بيانات الهاتف |
| Menu | Archive student record | Do stuff | أرشفة سجل الطالب | تنفيذ |
| Navigation | Fee collection | Money | تحصيل الرسوم | المال |
| Table header | Outstanding balance | Amount thing | الرصيد المستحق | المبلغ |
| Filter | Attendance status | Choose option | حالة الحضور | اختر |
| Form help | Use the student’s legal name. | Enter correctly. | استخدم الاسم الرسمي للطالب. | أدخل بشكل صحيح. |
| Notification | Write-off FIN-2041 needs approval. | Action required!!! | طلب شطب FIN-2041 يحتاج إلى موافقة. | مطلوب إجراء!!! |
| Toast | Attendance submitted for Grade 8A. | Done. | تم إرسال حضور الصف الثامن أ. | تم. |
| Alert | Payment recording is unavailable. Your draft is saved. | Something went wrong. | تعذر تسجيل الدفعة. تم حفظ المسودة. | حدث خطأ. |
| Error | Enter a date on or after 18 June. | Invalid date. | أدخل تاريخًا في ١٨ يونيو أو بعده. | تاريخ غير صالح. |
| Success | Receipt REC-882 is ready. | Great job! | الإيصال REC-882 جاهز. | عمل رائع! |
| Warning | This will notify 1,242 parents. Review the audience first. | Be careful. | سيتم إشعار ١٬٢٤٢ ولي أمر. راجع الجمهور أولًا. | انتبه. |
| Empty state | No invoices match these filters. Clear status filters. | Nothing here. | لا توجد فواتير تطابق عوامل التصفية. امسح تصفية الحالة. | لا يوجد شيء. |
| Loading | Loading student records… | Please wait… | جارٍ تحميل سجلات الطلاب… | انتظر… |
| Confirmation | Archive Lina Haddad’s record? This removes it from active lists. | Are you sure? | هل تريد أرشفة سجل لينا حداد؟ سيُزال من القوائم النشطة. | هل أنت متأكد؟ |
| Email subject | Attendance confirmation needed for Lina Haddad | Urgent!!! | مطلوب تأكيد حضور لينا حداد | عاجل!!! |
| SMS | Munaxa: Lina was marked absent today. Confirm: [secure link] | Lina absent. Click. | مناخا: سُجل غياب لينا اليوم. للتأكيد: [رابط آمن] | لينا غائبة. اضغط. |
| Push | Attendance confirmation needed | Important school info | مطلوب تأكيد الحضور | معلومات مهمة |
| Search empty | No authorized records match “MUN-2048”. | Zero results. | لا توجد سجلات مصرح بها تطابق «MUN-2048». | صفر نتائج. |

## Terminology standards

| Preferred | Avoid | Reason |
|---|---|---|
| Student record | Profile/card when referring to the legal record | Record communicates persistence and governance |
| Guardian | Contact person / parent when relationship may differ | Accurate relationship |
| Attendance register | Sheet | Operationally precise |
| Invoice / payment / receipt | Fee item / transaction interchangeably | Distinct finance states |
| School / campus | Branch unless legally defined | Prevent context ambiguity |
| Academic year / term | Period | Domain specificity |
| Archive | Delete for retained records | Reflects retention |
| Sign in | Log in/login as a verb | Consistent action |

Arabic terminology is maintained in a reviewed termbase, not generated per screen. A term has preferred English, preferred Arabic, definition, domain, forbidden synonyms, grammar notes, owner, and review date.

## Naming conventions

Navigation uses domain nouns. Page titles identify record or task. Buttons use verb + object. Statuses use stable lifecycle terms. Notifications use a safe subject + consequence. File/export names include report, scope, period, and generated date.

## Content patterns

### Forms

Labels remain visible. Help explains why/format, placeholder demonstrates only when useful, and error follows the field. Required state is explicit in text/semantics. Never use placeholder as label.

### Notifications and external channels

Toast is transient current-action feedback. Inbox is durable. Email carries summary and secure deep link. SMS/push uses minimal privacy-safe content. Match urgency, consent, quiet hours, and verified channel.

### Empty/loading/error

Distinguish first-use, no-results, permission, and unavailable states. Loading copy names the object. Errors retain input, state recovery, and provide reference ID for support when needed.

## Accessibility

Use plain language, meaningful link text, programmatic labels, live-region-safe messages, and instructions that do not depend on position, shape, color, or sound. Avoid reading duplicate toast/title content.

## RTL considerations

Arabic is authored, not mechanically reversed. Use Arabic punctuation and plural rules. Isolate IDs, emails, phone numbers, URLs, amounts, and mixed content. Do not concatenate translated fragments.

## Do / Don’t

Do identify scope and consequence, use domain terms, keep external previews safe, and test translations in layout. Don’t expose internal error codes alone, use “please” repeatedly, anthropomorphize the system, blame users, or translate record IDs.

## Enterprise best practices

Maintain a governed termbase, reusable message catalog, translation memory, content linting, reading-level checks, privacy classification, and named content owner. Version copy that changes legal, financial, consent, or workflow meaning.

## Implementation notes

Store messages by stable localization keys with ICU-style plural/select formatting. Components accept content through typed props; do not hard-code business messages in generic primitives. Log notification templates and approval-copy versions for audit.

