export const API_BASE_URL: string = import.meta.env.VITE_API_URL || "http://localhost:4000";

const SESSION_KEY = "foster-connect-anonymous-session";

export function getSessionId() {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

async function request<T>(path: string, options: RequestInit = {}, session = false): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("Content-Type", "application/json");
  if (session) headers.set("X-Session-ID", getSessionId());
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Something went wrong");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export interface ResourceItem {
  id: number;
  title: string;
  organization: string;
  description: string;
  category: string;
  county: string;
  serviceArea: string;
  eligibility: string;
  ageMin: number | null;
  ageMax: number | null;
  cost: string;
  applicationSteps: string;
  whatToBring: string;
  website: string;
  phone: string;
  address: string;
  hours: string;
  languages: string;
  accessibility: string;
  deliveryMode: string;
  urgencyLevel: string;
  isCrisis: boolean;
  /** "information": a guide or PDF, not a place you call or visit (Y11). */
  kind?: "service" | "information";
  /** Fields a reviewer confirmed this listing genuinely has none of (P7). */
  fieldsNa?: string[];
  /** Check again on or before this date (P7). */
  recheckAt?: string | null;
  sourceUrl: string;
  verifiedAt: string;
  /** "phone" when a reviewer confirmed the listing by calling; "online" when checked against the program's page. */
  checkedHow?: "phone" | "online";
  tags: string;
}

export type TaskStatus = "not_started" | "in_progress" | "completed" | "blocked";

export interface RoadmapTask {
  id: number;
  roadmapId: number;
  taskText: string;
  taskCategory: string;
  timeframe: "This Week" | "30 Days" | "3-6 Months" | "6-12 Months";
  whyItMatters: string;
  motivationNote: string;
  status: TaskStatus;
  dueDate: string | null;
  blockerReason: string | null;
  privateNote: string | null;
  resourceId: number | null;
  taskOrder: number;
  completedAt: string | null;
  createdAt: string;
}

export interface Roadmap {
  id: number;
  title: string;
  goalSummary: string;
  greeting: string;
  closing: string;
  county: string;
  youthName: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  tasks: RoadmapTask[];
  recommendedResources: ResourceItem[];
  /**
   * Present on a freshly generated plan. "fallback" means the assistant was
   * unavailable (no key, provider error, or its draft failed grounding) and
   * the plan was built from the verified directory alone.
   */
  generatedBy?: "ai" | "fallback";
}

export type HousingStatus =
  | "placement" | "doubled_up" | "own_place" | "shelter" | "unsheltered" | "unstable" | "unsaid";

export type DocumentId = "state_id" | "birth_certificate" | "ssn_card" | "bank_account" | "phone_plan";

export interface RoadmapIntake {
  youthName?: string;
  age?: number;
  county: "Contra Costa" | "Alameda" | "Bay Area" | "California" | "National";
  currentNeeds: string;
  futurePlan: string;
  additionalContext?: string;
  /** Step-1 chips — which kinds of support to search. */
  needs?: string[];
  /** Where they are sleeping. Changes which housing options apply and how urgent. */
  housingStatus?: HousingStatus;
  /** Documents they already have. Missing ones become early steps. */
  documents?: DocumentId[];
  /** Anything with a date attached. */
  deadlines?: { kind: string; date?: string }[];
  /** Set after a young person has seen crisis support and chooses to continue anyway. */
  acknowledgedSafety?: boolean;
}

export interface ChatMessageInput { role: "user" | "assistant"; content: string; resourceIds?: number[] }

/** Where each AI conversation is kept in this browser, so "Delete my data" and sign-out can clear it. */
export const MAYA_CONVERSATION_KEY = "fc-maya-conversation";
export const MAYA_ARCHIVE_KEY = "fc-maya-archive";
export const GUIDE_CONVERSATION_KEY = "fc-partner-guide-conversation";

export interface CrisisContact {
  id: string;
  name: string;
  phone: string;
  text?: string;
  website?: string;
  description: string;
  hours: string;
}

/** A change Maya proposes to the plan (Y3). Nothing happens until the person taps it. */
export interface PlanSuggestion {
  action: "add" | "replace" | "split" | "remove";
  targetTaskId: number | null;
  taskText: string;
  steps: string[];
  timeframe: RoadmapTask["timeframe"];
  resourceId: number | null;
  why: string;
  /** The plan the suggestion was made against; null when the person has no plan yet. */
  roadmapId: number | null;
}

export interface ChatResponse {
  reply: string;
  planSuggestions?: PlanSuggestion[];
  /**
   * The canonical conversation as the server recorded it, plus a token proving
   * the server produced it. Send both back on the next turn — without the token
   * the history is discarded, because otherwise a browser could forge what Maya
   * previously said and talk the model out of its own source rules.
   */
  history?: ChatMessageInput[];
  historyToken?: string;
  resources: ResourceItem[];
  needsClarification: boolean;
  safetyMode: boolean;
  /** Set when assessSafety flagged the message. Shown alongside the reply, never in place of it. */
  crisisContacts?: CrisisContact[];
  /**
   * Set when the AI navigator was unreachable and this reply came from a
   * direct directory search instead. Maya must say so plainly, never hide it.
   */
  degraded?: boolean;
  suggestedTasks: Array<{
    taskText: string;
    taskCategory: string;
    timeframe: string;
    resourceId: number | null;
    motivationNote: string;
  }>;
}

/**
 * Returned instead of a Roadmap when the intake text itself triggered a
 * crisis assessment. The plan is not built yet — crisis support is shown
 * first, and the young person chooses whether to continue.
 */
export interface RoadmapDeferredResponse {
  roadmapDeferred: true;
  reply: string;
  crisisContacts: CrisisContact[];
  resources: ResourceItem[];
}

/** One page of directory results. `total` ignores paging, so the count is honest. */
export interface ResourcePage {
  items: ResourceItem[];
  total: number;
  offset: number;
  hasMore: boolean;
}

export function fetchResources(filters: Record<string, string | number | undefined> = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== "All") params.set(key, String(value));
  }
  return request<ResourcePage>(`/api/resources?${params}`);
}

export function fetchResource(id: number) { return request<ResourceItem>(`/api/resources/${id}`); }
export function fetchRoadmaps() { return request<Omit<Roadmap, "tasks" | "recommendedResources">[]>("/api/roadmaps", {}, true); }
export function fetchRoadmap(id: number) { return request<Roadmap>(`/api/roadmaps/${id}`, {}, true); }
export function generateRoadmap(input: RoadmapIntake) {
  return request<Roadmap | RoadmapDeferredResponse>("/api/roadmaps", { method: "POST", body: JSON.stringify(input) }, true);
}
export type TaskUpdate = Partial<Pick<RoadmapTask, "status" | "dueDate" | "blockerReason" | "privateNote" | "taskText" | "timeframe" | "taskOrder" | "whyItMatters">>;
export function updateTask(id: number, update: TaskUpdate) {
  return request<RoadmapTask>(`/api/tasks/${id}`, { method: "PATCH", body: JSON.stringify(update) }, true);
}
export interface NewTask { taskText: string; timeframe?: RoadmapTask["timeframe"]; whyItMatters?: string; taskCategory?: string; resourceId?: number | null; afterTaskId?: number }
export function addTask(roadmapId: number, input: NewTask) {
  return request<RoadmapTask>(`/api/roadmaps/${roadmapId}/tasks`, { method: "POST", body: JSON.stringify(input) }, true);
}
export function deleteTask(id: number) {
  return request<void>(`/api/tasks/${id}`, { method: "DELETE" }, true);
}
export function sendChat(
  message: string,
  history: ChatMessageInput[],
  context?: { county?: string; age?: number; historyToken?: string },
) {
  const { historyToken, ...rest } = context || {};
  return request<ChatResponse>(
    "/api/chat",
    { method: "POST", body: JSON.stringify({ message, history, historyToken, ...rest }) },
    true,
  );
}
export function fetchSavedResources() { return request<ResourceItem[]>("/api/saved-resources", {}, true); }
export function saveResource(id: number) { return request<{ saved: boolean }>(`/api/saved-resources/${id}`, { method: "POST" }, true); }
export function unsaveResource(id: number) { return request<void>(`/api/saved-resources/${id}`, { method: "DELETE" }, true); }
export function reportResource(id: number, reason: string) {
  return request<{ message: string }>(`/api/resources/${id}/reports`, { method: "POST", body: JSON.stringify({ reason }) }, true);
}
export function submitResource(input: Record<string, string>) {
  return request<{ id: number; status: string; message: string }>("/api/resource-submissions", { method: "POST", body: JSON.stringify(input) });
}
export async function exportSessionData() {
  return request<Record<string, unknown>>("/api/session/export", {}, true);
}
export async function deleteSessionData() {
  await request<void>("/api/session", { method: "DELETE" }, true);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(MAYA_CONVERSATION_KEY);
  localStorage.removeItem(MAYA_ARCHIVE_KEY);
  try { sessionStorage.removeItem("fc-maya-messages"); } catch { /* older key */ }
}

/* ── Partner moderation ──────────────────────────────────────────────────── */

const PARTNER_TOKEN_KEY = "fc-partner-token";

export function getPartnerToken() {
  try { return sessionStorage.getItem(PARTNER_TOKEN_KEY) || ""; } catch { return ""; }
}
export function setPartnerToken(token: string) {
  try { sessionStorage.setItem(PARTNER_TOKEN_KEY, token); } catch { /* private mode */ }
}
export function clearPartnerToken() {
  try { sessionStorage.removeItem(PARTNER_TOKEN_KEY); } catch { /* private mode */ }
}

export interface PartnerIdentity { name: string; email: string; organisation: string; role: "contributor" | "reviewer" }

export interface Submission {
  id: number;
  title: string;
  organization: string;
  description: string;
  category: string;
  county: string;
  website: string;
  contact: string | null;
  kind?: "service" | "information";
  source_url: string;
  relationship: string;
  submitter_name: string;
  status: "pending" | "approved" | "rejected";
  moderator_note: string | null;
  reviewed_by: string | null;
  resource_id: number | null;
  created_at: string;
  reviewed_at: string | null;
}

/** What a reviewer must add before a submission can be shown to young people. */
export interface ApprovalDetail {
  eligibility: string;
  cost: string;
  applicationSteps: string;
  whatToBring?: string;
  phone?: string;
  hours?: string;
  languages?: string;
  accessibility?: string;
  urgencyLevel?: "Emergency" | "Urgent" | "Standard";
  isCrisis?: boolean;
}

async function partnerRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${getPartnerToken()}`);
  if (options.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers });
  if (response.status === 401) {
    clearPartnerToken();
    window.dispatchEvent(new Event("partner-session-expired"));
    throw new Error("Your session expired. Sign in again.");
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Something went wrong");
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export async function partnerLogin(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/api/partner/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Could not sign you in");
  setPartnerToken(payload.token);
  return payload.partner as PartnerIdentity;
}

export function partnerMe() {
  return partnerRequest<{ partner: PartnerIdentity }>("/api/partner/me");
}

export async function partnerLogout() {
  await partnerRequest<void>("/api/partner/logout", { method: "POST" }).catch(() => undefined);
  clearPartnerToken();
  try { sessionStorage.removeItem(GUIDE_CONVERSATION_KEY); } catch { /* private mode */ }
}

export function fetchSubmissions() {
  return partnerRequest<Submission[]>("/api/partner/submissions");
}

export function reviewSubmission(
  id: number,
  status: "approved" | "rejected",
  moderatorNote: string,
  resource?: ApprovalDetail,
) {
  return partnerRequest<{ id: number; status: string; resourceId?: number }>(
    `/api/partner/submissions/${id}`,
    { method: "PATCH", body: JSON.stringify({ status, moderatorNote, resource }) },
  );
}

export interface PartnerAnalytics {
  totals: { verified: number; retired: number; crisis: number; checked_last_30: number; publishedLast30: number };
  byCategory: { category: string; count: number; free: number; cost_unknown: number; stale: number }[];
  byCounty: { county: string; count: number }[];
  matrix: { category: string; county: string; count: number }[];
  freshness: { fresh: number; aging: number; stale: number; unknown: number };
  completeness: { phone: number; website: number; hours: number; address: number; cost_known: number; age_known: number; languages: number; source: number };
  staleList: { id: number; title: string; organization: string; category: string; county: string; verified_at: string; recheck_at?: string | null }[];
  pipeline: { pending: number; approved: number; rejected: number; pending_over_week: number; submitted_last_30: number };
  changes: { pending: number };
  reports: { id: number; resource_id: number; title: string; organization: string; reason: string; created_at: string }[];
  generatedAt: string;
}
export function fetchPartnerAnalytics() { return partnerRequest<PartnerAnalytics>("/api/partner/analytics"); }

/* ── Listings behind a Coverage bar, and edits to them (P4–P7) ─────────── */

export type MissingField = "phone" | "website" | "hours" | "address" | "languages" | "cost" | "age";
export const NA_FIELDS: MissingField[] = ["phone", "website", "hours", "address", "languages", "cost", "age"];

export function fetchPartnerResources(filters: { q?: string; county?: string; category?: string; missing?: MissingField; stale?: boolean; limit?: number } = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== "" && value !== false) params.set(key, String(value));
  }
  return partnerRequest<ResourceItem[]>(`/api/partner/resources?${params}`);
}

export interface ResourceChanges {
  title?: string; organization?: string; description?: string; eligibility?: string; cost?: string;
  applicationSteps?: string; whatToBring?: string; website?: string; phone?: string; address?: string;
  hours?: string; languages?: string; accessibility?: string; serviceArea?: string;
  ageMin?: number | null; ageMax?: number | null;
  fieldsNa?: MissingField[];
  recheckAt?: string | null;
  checkedBy?: "phone" | "online";
}
export function proposeResourceChange(resourceId: number, changes: ResourceChanges, note = "") {
  return partnerRequest<{ id: number; status: "pending" | "approved"; resource?: ResourceItem }>(`/api/partner/resources/${resourceId}/changes`, { method: "POST", body: JSON.stringify({ changes, note }) });
}
export interface ResourceChange {
  id: number; resourceId: number; resourceTitle: string; resourceOrganization: string; resourceCounty: string;
  partnerName: string; partnerEmail: string; note: string; status: "pending" | "approved" | "rejected";
  changes: ResourceChanges; current: ResourceItem | null; createdAt: string; reviewedAt: string | null; moderatorNote: string | null;
}
export function fetchResourceChanges(status: "pending" | "approved" | "rejected" = "pending") {
  return partnerRequest<ResourceChange[]>(`/api/partner/changes?status=${status}`);
}
export function reviewResourceChange(id: number, status: "approved" | "rejected", moderatorNote = "") {
  return partnerRequest<{ id: number; status: string }>(`/api/partner/changes/${id}`, { method: "PATCH", body: JSON.stringify({ status, moderatorNote }) });
}

export function fetchMySubmissions() {
  return partnerRequest<Submission[]>("/api/partner/my-submissions");
}
export function submitPartnerResource(input: Parameters<typeof submitResource>[0]) {
  return partnerRequest("/api/partner/my-submissions", { method: "POST", body: JSON.stringify(input) });
}
export interface GuideResponse { reply: string; history: ChatMessageInput[]; historyToken: string }
export function askPartnerGuide(message: string, history: ChatMessageInput[] = [], historyToken?: string) {
  return partnerRequest<GuideResponse>("/api/partner/guide", { method: "POST", body: JSON.stringify({ message, history, historyToken }) });
}
