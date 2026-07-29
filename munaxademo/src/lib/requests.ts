/**
 * In-memory Demo Requests store ("Book a Demo" funnel). NO database: requests live
 * in a module-level map and reset on server restart, consistent with the rest of the
 * demo. Public visitors create requests; admins move them through the pipeline and
 * convert approved ones into demo accounts.
 */

export type RequestStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'SCHEDULED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED';

export const REQUEST_STATUSES: RequestStatus[] = [
  'NEW',
  'CONTACTED',
  'SCHEDULED',
  'APPROVED',
  'REJECTED',
  'CONVERTED',
];

export interface DemoRequest {
  id: string;
  schoolName: string;
  contactPerson: string;
  jobTitle: string;
  country: string;
  numStudents: number;
  numCampuses: number;
  email: string;
  phone: string;
  notes: string;
  status: RequestStatus;
  createdAt: string;
  updatedAt: string;
  /** Set once an account has been provisioned from this request. */
  accountId?: string;
}

interface RequestStore {
  requests: Map<string, DemoRequest>;
  seq: number;
}

const g = globalThis as unknown as { __munaxaDemoRequests?: RequestStore };

function store(): RequestStore {
  if (!g.__munaxaDemoRequests) g.__munaxaDemoRequests = { requests: new Map(), seq: 0 };
  return g.__munaxaDemoRequests;
}

export interface CreateRequestInput {
  schoolName: string;
  contactPerson: string;
  jobTitle: string;
  country: string;
  numStudents: number;
  numCampuses: number;
  email: string;
  phone: string;
  notes: string;
}

export function createRequest(input: CreateRequestInput): DemoRequest {
  const s = store();
  const now = new Date().toISOString();
  const id = `req-${++s.seq}`;
  const req: DemoRequest = { ...input, id, status: 'NEW', createdAt: now, updatedAt: now };
  s.requests.set(id, req);
  return req;
}

export function listRequests(): DemoRequest[] {
  return [...store().requests.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRequest(id: string): DemoRequest | undefined {
  return store().requests.get(id);
}

export function updateRequest(
  id: string,
  patch: Partial<Pick<DemoRequest, 'status' | 'accountId'>>,
): DemoRequest | undefined {
  const req = store().requests.get(id);
  if (!req) return undefined;
  if (patch.status) req.status = patch.status;
  if (patch.accountId !== undefined) req.accountId = patch.accountId;
  req.updatedAt = new Date().toISOString();
  return req;
}
