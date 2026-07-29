'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { changePassword } from '@/lib/auth';
import { clearPrincipalCache } from '@/lib/session';
import { isPasswordStrong, PASSWORD_RULES } from '@/lib/password-policy';
import { useI18n } from '@/components/i18n-provider';
import { Button, Card, CardContent, Field, Input } from '@axa/platform';

/**
 * Mandatory password-change / Force Password Change screen. Reached on first login with a
 * temporary password (mustChangePassword=true) — both the API (MustChangePasswordGuard) and the
 * Shell redirect lock the account here until a new password is set. Changing the password revokes
 * all sessions, so on success we clear the cached principal and send the user back to sign in.
 */
export default function ChangePasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');
  const [confirmPassword, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const strong = isPasswordStrong(newPassword);
  const matches = newPassword.length > 0 && newPassword === confirmPassword;
  const canSubmit = currentPassword.length > 0 && strong && matches && !loading;

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!strong) {
      setError(t('changePassword.policyError'));
      return;
    }
    if (!matches) {
      setError(t('changePassword.mismatch'));
      return;
    }
    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      // Sessions were revoked server-side; force a clean re-authentication.
      clearPrincipalCache();
      setDone(true);
      setTimeout(() => router.replace('/login'), 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="font-display text-2xl font-semibold">{t('changePassword.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('changePassword.subtitle')}</p>
        </div>

        <Card>
          <CardContent className="pt-6">
            {done ? (
              <p className="rounded-lg border border-border bg-muted/40 p-4 text-sm" role="status">
                {t('changePassword.success')}
              </p>
            ) : (
              <form onSubmit={(e) => void onSubmit(e)} className="space-y-5">
                <Field label={t('changePassword.currentPassword')} htmlFor="current">
                  <Input
                    id="current"
                    type="password"
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrent(e.target.value)}
                    autoComplete="current-password"
                  />
                </Field>
                <Field label={t('changePassword.newPassword')} htmlFor="new">
                  <Input
                    id="new"
                    type="password"
                    required
                    value={newPassword}
                    onChange={(e) => setNew(e.target.value)}
                    autoComplete="new-password"
                    aria-describedby="password-policy"
                  />
                </Field>
                <Field label={t('changePassword.confirmPassword')} htmlFor="confirm">
                  <Input
                    id="confirm"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirm(e.target.value)}
                    autoComplete="new-password"
                  />
                </Field>

                {/* Live policy checklist — mirrors the backend password policy. */}
                <ul id="password-policy" className="space-y-1 text-xs">
                  {PASSWORD_RULES.map((rule) => {
                    const ok = rule.test(newPassword);
                    return (
                      <li key={rule.key} className={ok ? 'text-success' : 'text-muted-foreground'}>
                        <span aria-hidden="true">{ok ? '✓' : '○'}</span>{' '}
                        {t(`passwordPolicy.${rule.key}`)}
                      </li>
                    );
                  })}
                  <li className={matches ? 'text-success' : 'text-muted-foreground'}>
                    <span aria-hidden="true">{matches ? '✓' : '○'}</span>{' '}
                    {t('passwordPolicy.match')}
                  </li>
                </ul>

                {error ? (
                  <p className="text-sm text-destructive" role="alert">
                    {error}
                  </p>
                ) : null}
                <Button type="submit" disabled={!canSubmit} className="w-full">
                  {loading ? t('common.saving') : t('changePassword.updatePassword')}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
