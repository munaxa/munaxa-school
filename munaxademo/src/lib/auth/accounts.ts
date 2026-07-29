/**
 * In-memory demo-account store. NO database: accounts live in a module-level Map,
 * seeded from src/seed/accounts.ts at boot. Admin-created accounts persist only until
 * the server restarts. Passwords are PBKDF2-hashed (never kept as plaintext at rest).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { SEED_ACCOUNTS } from '@/seed/accounts';
import type { PersonaId } from '@/lib/rbac';

// Admin-created demo accounts are persisted to a JSON file (no database) so they
// survive server restarts. Falls back to memory-only if the filesystem is read-only.
const DATA_DIR = process.env.DEMO_DATA_DIR || path.join(process.cwd(), '.data');
const DATA_FILE = path.join(DATA_DIR, 'accounts.json');

export interface DemoAccount {
  id: string;
  organizationName: string; // school name
  username: string;
  passwordHash: string;
  createdAt: string;
  expiresAt: string | null;
  status: 'ACTIVE' | 'DISABLED';
  admin: boolean;
  /** Assigned persona for prospect accounts; admins have none (free switching). */
  role: PersonaId | null;
  /**
   * Built-in (seed) accounts keep their password in memory and are compared without
   * PBKDF2. This keeps every request to ≤ 1 hash, so cold-start seeding never exceeds
   * Cloudflare's Free-plan CPU limit. Never persisted (stripped before writing to KV).
   */
  seedPassword?: string;
}

/** Configurable default expiry (days) for newly provisioned demo accounts. */
export function defaultExpiryDays(): number {
  const v = Number(process.env.DEMO_DEFAULT_EXPIRY_DAYS);
  return Number.isFinite(v) && v > 0 ? v : 14;
}

export interface LoginEvent {
  id: string;
  accountId: string;
  username: string;
  at: string;
  outcome: 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'DISABLED';
  ip: string;
}

const enc = new TextEncoder();
// OWASP-recommended work factor for PBKDF2-HMAC-SHA256, env-tunable so it can be lowered
// to fit Cloudflare Workers CPU limits. Stored per-hash, so changing it never breaks
// existing hashes (verify uses the factor recorded in the hash).
const PBKDF2_ITERATIONS = Math.max(10_000, Number(process.env.DEMO_PBKDF2_ITERATIONS) || 600_000);

function b64(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function unb64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function hashPassword(
  password: string,
  salt?: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS,
): Promise<string> {
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: s as BufferSource, iterations, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return `pbkdf2$${iterations}$${b64(s)}$${b64(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iterations = Number(parts[1]);
  if (!Number.isInteger(iterations) || iterations < 1) return false;
  const salt = unb64(parts[2]!);
  const expected = parts[3]!;
  // Re-derive with the SAME work factor recorded in the stored hash.
  const candidate = await hashPassword(password, salt, iterations);
  const candHash = candidate.split('$')[3]!;
  // Constant-time comparison (length-independent to avoid early-exit timing).
  const a = enc.encode(candHash);
  const b = enc.encode(expected);
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

/** Verify a login. Built-in seed accounts compare in-memory (no PBKDF2); admin-created
 *  accounts verify against their PBKDF2 hash — so any request does ≤ 1 hash. */
export async function checkPassword(account: DemoAccount, password: string): Promise<boolean> {
  if (account.seedPassword !== undefined) {
    const a = enc.encode(account.seedPassword);
    const b = enc.encode(password);
    let diff = a.length ^ b.length;
    for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
    return diff === 0;
  }
  return verifyPassword(password, account.passwordHash);
}

/* ── Module-level singletons (survive across requests, reset on server restart). ── */
interface Store {
  accounts: Map<string, DemoAccount>;
  history: LoginEvent[];
  seq: number;
}

const g = globalThis as unknown as { __munaxaDemoStore?: Store; __munaxaDemoInit?: Promise<void> };

function store(): Store {
  if (!g.__munaxaDemoStore) {
    g.__munaxaDemoStore = { accounts: new Map(), history: [], seq: 0 };
  }
  return g.__munaxaDemoStore;
}

/**
 * Storage backend for the accounts blob, resolved at runtime:
 *   1. Cloudflare Workers KV (binding `DEMO_ACCOUNTS`) when deployed on Cloudflare.
 *   2. A JSON file (`DEMO_DATA_DIR`) on a Node host with a writable filesystem.
 *   3. In-memory only (read-only FS / no binding) — seed accounts still work.
 * Workers have no filesystem, so KV is what makes created accounts survive deploys.
 */
type KVish = {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<unknown>;
};
const KV_KEY = 'accounts';

async function getKv(): Promise<KVish | null> {
  try {
    const { getCloudflareContext } = await import('@opennextjs/cloudflare');
    const env = getCloudflareContext().env as Record<string, unknown> | undefined;
    const ns = env?.['DEMO_ACCOUNTS'];
    return ns && typeof (ns as KVish).get === 'function' ? (ns as KVish) : null;
  } catch {
    return null; // not running on Cloudflare (local/node) → fall through to fs
  }
}

async function writeBlob(data: string): Promise<void> {
  const ns = await getKv();
  if (ns) {
    try {
      await ns.put(KV_KEY, data);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, data, 'utf8');
  } catch {
    /* read-only / ephemeral FS — accounts remain in memory only */
  }
}

async function readBlob(): Promise<string | null> {
  const ns = await getKv();
  if (ns) {
    try {
      return (await ns.get(KV_KEY)) ?? null;
    } catch {
      return null;
    }
  }
  try {
    return await fs.readFile(DATA_FILE, 'utf8');
  } catch {
    return null;
  }
}

/** Persist only admin-created accounts (best-effort). Built-in seed accounts always
 *  come from code and are never written out. */
async function persist(): Promise<void> {
  const s = store();
  const created = [...s.accounts.values()]
    .filter((a) => a.seedPassword === undefined)
    .map(({ seedPassword: _omit, ...rest }) => {
      void _omit;
      return rest;
    });
  await writeBlob(JSON.stringify({ seq: s.seq, accounts: created }, null, 2));
}

async function loadFromDisk(): Promise<{ seq: number; accounts: DemoAccount[] } | null> {
  const raw = await readBlob();
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.accounts)) {
      return { seq: Number(parsed.seq) || 0, accounts: parsed.accounts as DemoAccount[] };
    }
  } catch {
    /* invalid blob → fall back to seed */
  }
  return null;
}

/** Build a seed account WITHOUT hashing (compared in-memory; never persisted). */
function buildSeedAccount(seed: (typeof SEED_ACCOUNTS)[number], id: string): DemoAccount {
  const now = Date.now();
  return {
    id,
    organizationName: seed.organizationName,
    username: seed.username.toLowerCase(),
    passwordHash: '',
    seedPassword: seed.password,
    createdAt: new Date(now).toISOString(),
    expiresAt:
      seed.expiresInDays === null
        ? null
        : new Date(now + seed.expiresInDays * 86_400_000).toISOString(),
    status: seed.status,
    admin: Boolean(seed.admin),
    role: seed.role ?? null,
  };
}

async function ensureSeeded(): Promise<void> {
  if (!g.__munaxaDemoInit) {
    g.__munaxaDemoInit = (async () => {
      const s = store();
      const seedUsernames = new Set(SEED_ACCOUNTS.map((x) => x.username.toLowerCase()));

      // Built-in accounts always come from code (so the admin always exists and seed
      // password changes propagate). No hashing → zero PBKDF2 on cold start.
      let i = 0;
      for (const seed of SEED_ACCOUNTS) {
        const acct = buildSeedAccount(seed, `acct-${++i}`);
        s.accounts.set(acct.id, acct);
      }

      // Admin-created accounts come from KV / the JSON file (already hashed). Skip any
      // that collide with a built-in username.
      const loaded = await loadFromDisk();
      if (loaded) {
        for (const a of loaded.accounts) {
          if (seedUsernames.has(a.username.toLowerCase())) continue;
          s.accounts.set(a.id, a);
        }
        s.seq = Math.max(loaded.seq, i);
      } else {
        s.seq = i;
      }
    })();
  }
  return g.__munaxaDemoInit;
}

export async function listAccounts(): Promise<DemoAccount[]> {
  await ensureSeeded();
  return [...store().accounts.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getAccountByUsername(username: string): Promise<DemoAccount | undefined> {
  await ensureSeeded();
  const u = username.trim().toLowerCase();
  return [...store().accounts.values()].find((a) => a.username === u);
}

export async function getAccount(id: string): Promise<DemoAccount | undefined> {
  await ensureSeeded();
  return store().accounts.get(id);
}

export function isExpired(a: DemoAccount): boolean {
  return a.expiresAt !== null && new Date(a.expiresAt).getTime() < Date.now();
}

export async function createAccount(input: {
  organizationName: string;
  username: string;
  password: string;
  expiresInDays: number | null;
  role: PersonaId | null;
}): Promise<DemoAccount> {
  await ensureSeeded();
  const s = store();
  const username = input.username.trim().toLowerCase();
  if ([...s.accounts.values()].some((a) => a.username === username)) {
    throw new Error('Username already exists');
  }
  const id = `acct-${++s.seq}`;
  const acct: DemoAccount = {
    id,
    organizationName: input.organizationName.trim(),
    username,
    passwordHash: await hashPassword(input.password),
    createdAt: new Date().toISOString(),
    expiresAt:
      input.expiresInDays === null
        ? null
        : new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString(),
    status: 'ACTIVE',
    admin: false,
    role: input.role,
  };
  s.accounts.set(id, acct);
  await persist();
  return acct;
}

export async function updateAccount(
  id: string,
  patch: Partial<Pick<DemoAccount, 'status' | 'expiresAt'>>,
): Promise<DemoAccount | undefined> {
  await ensureSeeded();
  const acct = store().accounts.get(id);
  if (!acct) return undefined;
  if (patch.status) acct.status = patch.status;
  if (patch.expiresAt !== undefined) acct.expiresAt = patch.expiresAt;
  await persist();
  return acct;
}

export async function deleteAccount(id: string): Promise<boolean> {
  await ensureSeeded();
  const acct = store().accounts.get(id);
  if (!acct || acct.admin) return false; // never delete the admin account
  const ok = store().accounts.delete(id);
  if (ok) await persist();
  return ok;
}

export async function recordLogin(ev: Omit<LoginEvent, 'id' | 'at'>): Promise<void> {
  await ensureSeeded();
  const s = store();
  s.history.unshift({ ...ev, id: `login-${++s.seq}`, at: new Date().toISOString() });
  if (s.history.length > 500) s.history.length = 500;
}

export async function loginHistory(accountId?: string): Promise<LoginEvent[]> {
  await ensureSeeded();
  const all = store().history;
  return accountId ? all.filter((e) => e.accountId === accountId) : all;
}
