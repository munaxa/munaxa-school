'use client';

import { useI18n } from '@/components/i18n-provider';
import {
  bankAccountsApi,
  certificatesApi,
  dependentsApi,
  educationApi,
  emergencyContactsApi,
  DEPENDENT_RELATIONS,
  type BankAccount,
  type Certificate,
  type Dependent,
  type EmergencyContact,
  type EmployeeEducation,
} from '@/lib/people';
import { CrudList } from './crud-list';

type Props = { employeeId: string; canManage: boolean };

export function EmergencyContactsCard({ employeeId, canManage }: Props) {
  const { t } = useI18n();
  return (
    <CrudList<EmergencyContact>
      title={t('hr.emergencyContacts')}
      employeeId={employeeId}
      canManage={canManage}
      api={emergencyContactsApi}
      fields={[
        { key: 'name', label: t('common.name'), required: true },
        { key: 'relation', label: t('hr.relation'), required: true },
        { key: 'phone', label: t('people.phone'), required: true },
        { key: 'phoneAlt', label: t('hr.phoneAlt') },
        { key: 'email', label: t('hr.personalEmail'), type: 'email' },
        { key: 'address', label: t('hr.address') },
        { key: 'isPrimary', label: t('hr.primary'), type: 'checkbox' },
      ]}
      columns={[
        { label: 'name', render: (r) => r.name },
        { label: 'relation', render: (r) => r.relation },
        { label: 'phone', render: (r) => r.phone },
      ]}
      toForm={(r) => ({
        name: r.name,
        relation: r.relation,
        phone: r.phone,
        phoneAlt: r.phoneAlt ?? '',
        email: r.email ?? '',
        address: r.address ?? '',
        isPrimary: r.isPrimary,
      })}
    />
  );
}

export function DependentsCard({ employeeId, canManage }: Props) {
  const { t } = useI18n();
  return (
    <CrudList<Dependent>
      title={t('hr.dependents')}
      employeeId={employeeId}
      canManage={canManage}
      api={dependentsApi}
      fields={[
        { key: 'name', label: t('common.name'), required: true },
        {
          key: 'relation',
          label: t('hr.relation'),
          type: 'select',
          required: true,
          options: DEPENDENT_RELATIONS.map((r) => ({
            value: r,
            label: t(`hr.dependentRelation.${r}`),
          })),
        },
        { key: 'dateOfBirth', label: t('hr.dob'), type: 'date' },
        {
          key: 'gender',
          label: t('people.gender'),
          type: 'select',
          options: [
            { value: 'MALE', label: t('people.male') },
            { value: 'FEMALE', label: t('people.female') },
          ],
        },
        { key: 'nationalId', label: t('people.nationalId') },
        { key: 'notes', label: t('common.reason') },
      ]}
      columns={[
        { label: 'name', render: (r) => r.name },
        { label: 'relation', render: (r) => t(`hr.dependentRelation.${r.relation}`) },
      ]}
      toForm={(r) => ({
        name: r.name,
        relation: r.relation,
        dateOfBirth: (r.dateOfBirth ?? '').slice(0, 10),
        gender: r.gender ?? '',
        nationalId: r.nationalId ?? '',
        notes: r.notes ?? '',
      })}
    />
  );
}

export function EducationCard({ employeeId, canManage }: Props) {
  const { t } = useI18n();
  return (
    <CrudList<EmployeeEducation>
      title={t('hr.education')}
      employeeId={employeeId}
      canManage={canManage}
      api={educationApi}
      fields={[
        { key: 'institution', label: t('hr.institution'), required: true },
        { key: 'degree', label: t('hr.degree'), required: true },
        { key: 'fieldOfStudy', label: t('hr.fieldOfStudy') },
        { key: 'startYear', label: t('hr.startYear'), type: 'number' },
        { key: 'endYear', label: t('hr.endYear'), type: 'number' },
        { key: 'grade', label: t('hr.grade') },
      ]}
      columns={[
        { label: 'degree', render: (r) => `${r.degree}` },
        { label: 'institution', render: (r) => r.institution },
        { label: 'year', render: (r) => (r.endYear ? String(r.endYear) : '') },
      ]}
      toForm={(r) => ({
        institution: r.institution,
        degree: r.degree,
        fieldOfStudy: r.fieldOfStudy ?? '',
        startYear: r.startYear != null ? String(r.startYear) : '',
        endYear: r.endYear != null ? String(r.endYear) : '',
        grade: r.grade ?? '',
      })}
    />
  );
}

export function CertificatesCard({ employeeId, canManage }: Props) {
  const { t } = useI18n();
  return (
    <CrudList<Certificate>
      title={t('hr.certificates')}
      employeeId={employeeId}
      canManage={canManage}
      api={certificatesApi}
      fields={[
        { key: 'name', label: t('common.name'), required: true },
        { key: 'issuingBody', label: t('hr.issuingBody') },
        { key: 'issueDate', label: t('hr.issueDate'), type: 'date' },
        { key: 'expiryDate', label: t('hr.expiryDate'), type: 'date' },
        { key: 'credentialId', label: t('hr.credentialId') },
      ]}
      columns={[
        { label: 'name', render: (r) => r.name },
        { label: 'body', render: (r) => r.issuingBody ?? '' },
      ]}
      toForm={(r) => ({
        name: r.name,
        issuingBody: r.issuingBody ?? '',
        issueDate: (r.issueDate ?? '').slice(0, 10),
        expiryDate: (r.expiryDate ?? '').slice(0, 10),
        credentialId: r.credentialId ?? '',
      })}
    />
  );
}

export function BankAccountsCard({ employeeId, canManage }: Props) {
  const { t } = useI18n();
  return (
    <CrudList<BankAccount>
      title={t('hr.bankAccounts')}
      employeeId={employeeId}
      canManage={canManage}
      api={bankAccountsApi}
      fields={[
        { key: 'bankName', label: t('hr.bankName'), required: true },
        { key: 'accountName', label: t('hr.accountName') },
        { key: 'accountNumber', label: t('hr.accountNumber') },
        { key: 'iban', label: t('hr.iban') },
        { key: 'swift', label: t('hr.swift') },
        { key: 'currency', label: t('hr.currency') },
        { key: 'isPrimary', label: t('hr.primary'), type: 'checkbox' },
      ]}
      columns={[
        { label: 'bank', render: (r) => r.bankName },
        { label: 'iban', render: (r) => r.iban ?? r.accountNumber ?? '' },
      ]}
      toForm={(r) => ({
        bankName: r.bankName,
        accountName: r.accountName ?? '',
        accountNumber: r.accountNumber ?? '',
        iban: r.iban ?? '',
        swift: r.swift ?? '',
        currency: r.currency ?? '',
        isPrimary: r.isPrimary,
      })}
    />
  );
}
