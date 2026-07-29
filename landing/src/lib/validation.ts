import { z } from 'zod';

/**
 * Contact form schema. Shared between the client form and the `/api/contact` route so the
 * rules never drift between the two.
 *
 * Security notes:
 *  - Every free-text field is trimmed and length-capped to bound storage / email payload size.
 *  - `website` is a honeypot: real visitors never see or fill it (hidden via CSS). Bots that
 *    auto-fill every field populate it; the route silently discards those submissions without
 *    revealing that detection occurred.
 */
export const contactFormSchema = z.object({
  name: z.string().trim().min(2, 'Please enter your full name.').max(100, 'Name is too long.'),
  schoolName: z
    .string()
    .trim()
    .min(2, 'Please enter your school or organization name.')
    .max(150, 'School name is too long.'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address.')
    .max(254, 'Email is too long.'),
  phone: z
    .string()
    .trim()
    .min(7, 'Please enter a valid phone number.')
    .max(20, 'Phone number is too long.')
    .regex(/^[+]?[\d\s().-]{7,20}$/, 'Please enter a valid phone number.'),
  message: z
    .string()
    .trim()
    .min(10, 'Please tell us a little more (at least 10 characters).')
    .max(2000, 'Message is too long (max 2000 characters).'),
  // Honeypot: accepted as any string so a non-empty value doesn't fail validation (which would
  // reveal detection to the bot via a different response). The route handler checks this value.
  website: z.string().max(200).optional().default(''),
});

export type ContactFormInput = z.infer<typeof contactFormSchema>;

/** Strips characters with special meaning in HTML so user input is safe to embed in emails. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
