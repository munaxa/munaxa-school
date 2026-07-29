'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Button,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandPalette,
} from '@axa/platform';
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

const TYPES: Hit['type'][] = ['student', 'teacher', 'employee'];

/**
 * Global command-palette search. Searches across the entities the signed-in user is permitted to
 * see (permission pre-filtered — never query an entity the role can't access), reusing the existing
 * list APIs (no new endpoints). Selecting a hit navigates to that module. Opens via the header
 * button or ⌘K / Ctrl-K.
 *
 * The palette itself is `@axa/platform`'s `CommandPalette` — a `Command` inside the platform
 * `Dialog`. What remains here is the part that is genuinely School's: which entities this user may
 * search, how each list API is called, the session cache for the two lists with no server-side
 * search, and where a hit navigates to.
 *
 * The 130 lines of interaction that used to live here are gone, and with them four defects the
 * markup had:
 *
 * - **Invalid listbox semantics.** It rendered `<button role="option">` inside `<li>` inside a
 *   `<ul role="listbox">`. `role="listbox"` replaces the list's implicit role, orphaning every
 *   `<li>`, and an option may not contain a control — so assistive technology saw a listbox with no
 *   options in it. `cmdk` owns those semantics now.
 * - **No `aria-activedescendant`.** The arrow keys moved a visual highlight and `aria-selected`, but
 *   focus stayed in the input with nothing pointing at the active option, so a screen-reader user
 *   heard nothing as they moved through the results.
 * - **No focus trap.** Tab walked straight out of the modal into the page behind it.
 * - **No focus restoration.** Dismissing the palette dropped focus on `<body>`, so a keyboard user
 *   had to tab from the top of the page to get back to where they were.
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
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
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

  // Each opening starts from an empty palette rather than the previous session's results.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHits([]);
  }, [open]);

  function choose(hit: Hit) {
    onClose();
    // next typedRoutes: ROUTE values must be typed routes for `next build`; the cast is required
    // there even though local tooling sees them as plain strings.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
    router.push(ROUTE[hit.type] as never);
  }

  return (
    <CommandPalette
      open={open}
      onClose={onClose}
      title={t('search.title')}
      // Filtering is ours: students come back already matched by the server, and the other two are
      // filtered against the cached lists above. Leaving cmdk's filter on would match a second time
      // against the rendered labels and silently drop hits whose match was in a field we do not
      // render.
      shouldFilter={false}
    >
      <CommandInput value={query} onValueChange={setQuery} placeholder={t('search.placeholder')} />
      <CommandList>
        {query.trim() && !busy && hits.length === 0 ? (
          <CommandEmpty>{t('search.noResults')}</CommandEmpty>
        ) : null}
        {TYPES.map((type) => {
          const group = hits.filter((hit) => hit.type === type);
          if (group.length === 0) return null;
          return (
            <CommandGroup key={type} heading={t(`search.type.${type}`)}>
              {group.map((hit) => (
                <CommandItem
                  key={`${hit.type}-${hit.id}`}
                  value={`${hit.type}-${hit.id}`}
                  onSelect={() => choose(hit)}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{hit.label}</span>
                    {hit.sub ? (
                      <span className="block truncate text-xs text-muted-foreground">
                        {hit.sub}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t(`search.type.${hit.type}`)}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <span>{t('search.hint')}</span>
        {/* Escape closes the palette; the button keeps the same affordance the old markup had for
            anyone who reaches for a visible control rather than the key. */}
        <Button variant="ghost" size="sm" onClick={onClose}>
          {t('common.close')}
        </Button>
      </div>
    </CommandPalette>
  );
}
