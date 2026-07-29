import { Injectable, Logger } from '@nestjs/common';
import { OrganizationService } from '../organization/organization.service';
import { StorageService } from '../common/storage.service';
import type { BrandingContext } from './pdf/document-layout';

/**
 * Resolves the tenant's school branding (Part 7) into a {@link BrandingContext} for the PDF
 * renderer. Everything comes from the existing OrganizationSettings — nothing is hardcoded. Logo /
 * stamp / signature images are fetched best-effort (only when their toggle is on and object storage
 * is configured); any failure degrades gracefully to a text-only header so document generation never
 * fails because of a missing/unreachable asset.
 */
@Injectable()
export class BrandingService {
  private readonly logger = new Logger(BrandingService.name);

  constructor(
    private readonly organization: OrganizationService,
    private readonly storage: StorageService,
  ) {}

  async forTenant(): Promise<BrandingContext> {
    const o = await this.organization.get();
    const addressLines = [
      [o.building, o.street].filter(Boolean).join(' '),
      [o.district, o.city].filter(Boolean).join(', '),
      o.country ?? undefined,
    ].filter((s): s is string => Boolean(s && s.trim()));

    const footerNote =
      (o.footerEnabled &&
        this.stripHtml((o.documents as Record<string, unknown> | null)?.footerHtml)) ||
      o.emailFooter ||
      o.legalName ||
      o.nameEn ||
      'Munaxa School OS';

    const [logo, stamp, signature] = await Promise.all([
      o.logoEnabled ? this.imageBytes(o.logoKey) : Promise.resolve(undefined),
      o.stampEnabled ? this.imageBytes(o.stampKey) : Promise.resolve(undefined),
      o.signatureEnabled ? this.imageBytes(o.signatureKey) : Promise.resolve(undefined),
    ]);

    return {
      nameEn: o.nameEn ?? 'School',
      nameAr: o.nameAr ?? undefined,
      legalName: o.legalName ?? undefined,
      addressLines,
      phone: o.phone ?? o.mobile ?? undefined,
      email: o.email ?? undefined,
      website: o.website ?? undefined,
      footerNote,
      logo,
      stamp,
      signature,
    };
  }

  /** Download an S3-stored branding image as bytes (best-effort; PNG/JPEG only are embeddable). */
  private async imageBytes(key: string | null): Promise<Buffer | undefined> {
    if (!key || !this.storage.configured) return undefined;
    try {
      const url = await this.storage.presignDownload(key);
      const res = await fetch(url);
      if (!res.ok) return undefined;
      const type = res.headers.get('content-type') ?? '';
      // pdfkit can only embed PNG/JPEG; skip SVG/WEBP so it never throws mid-render.
      if (!/png|jpe?g/i.test(type) && !/\.(png|jpe?g)$/i.test(key)) return undefined;
      return Buffer.from(await res.arrayBuffer());
    } catch (err) {
      this.logger.debug(`branding image fetch failed for ${key}: ${String(err)}`);
      return undefined;
    }
  }

  private stripHtml(value: unknown): string | undefined {
    if (typeof value !== 'string' || !value.trim()) return undefined;
    return (
      value
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim() || undefined
    );
  }
}
