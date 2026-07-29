'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useI18n } from './i18n-provider';
import { Button } from '@axa/platform';

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as a destructive action (default: true). */
  destructive?: boolean;
}

interface AlertOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
}

type ConfirmFn = (opts?: ConfirmOptions) => Promise<boolean>;
type AlertFn = (opts?: AlertOptions) => Promise<void>;

interface DialogApi {
  confirm: ConfirmFn;
  alert: AlertFn;
}

const DialogContext = createContext<DialogApi | null>(null);

interface DialogState {
  mode: 'confirm' | 'alert';
  opts: ConfirmOptions & AlertOptions;
}

/**
 * Returns an async `confirm(opts)` that opens a modal and resolves to `true` only when the user
 * accepts. Use it to guard destructive actions: `if (!(await confirm({ description }))) return;`.
 */
export function useConfirm(): ConfirmFn {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx.confirm;
}

/**
 * Returns an async `alert(opts)` that opens a modal with a single OK button — use it to surface an
 * error or notice the user must acknowledge (e.g. a duplicate ID on save).
 */
export function useAlert(): AlertFn {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useAlert must be used within <ConfirmProvider>');
  return ctx.alert;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const [state, setState] = useState<DialogState | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setState({ mode: 'confirm', opts: options ?? {} });
    });
  }, []);

  const alert = useCallback<AlertFn>((options) => {
    return new Promise<void>((resolve) => {
      resolverRef.current = () => resolve();
      setState({ mode: 'alert', opts: options ?? {} });
    });
  }, []);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  }, []);

  const api = useRef<DialogApi>({ confirm, alert });
  api.current = { confirm, alert };

  const isAlert = state?.mode === 'alert';
  const opts = state?.opts;
  const destructive = opts?.destructive ?? true;

  return (
    <DialogContext.Provider value={api.current}>
      {children}
      {state ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-foreground/40"
            onClick={() => close(false)}
            aria-hidden="true"
          />
          <div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-card">
            <h2 className="font-display text-lg font-semibold">
              {opts?.title ?? t(isAlert ? 'common.error' : 'common.confirmTitle')}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {opts?.description ?? (isAlert ? '' : t('common.confirmDeleteBody'))}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              {isAlert ? null : (
                <Button variant="outline" size="sm" onClick={() => close(false)}>
                  {opts?.cancelLabel ?? t('common.cancel')}
                </Button>
              )}
              <Button
                variant={isAlert ? 'default' : destructive ? 'destructive' : 'default'}
                size="sm"
                onClick={() => close(true)}
                autoFocus
              >
                {opts?.confirmLabel ?? t(isAlert ? 'common.ok' : 'common.delete')}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}
