'use client';

/**
 * Session-only demo data store. The working dataset is a deep clone of the immutable
 * baseline held entirely in React runtime state (browser memory). EVERY mutation —
 * create / edit / delete students, attendance, invoices, announcements, etc. — changes
 * only this in-memory copy. Nothing is ever persisted, so the data resets to the
 * original seeded state on logout, browser close, session expiry, refresh and restart.
 */
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';
import { Spinner } from '@axa/platform';
import { cloneBaseline } from '@/seed';
import type {
  Baseline,
  Student,
  AttendanceRecord,
  Invoice,
  Payment,
  Announcement,
  SchoolEvent,
  AdmissionApplication,
  OutboxMessage,
  Notification,
  GradeRecord,
} from '@/seed/types';
import { mockIntegrations, type Channel } from '@/lib/mock-integrations';

let counter = 0;
function id(prefix: string): string {
  counter += 1;
  return `${prefix}-x${Date.now().toString(36)}${counter}`;
}

type Action =
  | { type: 'RESET' }
  | { type: 'ADD_STUDENT'; student: Student }
  | { type: 'UPDATE_STUDENT'; id: string; patch: Partial<Student> }
  | { type: 'DELETE_STUDENT'; id: string }
  | { type: 'SET_ATTENDANCE'; records: AttendanceRecord[] }
  | { type: 'ADD_INVOICE'; invoice: Invoice }
  | { type: 'UPDATE_INVOICE'; id: string; patch: Partial<Invoice> }
  | { type: 'ADD_PAYMENT'; payment: Payment }
  | { type: 'ADD_ANNOUNCEMENT'; announcement: Announcement }
  | { type: 'ADD_EVENT'; event: SchoolEvent }
  | { type: 'UPDATE_ADMISSION'; id: string; stage: AdmissionApplication['stage'] }
  | { type: 'UPDATE_GRADE'; id: string; patch: Partial<GradeRecord> }
  | { type: 'RETURN_BOOK'; loanId: string }
  | { type: 'OUTBOX'; message: OutboxMessage }
  | { type: 'PUSH_NOTIFICATION'; notification: Notification }
  | { type: 'MARK_NOTIFICATIONS_READ' };

function reducer(state: Baseline | null, action: Action): Baseline | null {
  // The dataset is built client-side on mount; until then state is null.
  if (state === null) return action.type === 'RESET' ? cloneBaseline() : state;
  switch (action.type) {
    case 'RESET':
      return cloneBaseline();
    case 'ADD_STUDENT':
      return { ...state, students: [action.student, ...state.students] };
    case 'UPDATE_STUDENT':
      return {
        ...state,
        students: state.students.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case 'DELETE_STUDENT':
      return { ...state, students: state.students.filter((s) => s.id !== action.id) };
    case 'SET_ATTENDANCE': {
      const keys = new Set(action.records.map((r) => `${r.studentId}|${r.date}`));
      const kept = state.attendance.filter((r) => !keys.has(`${r.studentId}|${r.date}`));
      return { ...state, attendance: [...kept, ...action.records] };
    }
    case 'ADD_INVOICE':
      return { ...state, invoices: [action.invoice, ...state.invoices] };
    case 'UPDATE_INVOICE':
      return {
        ...state,
        invoices: state.invoices.map((i) => (i.id === action.id ? { ...i, ...action.patch } : i)),
      };
    case 'ADD_PAYMENT':
      return { ...state, payments: [action.payment, ...state.payments] };
    case 'ADD_ANNOUNCEMENT':
      return { ...state, announcements: [action.announcement, ...state.announcements] };
    case 'ADD_EVENT':
      return {
        ...state,
        events: [...state.events, action.event].sort((a, b) => a.date.localeCompare(b.date)),
      };
    case 'UPDATE_ADMISSION':
      return {
        ...state,
        admissions: state.admissions.map((a) =>
          a.id === action.id ? { ...a, stage: action.stage } : a,
        ),
      };
    case 'UPDATE_GRADE':
      return {
        ...state,
        grades_records: state.grades_records.map((g) =>
          g.id === action.id ? { ...g, ...action.patch } : g,
        ),
      };
    case 'RETURN_BOOK':
      return {
        ...state,
        loans: state.loans.map((l) =>
          l.id === action.loanId
            ? { ...l, status: 'RETURNED', returnedAt: new Date().toISOString().slice(0, 10) }
            : l,
        ),
        books: state.books.map((b) => {
          const loan = state.loans.find((l) => l.id === action.loanId);
          return loan && b.id === loan.bookId ? { ...b, available: b.available + 1 } : b;
        }),
      };
    case 'OUTBOX':
      return { ...state, outbox: [action.message, ...state.outbox].slice(0, 100) };
    case 'PUSH_NOTIFICATION':
      return { ...state, notifications: [action.notification, ...state.notifications] };
    case 'MARK_NOTIFICATIONS_READ':
      return { ...state, notifications: state.notifications.map((n) => ({ ...n, read: true })) };
    default:
      return state;
  }
}

export interface DemoActions {
  reset: () => void;
  addStudent: (s: Omit<Student, 'id'>) => Student;
  updateStudent: (id: string, patch: Partial<Student>) => void;
  deleteStudent: (id: string) => void;
  setAttendance: (records: Array<Omit<AttendanceRecord, 'id'>>) => void;
  addInvoice: (i: Omit<Invoice, 'id'>) => Invoice;
  updateInvoice: (id: string, patch: Partial<Invoice>) => void;
  recordPayment: (
    invoiceId: string,
    studentId: string,
    amount: number,
    method: Payment['method'],
  ) => void;
  addAnnouncement: (a: Omit<Announcement, 'id'>) => void;
  addEvent: (e: Omit<SchoolEvent, 'id'>) => void;
  setAdmissionStage: (id: string, stage: AdmissionApplication['stage']) => void;
  updateGrade: (id: string, patch: Partial<GradeRecord>) => void;
  returnBook: (loanId: string) => void;
  markNotificationsRead: () => void;
  /** Record a mocked external send (email/sms/whatsapp/push/jofotara/payment). */
  mockSend: (channel: Channel, to: string, summary: string) => void;
}

interface DemoContextValue {
  data: Baseline;
  actions: DemoActions;
}

const DemoContext = createContext<DemoContextValue | null>(null);

export function useDemo(): DemoContextValue {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error('useDemo must be used within <DemoDataProvider>');
  return ctx;
}

export function DemoDataProvider({ children }: { children: ReactNode }) {
  // Initialised to null and built on the client only — keeps the heavy, date-based
  // generation off the server and avoids any SSR/CSR hydration mismatch.
  const [data, dispatch] = useReducer(reducer, null);

  useEffect(() => {
    if (!data) dispatch({ type: 'RESET' });
  }, [data]);

  const actions = useMemo<DemoActions>(() => {
    const channelLabel: Record<Channel, Notification['tone']> = {
      EMAIL: 'default',
      SMS: 'default',
      WHATSAPP: 'success',
      PUSH: 'default',
      JOFOTARA: 'success',
      PAYMENT: 'success',
    };
    return {
      reset: () => dispatch({ type: 'RESET' }),
      addStudent: (s) => {
        const student: Student = { ...s, id: id('student') };
        dispatch({ type: 'ADD_STUDENT', student });
        return student;
      },
      updateStudent: (sid, patch) => dispatch({ type: 'UPDATE_STUDENT', id: sid, patch }),
      deleteStudent: (sid) => dispatch({ type: 'DELETE_STUDENT', id: sid }),
      setAttendance: (records) =>
        dispatch({
          type: 'SET_ATTENDANCE',
          records: records.map((r) => ({ ...r, id: id('att') })),
        }),
      addInvoice: (i) => {
        const invoice: Invoice = { ...i, id: id('inv') };
        dispatch({ type: 'ADD_INVOICE', invoice });
        return invoice;
      },
      updateInvoice: (iid, patch) => dispatch({ type: 'UPDATE_INVOICE', id: iid, patch }),
      recordPayment: (invoiceId, studentId, amount, method) => {
        const payment: Payment = {
          id: id('pay'),
          invoiceId,
          studentId,
          amount,
          method,
          paidAt: new Date().toISOString().slice(0, 10),
          reference: `RCPT-${Math.floor(Math.random() * 1e6)}`,
        };
        dispatch({ type: 'ADD_PAYMENT', payment });
      },
      addAnnouncement: (a) =>
        dispatch({ type: 'ADD_ANNOUNCEMENT', announcement: { ...a, id: id('ann') } }),
      addEvent: (e) => dispatch({ type: 'ADD_EVENT', event: { ...e, id: id('ev') } }),
      setAdmissionStage: (aid, stage) => dispatch({ type: 'UPDATE_ADMISSION', id: aid, stage }),
      updateGrade: (gid, patch) => dispatch({ type: 'UPDATE_GRADE', id: gid, patch }),
      returnBook: (loanId) => dispatch({ type: 'RETURN_BOOK', loanId }),
      markNotificationsRead: () => dispatch({ type: 'MARK_NOTIFICATIONS_READ' }),
      mockSend: (channel, to, summary) => {
        // Route through the pure mock so the "integration" is exercised, then log it.
        const fn =
          channel === 'EMAIL'
            ? mockIntegrations.email
            : channel === 'SMS'
              ? mockIntegrations.sms
              : channel === 'WHATSAPP'
                ? mockIntegrations.whatsapp
                : channel === 'PUSH'
                  ? mockIntegrations.push
                  : channel === 'JOFOTARA'
                    ? mockIntegrations.jofotara
                    : mockIntegrations.payment;
        const result = (fn as (a: string, b: string) => { reference: string })(to, summary);
        dispatch({
          type: 'OUTBOX',
          message: {
            id: id('out'),
            channel,
            to,
            summary,
            at: new Date().toISOString(),
            status: 'MOCKED',
          },
        });
        dispatch({
          type: 'PUSH_NOTIFICATION',
          notification: {
            id: id('ntf'),
            titleEn: `${channel} sent (mock)`,
            titleAr: 'تم الإرسال (محاكاة)',
            body: `${summary} · ${result.reference}`,
            at: new Date().toISOString(),
            read: false,
            tone: channelLabel[channel],
          },
        });
      },
    };
  }, []);

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Spinner /> Preparing the Munaxa Academy demo…
      </div>
    );
  }

  return <DemoContext.Provider value={{ data, actions }}>{children}</DemoContext.Provider>;
}
