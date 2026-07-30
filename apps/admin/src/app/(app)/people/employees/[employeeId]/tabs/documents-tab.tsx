'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/i18n-provider';
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  DatePicker,
  Field,
  Input,
  Select,
  useToast,
} from '@axa/platform';
import { useConfirm } from '@/components/confirm';
import {
  employeeDocumentsApi,
  EMPLOYEE_DOCUMENT_TYPES,
  type EmployeeDocument,
  type EmployeeDocumentType,
} from '@/lib/people';

export function DocumentsTab({
  employeeId,
  canManage,
}: {
  employeeId: string;
  canManage: boolean;
}) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [docs, setDocs] = useState<EmployeeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<EmployeeDocumentType>('CONTRACT');
  const [title, setTitle] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    try {
      setDocs(await employeeDocumentsApi.list(employeeId));
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(file: File) {
    setUploading(true);
    try {
      const { uploadUrl, fileKey } = await employeeDocumentsApi.presign(employeeId, {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
      });
      const put = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await employeeDocumentsApi.create(employeeId, {
        type,
        title: title.trim() || file.name,
        fileKey,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        size: file.size,
        ...(expiryDate ? { expiryDate } : {}),
      });
      toast.success(t('hr.documentUploaded'));
      setTitle('');
      setExpiryDate('');
      if (fileRef.current) fileRef.current.value = '';
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function download(doc: EmployeeDocument) {
    try {
      const { url } = await employeeDocumentsApi.downloadUrl(employeeId, doc.id);
      window.open(url, '_blank', 'noopener');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Download failed');
    }
  }

  async function remove(doc: EmployeeDocument) {
    if (!(await confirm())) return;
    try {
      await employeeDocumentsApi.remove(employeeId, doc.id);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('hr.documents')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {canManage ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <Field label={t('hr.documentType')}>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as EmployeeDocumentType)}
              >
                {EMPLOYEE_DOCUMENT_TYPES.map((d) => (
                  <option key={d} value={d}>
                    {t(`hr.docType.${d}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('hr.documentTitle')}>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('hr.documentTitle')}
              />
            </Field>
            <Field label={t('hr.expiryDate')}>
              <DatePicker value={expiryDate} onChange={(value) => setExpiryDate(value)} />
            </Field>
            <Field label={t('hr.file')}>
              <input
                ref={fileRef}
                type="file"
                className="text-sm"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void upload(f);
                }}
              />
            </Field>
            {uploading ? (
              <p className="col-span-full text-xs text-muted-foreground">{t('hr.uploading')}</p>
            ) : null}
          </div>
        ) : null}

        {loading ? (
          <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('hr.noDocuments')}</p>
        ) : (
          <ul className="divide-y divide-border">
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                <div className="min-w-0 text-sm">
                  <span className="font-medium">{doc.title}</span>
                  <Badge tone="muted" className="ms-2">
                    {t(`hr.docType.${doc.type}`)}
                  </Badge>
                  {doc.version > 1 ? (
                    <span className="ms-1 text-xs text-muted-foreground">v{doc.version}</span>
                  ) : null}
                  <span className="block text-xs text-muted-foreground">
                    {doc.fileName}
                    {doc.expiryDate ? ` · ${t('hr.expires')}: ${doc.expiryDate.slice(0, 10)}` : ''}
                  </span>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" onClick={() => void download(doc)}>
                    {t('hr.download')}
                  </Button>
                  {canManage ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => void remove(doc)}
                    >
                      {t('common.delete')}
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
