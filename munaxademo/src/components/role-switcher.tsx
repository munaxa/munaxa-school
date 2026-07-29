'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '@/lib/session-context';
import { PERSONAS } from '@/lib/rbac';
import { Select } from '@axa/platform';

/** In-app persona switcher — explore the demo as any of the eight roles instantly. */
export function RoleSwitcher() {
  const { persona, setPersona, locale } = useSession();
  const router = useRouter();

  return (
    <Select
      aria-label="Switch role"
      value={persona.id}
      className="h-9 w-auto max-w-[12rem]"
      onChange={(e) => {
        const next = PERSONAS.find((p) => p.id === e.target.value);
        if (!next) return;
        setPersona(next.id);
        router.push(next.home as never);
      }}
    >
      {PERSONAS.map((p) => (
        <option key={p.id} value={p.id}>
          {locale === 'ar' ? p.nameAr : p.nameEn}
        </option>
      ))}
    </Select>
  );
}
