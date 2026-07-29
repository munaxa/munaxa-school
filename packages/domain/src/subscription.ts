/**
 * Subscription catalog — the single source of truth for plan tiers, the paid
 * capability keys, the metered limit dimensions, and the immutable set of CORE
 * School OS modules that are available on EVERY plan and must never be gated.
 *
 * Framework-free (no Prisma / Nest imports) so it can be shared by the API
 * (service + seed), the Admin UI, and tooling.
 */

/** Commercial tiers. Mirrors the Prisma `PlanTier` enum. */
export const PlanTier = {
  STARTER: 'STARTER',
  PROFESSIONAL: 'PROFESSIONAL',
  ENTERPRISE: 'ENTERPRISE',
} as const;
export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

/**
 * CORE School OS modules. These are ALWAYS available regardless of plan and must
 * never be disabled by subscription logic. Feature checks for these keys always
 * resolve to `true`.
 */
export const CORE_MODULES = [
  'admissions',
  'students',
  'attendance',
  'finance',
  'academics',
  'parent_portal',
  'student_app',
  'timetable',
  'communication',
  'reporting',
] as const;
export type CoreModule = (typeof CORE_MODULES)[number];

const CORE_MODULE_SET = new Set<string>(CORE_MODULES);

/** Whether a feature key is a core module (always on, never gated). */
export function isCoreModule(key: string): boolean {
  return CORE_MODULE_SET.has(key);
}

/**
 * Subscription lifecycle states (mirrors the Prisma `SubscriptionStatus` enum). v2 adds READ_ONLY
 * (login + read, no writes) and ARCHIVED (terminal, not loginable as a customer).
 */
export const SubscriptionState = {
  TRIALING: 'TRIALING',
  ACTIVE: 'ACTIVE',
  PAST_DUE: 'PAST_DUE',
  GRACE_PERIOD: 'GRACE_PERIOD',
  READ_ONLY: 'READ_ONLY',
  SUSPENDED: 'SUSPENDED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
  ARCHIVED: 'ARCHIVED',
} as const;
export type SubscriptionState = (typeof SubscriptionState)[keyof typeof SubscriptionState];

/** States in which the school may still sign in and view data. */
const LOGINABLE = new Set<string>([
  SubscriptionState.TRIALING,
  SubscriptionState.ACTIVE,
  SubscriptionState.PAST_DUE,
  SubscriptionState.GRACE_PERIOD,
  SubscriptionState.READ_ONLY,
]);

/** States in which the school retains full read+write access to its data. */
const WRITABLE = new Set<string>([
  SubscriptionState.TRIALING,
  SubscriptionState.ACTIVE,
  SubscriptionState.PAST_DUE,
  SubscriptionState.GRACE_PERIOD,
]);

/** Whether a school in this state can sign in at all. */
export function canLogin(status: string): boolean {
  return LOGINABLE.has(status);
}

/**
 * Whether create/update/delete is allowed in this state. READ_ONLY (and any suspended/terminal
 * state) blocks writes while still allowing reads and upgrade prompts. Absence of a subscription
 * (undefined/null) is permissive — pre-billing schools keep working.
 */
export function canMutate(status: string | null | undefined): boolean {
  if (status === null || status === undefined) return true;
  return WRITABLE.has(status);
}

/**
 * Paid capability keys (booleans) that a plan or a per-tenant override can grant.
 * Distinct from CORE_MODULES, which are never gated.
 */
export const PlanFeature = {
  API: 'api',
  AI_ASSISTANT: 'ai_assistant',
  SSO: 'sso',
  JOFOTARA: 'jofotara',
  ADVANCED_REPORTS: 'advanced_reports',
  AUTOMATION: 'automation',
  WHITE_LABEL: 'white_label',
  CUSTOM_INTEGRATIONS: 'custom_integrations',
  DEDICATED_SUPPORT: 'dedicated_support',
  ENTERPRISE_SECURITY: 'enterprise_security',
  ENTERPRISE_AI: 'enterprise_ai',
  BRANDING: 'branding',
} as const;
export type PlanFeature = (typeof PlanFeature)[keyof typeof PlanFeature];

export const ALL_PLAN_FEATURES: PlanFeature[] = Object.values(PlanFeature);

/** Human labels for the capability keys (shown in the console + upgrade UI). */
export const PLAN_FEATURE_LABELS: Record<PlanFeature, string> = {
  [PlanFeature.API]: 'API access',
  [PlanFeature.AI_ASSISTANT]: 'AI Assistant',
  [PlanFeature.SSO]: 'Single Sign-On (SSO)',
  [PlanFeature.JOFOTARA]: 'JoFotara e-invoicing',
  [PlanFeature.ADVANCED_REPORTS]: 'Advanced reports',
  [PlanFeature.AUTOMATION]: 'Automation',
  [PlanFeature.WHITE_LABEL]: 'White-label branding',
  [PlanFeature.CUSTOM_INTEGRATIONS]: 'Custom integrations',
  [PlanFeature.DEDICATED_SUPPORT]: 'Dedicated support',
  [PlanFeature.ENTERPRISE_SECURITY]: 'Enterprise security',
  [PlanFeature.ENTERPRISE_AI]: 'Enterprise AI',
  [PlanFeature.BRANDING]: 'Custom branding',
};

/** A catalog entry: the metadata behind a feature code (seeds the `FeatureCatalog` table). */
export interface FeatureCatalogEntry {
  code: string;
  name: string;
  description: string;
  category: string;
  isCore: boolean;
  defaultEnabled: boolean;
  enterpriseOnly: boolean;
  requiresApproval: boolean;
  sortOrder: number;
}

const ENTERPRISE_FEATURES = new Set<string>([
  PlanFeature.WHITE_LABEL,
  PlanFeature.CUSTOM_INTEGRATIONS,
  PlanFeature.DEDICATED_SUPPORT,
  PlanFeature.ENTERPRISE_SECURITY,
  PlanFeature.ENTERPRISE_AI,
]);

const FEATURE_CATEGORY: Record<string, string> = {
  [PlanFeature.API]: 'integrations',
  [PlanFeature.AI_ASSISTANT]: 'ai',
  [PlanFeature.ENTERPRISE_AI]: 'ai',
  [PlanFeature.SSO]: 'security',
  [PlanFeature.ENTERPRISE_SECURITY]: 'security',
  [PlanFeature.JOFOTARA]: 'integrations',
  [PlanFeature.CUSTOM_INTEGRATIONS]: 'integrations',
  [PlanFeature.ADVANCED_REPORTS]: 'reporting',
  [PlanFeature.AUTOMATION]: 'automation',
  [PlanFeature.WHITE_LABEL]: 'branding',
  [PlanFeature.BRANDING]: 'branding',
  [PlanFeature.DEDICATED_SUPPORT]: 'support',
};

/**
 * The full Feature Catalog: CORE School OS modules (always enabled, never gated) plus every paid
 * capability with its metadata. Single source of truth for seeding the `FeatureCatalog` table, so
 * plans reference catalog codes instead of hard-coded constants.
 */
export const FEATURE_CATALOG: FeatureCatalogEntry[] = [
  ...CORE_MODULES.map((code, i) => ({
    code,
    name: code
      .split('_')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' '),
    description: 'Core School OS module — always available on every plan.',
    category: 'core',
    isCore: true,
    defaultEnabled: true,
    enterpriseOnly: false,
    requiresApproval: false,
    sortOrder: i,
  })),
  ...ALL_PLAN_FEATURES.map((code, i) => ({
    code,
    name: PLAN_FEATURE_LABELS[code],
    description: `Paid capability: ${PLAN_FEATURE_LABELS[code]}.`,
    category: FEATURE_CATEGORY[code] ?? 'general',
    isCore: false,
    defaultEnabled: false,
    enterpriseOnly: ENTERPRISE_FEATURES.has(code),
    requiresApproval: false,
    sortOrder: 100 + i,
  })),
];

/** Metered limit dimensions. Mirrors {@link SubscriptionPlan} numeric columns + usage metrics. */
export const LimitKey = {
  STUDENTS: 'students',
  CAMPUSES: 'campuses',
  STAFF: 'staff',
  STORAGE_GB: 'storage_gb',
} as const;
export type LimitKey = (typeof LimitKey)[keyof typeof LimitKey];

/** `null` limit = UNLIMITED for that dimension. */
export type PlanLimits = {
  maxStudents: number | null;
  maxCampuses: number | null;
  maxStaff: number | null;
  storageGb: number | null;
};

export interface PlanDefinition {
  tier: PlanTier;
  name: string;
  description: string;
  sortOrder: number;
  priceMonthly: number | null;
  priceYearly: number | null;
  currency: string;
  limits: PlanLimits;
  /** Capability keys enabled on this plan. */
  features: PlanFeature[];
}

/**
 * Default plan catalog seeded during platform setup. Limits and capabilities follow
 * the product spec. `null` limit = unlimited. Prices are in minor currency units.
 */
export const PLAN_CATALOG: Record<PlanTier, PlanDefinition> = {
  [PlanTier.STARTER]: {
    tier: PlanTier.STARTER,
    name: 'Starter',
    description: '1 campus, up to 300 students and 20 staff. Core School OS with standard reports.',
    sortOrder: 1,
    priceMonthly: 4900,
    priceYearly: 49000,
    currency: 'JOD',
    limits: { maxStudents: 300, maxCampuses: 1, maxStaff: 20, storageGb: 10 },
    features: [],
  },
  [PlanTier.PROFESSIONAL]: {
    tier: PlanTier.PROFESSIONAL,
    name: 'Professional',
    description:
      'Up to 5 campuses and 1,500 students, unlimited staff. Advanced reports, API, AI Assistant, SSO and JoFotara.',
    sortOrder: 2,
    priceMonthly: 14900,
    priceYearly: 149000,
    currency: 'JOD',
    limits: { maxStudents: 1500, maxCampuses: 5, maxStaff: null, storageGb: 100 },
    features: [
      PlanFeature.ADVANCED_REPORTS,
      PlanFeature.API,
      PlanFeature.AI_ASSISTANT,
      PlanFeature.SSO,
      PlanFeature.JOFOTARA,
      PlanFeature.AUTOMATION,
      PlanFeature.BRANDING,
    ],
  },
  [PlanTier.ENTERPRISE]: {
    tier: PlanTier.ENTERPRISE,
    name: 'Enterprise',
    description:
      'Unlimited campuses, students and staff. White-label, custom integrations, dedicated support, enterprise security and AI.',
    sortOrder: 3,
    priceMonthly: null,
    priceYearly: null,
    currency: 'JOD',
    limits: { maxStudents: null, maxCampuses: null, maxStaff: null, storageGb: null },
    features: [
      PlanFeature.ADVANCED_REPORTS,
      PlanFeature.API,
      PlanFeature.AI_ASSISTANT,
      PlanFeature.SSO,
      PlanFeature.JOFOTARA,
      PlanFeature.AUTOMATION,
      PlanFeature.BRANDING,
      PlanFeature.WHITE_LABEL,
      PlanFeature.CUSTOM_INTEGRATIONS,
      PlanFeature.DEDICATED_SUPPORT,
      PlanFeature.ENTERPRISE_SECURITY,
      PlanFeature.ENTERPRISE_AI,
    ],
  },
};

export const PLAN_CATALOG_LIST: PlanDefinition[] = Object.values(PLAN_CATALOG).sort(
  (a, b) => a.sortOrder - b.sortOrder,
);
