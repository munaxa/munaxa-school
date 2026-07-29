'use client';

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { useI18n } from './i18n-provider';
import {
  fullNameEn,
  fullNameAr,
  studentsApi,
  teachersApi,
  employeesApi,
  type Student,
  type Teacher,
  type Employee,
} from '@/lib/people';
import type { Principal } from '@/lib/auth';

type Hit = {
  type: 'student' | 'teacher' | 'employee';
  id: string;
  label: string;
  sub?: string | undefined;
};

const ROUTE: Record<Hit['type'], string> = {
  student: '/people/students',
  teacher: '/people/teachers',
  employee: '/people/employees',
};

/**
 * Global command-palette search. Searches across the entities the signed-in user is permitted to
 * see (permission pre-filtered, per the DS Search UX rules — never query an entity the role can't
 * access), reusing the existing list APIs (no new endpoints). Selecting a hit navigates to that
 * module. Opens via the header button or ⌘K / Ctrl-K; full keyboard + screen-reader support.
 */
export function GlobalSearch({
  open,
  onClose,
  principal,
}: {
  open: boolean;
  onClose: () => void;
  principal: Principal;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [active, setActive] = useState(0);
  const [busy, setBusy] = useState(false);

  const held = new Set(principal.permissions);
  const can = (perm: string) => held.has(perm) || held.has('*');
  // Cache the all-rows lists (teachers/employees have no server search) for the session of the palette.
  const cache = useRef<{ teachers?: Teacher[]; employees?: Employee[] }>({});

  const run = useCallback(
    async (q: string) => {
      const term = q.trim();
      if (!term) {
        setHits([]);
        return;
      }
      setBusy(true);
      const lower = term.toLowerCase();
      const out: Hit[] = [];
      try {
        if (can('student:manage')) {
          const students = await studentsApi.list(term).catch(() => [] as Student[]);
          for (const s of students.slice(0, 6)) {
            out.push({
              type: 'student',
              id: s.id,
              label: fullNameEn(s),
              sub: s.moeStudentNumber || fullNameAr(s),
            });
          }
        }
        if (can('teacher:manage')) {
          cache.current.teachers ??= await teachersApi.list().catch(() => [] as Teacher[]);
          for (const tc of cache.current.teachers
            .filter((x) =>
              `${x.firstNameEn} ${x.lastNameEn} ${x.specialization ?? ''}`
                .toLowerCase()
                .includes(lower),
            )
            .slice(0, 6)) {
            out.push({
              type: 'teacher',
              id: tc.id,
              label: `${tc.firstNameEn} ${tc.lastNameEn}`,
              sub: tc.specialization ?? undefined,
            });
          }
        }
        if (can('employee:manage')) {
          cache.current.employees ??= await employeesApi.list().catch(() => [] as Employee[]);
          for (const e of cache.current.employees
            .filter((x) =>
              `${x.firstNameEn} ${x.lastNameEn} ${x.jobTitle}`.toLowerCase().includes(lower),
            )
            .slice(0, 6)) {
            out.push({
              type: 'employee',
              id: e.id,
              label: `${e.firstNameEn} ${e.lastNameEn}`,
              sub: e.jobTitle,
            });
          }
        }
      } finally {
        setBusy(false);
        setHits(out);
        setActive(0);
      }
    },
    [principal.permissions], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Debounce the search as the user types.
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => void run(query), 250);
    return () => clearTimeout(id);
  }, [query, open, run]);

  // Reset + focus on open; lock body scroll. Also close on Escape at the document level so the
  // shortcut works no matter where focus lands (input, an option button, or the backdrop).
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHits([]);
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusId = setTimeout(() => inputRef.current?.focus(), 0);
    const onEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onEsc);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(focusId);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, onClose]);

  function choose(hit: Hit) {
    onClose();
    // next typedRoutes: ROUTE values must be typed routes for `next build`; the cast is required
    // there even though local tooling sees them as plain strings.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    router.push(ROUTE[hit.type] as never);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, hits.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && hits[active]) {
      e.preventDefault();
      choose(hits[active]);
    }
  }

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-modal flex items-start justify-center p-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-sm" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('search.title')}
        className="relative z-modal w-full max-w-xl overflow-hidden rounded-xl border border-border bg-card shadow-card"
      >
        <div className="flex items-center border-b border-border">
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={hits.length > 0}
            aria-controls={listId}
            aria-autocomplete="list"
            value={query}
            placeholder={t('search.placeholder')}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full bg-transparent px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            title={t('common.close')}
            className="me-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <ul id={listId} role="listbox" className="max-h-[50vh] overflow-auto p-1">
          {query.trim() && !busy && hits.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">
              {t('search.noResults')}
            </li>
          ) : null}
          {hits.map((h, i) => (
            <li key={`${h.type}-${h.id}`}>
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(h)}
                className={
                  'flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-start text-sm ' +
                  (i === active
                    ? 'bg-secondary/80 text-foreground'
                    : 'text-foreground hover:bg-secondary/50')
                }
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{h.label}</span>
                  {h.sub ? (
                    <span className="block truncate text-xs text-muted-foreground">{h.sub}</span>
                  ) : null}
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {t(`search.type.${h.type}`)}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <div className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
          {t('search.hint')}
        </div>
      </div>
    </div>,
    document.body,
  );
}
