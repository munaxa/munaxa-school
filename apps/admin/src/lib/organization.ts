'use client';

import { authFetch } from './auth';

export type SchoolType =
  | 'PRIVATE'
  | 'INTERNATIONAL'
  | 'NATIONAL'
  | 'IB'
  | 'BRITISH'
  | 'AMERICAN'
  | 'OTHER';
export type HAlign = 'LEFT' | 'CENTER' | 'RIGHT';
export type PaperSize = 'A4' | 'LETTER' | 'LEGAL';
export type QrContent = 'DOCUMENT_NUMBER' | 'STUDENT_NUMBER' | 'VERIFICATION_URL' | 'CUSTOM_TEXT';
export type WatermarkSource = 'LOGO' | 'SCHOOL_NAME' | 'CONFIDENTIAL';
export type LogoVariant = 'PRIMARY' | 'DARK' | 'SMALL';

export type AssetSlot =
  | 'logo'
  | 'darkLogo'
  | 'smallLogo'
  | 'stamp'
  | 'signature'
  | 'banner'
  | 'pushIcon'
  | 'notificationImage';

export interface LogoVisibility {
  reports?: boolean;
  certificates?: boolean;
  studentCards?: boolean;
  parentPortal?: boolean;
  mobileApp?: boolean;
  login?: boolean;
}

export interface Watermark {
  source?: WatermarkSource;
  text?: string;
  opacity?: number;
  scale?: number;
  rotation?: number;
}

export interface DocumentMargins {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
}

export interface DocumentConfig {
  headerHtml?: string;
  headerAlign?: HAlign;
  footerHtml?: string;
  footerAlign?: HAlign;
  logoPosition?: HAlign;
  paperSize?: PaperSize;
  margins?: DocumentMargins;
  headerHeight?: number;
  footerHeight?: number;
  qrContent?: QrContent;
  qrCustomText?: string;
}

export interface SocialLinks {
  website?: string;
  facebook?: string;
  instagram?: string;
  linkedin?: string;
  youtube?: string;
  tiktok?: string;
  x?: string;
}

export interface GovId {
  label: string;
  value: string;
}

export interface OrganizationSettings {
  id: string;
  tenantId: string;

  // General
  nameEn: string | null;
  nameAr: string | null;
  legalName: string | null;
  shortName: string | null;
  schoolCode: string | null;
  ministryNumber: string | null;
  schoolType: SchoolType;
  motto: string | null;
  mission: string | null;
  vision: string | null;
  establishedYear: number | null;
  description: string | null;
  timezone: string;
  defaultLanguage: string;

  // Contact
  phone: string | null;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  website: string | null;
  country: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  building: string | null;
  postalCode: string | null;
  googleMapsUrl: string | null;
  latitude: string | number | null;
  longitude: string | number | null;
  emergencyContact: string | null;
  officeHours: string | null;

  // Branding
  logoEnabled: boolean;
  darkLogoEnabled: boolean;
  smallLogoEnabled: boolean;
  watermarkEnabled: boolean;
  stampEnabled: boolean;
  signatureEnabled: boolean;
  logoKey: string | null;
  darkLogoKey: string | null;
  smallLogoKey: string | null;
  stampKey: string | null;
  signatureKey: string | null;
  bannerKey: string | null;
  logoVisibility: LogoVisibility | null;
  watermark: Watermark | null;
  stampPlacement: HAlign;
  signaturePosition: HAlign;

  // Documents
  headerEnabled: boolean;
  footerEnabled: boolean;
  qrEnabled: boolean;
  documents: DocumentConfig | null;

  // Communication
  senderName: string | null;
  senderEmail: string | null;
  replyToEmail: string | null;
  emailFooter: string | null;
  notificationDisplayName: string | null;
  smsSender: string | null;
  whatsappDisplayName: string | null;
  pushIconKey: string | null;
  notificationImageKey: string | null;

  // Social
  socialEnabled: boolean;
  social: SocialLinks | null;

  // Academic
  curriculum: string | null;
  academicYearFormat: string | null;
  colorTheme: string | null;

  // Compliance
  complianceEnabled: boolean;
  commercialRegistration: string | null;
  licenseNumber: string | null;
  ministryLicense: string | null;
  taxNumber: string | null;
  vatNumber: string | null;
  otherGovIds: GovId[] | null;

  // Advanced
  defaultReportLanguage: string;
  defaultCertificateLanguage: string;
  documentNumberPrefix: string | null;
  defaultFont: string | null;
  defaultReportTheme: string | null;
  defaultLogoVariant: LogoVariant;
  documentCompression: boolean;
  pdfQuality: number;
  imageQuality: number;
  storageOptimization: boolean;

  // Signed asset download URLs (server-resolved)
  assetUrls: Partial<Record<AssetSlot, string>>;
}

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string | string[] };
    const message = Array.isArray(body.message) ? body.message.join(', ') : body.message;
    throw new Error(message ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

function put<T>(path: string, data: unknown): Promise<T> {
  return authFetch(`/organization/${path}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  }).then((r) => json<T>(r));
}

/** Branding images accepted by the API (SVG widened for vector logos). */
export const ACCEPTED_IMAGE_TYPES = ['image/svg+xml', 'image/png', 'image/jpeg', 'image/webp'];
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export const organizationApi = {
  get: () => authFetch('/organization').then((r) => json<OrganizationSettings>(r)),

  general: (data: Record<string, unknown>) => put<OrganizationSettings>('general', data),
  contact: (data: Record<string, unknown>) => put<OrganizationSettings>('contact', data),
  branding: (data: Record<string, unknown>) => put<OrganizationSettings>('branding', data),
  documents: (data: Record<string, unknown>) => put<OrganizationSettings>('documents', data),
  communication: (data: Record<string, unknown>) =>
    put<OrganizationSettings>('communication', data),
  social: (data: Record<string, unknown>) => put<OrganizationSettings>('social', data),
  academic: (data: Record<string, unknown>) => put<OrganizationSettings>('academic', data),
  compliance: (data: Record<string, unknown>) => put<OrganizationSettings>('compliance', data),
  advanced: (data: Record<string, unknown>) => put<OrganizationSettings>('advanced', data),

  /** Two-step upload: presign → PUT to storage → confirm the key onto its slot. */
  async uploadAsset(slot: AssetSlot, file: File): Promise<OrganizationSettings> {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      throw new Error('Unsupported image type. Use SVG, PNG, JPG, or WEBP.');
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('Image exceeds the maximum allowed size (5 MB).');
    }
    const { uploadUrl, fileKey } = await authFetch('/organization/assets/presign', {
      method: 'POST',
      body: JSON.stringify({
        slot,
        fileName: file.name,
        contentType: file.type,
        size: file.size,
      }),
    }).then((r) => json<{ uploadUrl: string; fileKey: string }>(r));

    const putRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!putRes.ok) throw new Error(`Upload failed (${putRes.status})`);

    return authFetch('/organization/assets/confirm', {
      method: 'POST',
      body: JSON.stringify({ slot, fileKey, contentType: file.type, size: file.size }),
    }).then((r) => json<OrganizationSettings>(r));
  },

  removeAsset: (slot: AssetSlot) =>
    authFetch(`/organization/assets/${slot}`, { method: 'DELETE' }).then((r) =>
      json<OrganizationSettings>(r),
    ),
};
