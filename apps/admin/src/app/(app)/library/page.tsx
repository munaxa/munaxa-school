'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Shell } from '@/components/shell';
import { useI18n } from '@/components/i18n-provider';
import {
  libraryApi,
  type Book,
  type BookLoan,
  type CheckoutInput,
  type CreateBookInput,
} from '@/lib/advanced';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Select,
  Table,
  TBody,
  TD,
  TH,
  THead,
  TR,
  EmptyState,
} from '@axa/platform';
import { LoanStatusBadge } from '@/components/domain';

export default function LibraryPage() {
  const { t } = useI18n();
  const [books, setBooks] = useState<Book[]>([]);
  const [loans, setLoans] = useState<BookLoan[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [b, l] = await Promise.all([libraryApi.books(), libraryApi.loans()]);
      setBooks(b);
      setLoans(l);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load library');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const titleById = useMemo(() => {
    const map = new Map<string, string>();
    for (const b of books) map.set(b.id, b.title);
    return map;
  }, [books]);

  async function returnLoan(id: string) {
    try {
      await libraryApi.returnLoan(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Return failed');
    }
  }

  if (loading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t('common.loading')}</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-6">
        <h1 className="font-display text-2xl font-semibold">{t('nav.library')}</h1>
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{t('library.catalogueBook')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CreateBook onDone={load} onError={setError} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>{t('library.checkoutBook')}</CardTitle>
            </CardHeader>
            <CardContent>
              <Checkout books={books} onDone={load} onError={setError} />
            </CardContent>
          </Card>
        </div>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-medium">{t('library.catalogue')}</h2>
          <Table>
            <THead>
              <TR>
                <TH>{t('library.title')}</TH>
                <TH>{t('library.author')}</TH>
                <TH>{t('library.category')}</TH>
                <TH className="text-end">{t('library.available')}</TH>
              </TR>
            </THead>
            <TBody>
              {books.map((b) => (
                <TR key={b.id}>
                  <TD>{b.title}</TD>
                  <TD>{b.author || '—'}</TD>
                  <TD>{b.category || '—'}</TD>
                  <TD className="text-end font-mono text-xs">
                    {b.copiesAvailable}/{b.copiesTotal}
                  </TD>
                </TR>
              ))}
              {books.length === 0 ? (
                <TR>
                  <TD colSpan={4}>
                    <EmptyState title={t('library.noBooks')} />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </section>

        <section className="space-y-2">
          <h2 className="font-display text-lg font-medium">{t('library.loans')}</h2>
          <Table>
            <THead>
              <TR>
                <TH>{t('library.book')}</TH>
                <TH>{t('library.borrower')}</TH>
                <TH>{t('library.due')}</TH>
                <TH>{t('common.status')}</TH>
                <TH className="text-end">{t('common.actions')}</TH>
              </TR>
            </THead>
            <TBody>
              {loans.map((l) => (
                <TR key={l.id}>
                  <TD>{titleById.get(l.bookId) ?? '—'}</TD>
                  <TD>{l.borrowerName || l.studentId || '—'}</TD>
                  <TD className="font-mono text-xs">{l.dueDate.slice(0, 10)}</TD>
                  <TD>
                    <LoanStatusBadge status={l.status} />
                  </TD>
                  <TD className="text-end">
                    {l.status !== 'RETURNED' ? (
                      <Button variant="ghost" size="sm" onClick={() => void returnLoan(l.id)}>
                        {t('library.return')}
                      </Button>
                    ) : null}
                  </TD>
                </TR>
              ))}
              {loans.length === 0 ? (
                <TR>
                  <TD colSpan={5}>
                    <EmptyState title={t('library.noLoans')} />
                  </TD>
                </TR>
              ) : null}
            </TBody>
          </Table>
        </section>
      </div>
    </Shell>
  );
}

function CreateBook({
  onDone,
  onError,
}: {
  onDone: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({ title: '', author: '', category: '', copiesTotal: '1' });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: CreateBookInput = {
        title: form.title,
        copiesTotal: Number(form.copiesTotal) || 1,
      };
      if (form.author) payload.author = form.author;
      if (form.category) payload.category = form.category;
      await libraryApi.createBook(payload);
      setForm({ title: '', author: '', category: '', copiesTotal: '1' });
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2 sm:grid-cols-2">
      <Field className="sm:col-span-2" label={t('library.title')} htmlFor="book-title">
        <Input
          id="book-title"
          placeholder={t('library.title')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          required
        />
      </Field>
      <Field label={t('library.author')} htmlFor="book-author">
        <Input
          id="book-author"
          placeholder={t('library.author')}
          value={form.author}
          onChange={(e) => setForm({ ...form, author: e.target.value })}
        />
      </Field>
      <Field label={t('library.category')} htmlFor="book-category">
        <Input
          id="book-category"
          placeholder={t('library.category')}
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
      </Field>
      <Field label={t('library.copies')} htmlFor="book-copies">
        <Input
          id="book-copies"
          type="number"
          min={1}
          placeholder={t('library.copies')}
          value={form.copiesTotal}
          onChange={(e) => setForm({ ...form, copiesTotal: e.target.value })}
        />
      </Field>
      <Button type="submit" className="sm:col-span-2" disabled={busy}>
        {busy ? t('common.saving') : t('library.addBook')}
      </Button>
    </form>
  );
}

function Checkout({
  books,
  onDone,
  onError,
}: {
  books: Book[];
  onDone: () => Promise<void>;
  onError: (m: string) => void;
}) {
  const { t } = useI18n();
  const [bookId, setBookId] = useState('');
  const [borrowerName, setBorrowerName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload: CheckoutInput = { bookId, dueDate };
      if (borrowerName) payload.borrowerName = borrowerName;
      await libraryApi.checkout(payload);
      setBookId('');
      setBorrowerName('');
      setDueDate('');
      await onDone();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Checkout failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2">
      <Field label={t('library.book')} htmlFor="checkout-book">
        <Select
          id="checkout-book"
          value={bookId}
          onChange={(e) => setBookId(e.target.value)}
          required
        >
          <option value="" disabled>
            {t('library.selectBook')}
          </option>
          {books
            .filter((b) => b.copiesAvailable > 0)
            .map((b) => (
              <option key={b.id} value={b.id}>
                {b.title} ({b.copiesAvailable} {t('library.availableSuffix')})
              </option>
            ))}
        </Select>
      </Field>
      <Field label={t('library.borrowerName')} htmlFor="checkout-borrower">
        <Input
          id="checkout-borrower"
          placeholder={t('library.borrowerName')}
          value={borrowerName}
          onChange={(e) => setBorrowerName(e.target.value)}
          required
        />
      </Field>
      <Field label={t('library.due')} htmlFor="checkout-due">
        <Input
          id="checkout-due"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          required
          dir="ltr"
        />
      </Field>
      <Button type="submit" disabled={busy}>
        {busy ? t('library.checkingOut') : t('library.checkout')}
      </Button>
    </form>
  );
}
