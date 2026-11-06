// The ONLY module in the web app that fetches (AGENTS.md §3, api-and-data.md §5.6).
// Every function returns the `@tapat/shared` type of its endpoint and calls a relative `/api/*` URL, so the
// browser rides the Next.js rewrite locally and Caddy's `/api/*` route in prod; no host or port is hardcoded.
// A non-2xx response throws ApiClientError carrying `{error:{code,message}}` from §5.3.
import type {
  AuthResponse,
  Beneficiary,
  BeneficiaryStatus,
  BudgetCheckoutBody,
  BudgetCheckoutResponse,
  BurstResponse,
  CalibrationResponse,
  CreateProgramBody,
  Dashboard,
  EndProgramResponse,
  EnrollResponse,
  HealthResponse,
  IntakeResponse,
  LoginBody,
  MeResponse,
  Program,
  ProgramResponse,
  RequestEvidenceResponse,
  SettlementResponse,
  SignupBody,
  Station,
  TapResponse,
  TrancheStartResponse,
  TrancheState,
  UnfreezeResponse,
} from '@tapat/shared';

/** The closed error-code set of api-and-data.md §5.3. */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CARD_NOT_ENROLLED'
  | 'WEBHOOK_SIGNATURE_INVALID'
  | 'CARD_ALREADY_ENROLLED'
  | 'INVALID_STATE'
  | 'OCR_UNAVAILABLE'
  | 'PHOTO_MISMATCH'
  | 'PHOTO_CONFIRMATION_REQUIRED'
  | 'STATION_FROZEN'
  | 'CHAIN_ERROR'
  | 'INTERNAL'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'ACCOUNT_EXISTS';

const API_ERROR_CODES: readonly ApiErrorCode[] = [
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'CARD_NOT_ENROLLED',
  'WEBHOOK_SIGNATURE_INVALID',
  'CARD_ALREADY_ENROLLED',
  'INVALID_STATE',
  'OCR_UNAVAILABLE',
  'PHOTO_MISMATCH',
  'PHOTO_CONFIRMATION_REQUIRED',
  'STATION_FROZEN',
  'CHAIN_ERROR',
  'INTERNAL',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'ACCOUNT_EXISTS',
];

/** A failed `/api/*` call: the HTTP status plus the `code`/`message` of the `{error:{…}}` envelope. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;

  constructor(status: number, code: ApiErrorCode, message: string) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = code;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: BodyInit;
  headers?: Record<string, string>;
}

function isApiErrorCode(value: unknown): value is ApiErrorCode {
  return typeof value === 'string' && (API_ERROR_CODES as readonly string[]).includes(value);
}

/** Reads the `{error:{code,message}}` envelope; a body that is not JSON (a proxy page, say) becomes INTERNAL. */
async function toApiClientError(response: Response): Promise<ApiClientError> {
  const envelope = (await response.json().catch(() => null)) as
    | { error?: { code?: unknown; message?: unknown } }
    | null;
  const code = isApiErrorCode(envelope?.error?.code) ? envelope.error.code : 'INTERNAL';
  const message =
    typeof envelope?.error?.message === 'string' && envelope.error.message !== ''
      ? envelope.error.message
      : `Request failed with status ${response.status}`;
  return new ApiClientError(response.status, code, message);
}

async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const response = await fetch(`/api${path}`, {
    method: options.method ?? 'GET',
    ...(options.body === undefined ? {} : { body: options.body }),
    ...(options.headers === undefined ? {} : { headers: options.headers }),
  });
  if (!response.ok) throw await toApiClientError(response);
  return response;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  return (await response.json()) as T;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  if (body === undefined) return request<T>(path, { method: 'POST' });
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
  });
}

/** No content-type: the browser has to set the multipart boundary itself. */
function postForm<T>(path: string, form: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: form });
}

/** A `File` already carries its name; a bare `Blob` needs one for the multipart part. */
function fileNameOf(file: Blob): string {
  if ('name' in file && typeof file.name === 'string' && file.name !== '') return file.name;
  return file.type === 'text/csv' ? 'masterlist.csv' : 'upload';
}

// ---- #1 GET /api/health -------------------------------------------------------------------------------

/** Liveness of RPC, Velo and Telegram plus the gas mode. `ok` depends on `rpc` only. */
export function getHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/health');
}

// ---- #2–#5 program ------------------------------------------------------------------------------------

/** The current program (or `null`) plus the demo rate; `phpPerXlm` is present even with no program. */
export function getProgram(): Promise<ProgramResponse> {
  return request<ProgramResponse>('/program');
}

/** `POST /api/program` response body: `{ "program": Program }` (§5.2 #3). */
export interface CreateProgramResponse {
  program: Program;
}

/** Creates the program; every field is optional and omitted fields take the demo defaults. */
export function postProgram(body: CreateProgramBody = {}): Promise<CreateProgramResponse> {
  return postJson<CreateProgramResponse>('/program', body);
}

/** Opens the Velo budget checkout session the Budget Office pays in Freighter. */
export function postBudgetCheckout(body: BudgetCheckoutBody): Promise<BudgetCheckoutResponse> {
  return postJson<BudgetCheckoutResponse>('/program/budget-checkout', body);
}

/** Revokes every card and sweeps its escrow back to the Program Wallet. */
export function postProgramEnd(): Promise<EndProgramResponse> {
  return postJson<EndProgramResponse>('/program/end');
}

// ---- #6–#9 intake + beneficiaries ---------------------------------------------------------------------

/** Uploads the masterlist as `multipart/form-data`, one `file` part (CSV, PNG or JPEG). */
export function uploadIntake(file: Blob, fileName?: string): Promise<IntakeResponse> {
  const form = new FormData();
  form.append('file', file, fileName ?? fileNameOf(file));
  return postForm<IntakeResponse>('/intake/upload', form);
}

/** λ_lo, λ_hi and the empirical rates, computed once at boot from the calibration fixture. */
export function getCalibration(): Promise<CalibrationResponse> {
  return request<CalibrationResponse>('/intake/calibration');
}

/** `?status=` (repeatable) and `?limit=` (default 200, max 500), newest first. */
export interface BeneficiaryQuery {
  status?: BeneficiaryStatus | BeneficiaryStatus[];
  limit?: number;
}

export function getBeneficiaries(query: BeneficiaryQuery = {}): Promise<Beneficiary[]> {
  const params = new URLSearchParams();
  const statuses = query.status === undefined ? [] : Array.isArray(query.status) ? query.status : [query.status];
  for (const status of statuses) params.append('status', status);
  if (query.limit !== undefined) params.set('limit', String(query.limit));
  const search = params.toString();
  return request<Beneficiary[]>(`/beneficiaries${search === '' ? '' : `?${search}`}`);
}

/** Sends the Telegram evidence request / appeal; `telegramSent:false` is still a 200. */
export function postRequestEvidence(beneficiaryId: string): Promise<RequestEvidenceResponse> {
  return postJson<RequestEvidenceResponse>(`/beneficiaries/${encodeURIComponent(beneficiaryId)}/request-evidence`);
}

// ---- #10 enroll ---------------------------------------------------------------------------------------

/** `POST /api/enroll` fields (§5.2 #10); `uid` is the normalized **Read card** value. */
export interface EnrollInput {
  beneficiaryId: string;
  uid: string;
  /** The committed sample photo (`d4-photo.jpg` → precomputed `{plate,toda}`). */
  samplePhoto?: 'd4-photo.jpg';
  /** An officer's live photo; needs `officerConfirmed: true`. */
  photo?: Blob;
  photoFileName?: string;
  officerConfirmed?: boolean;
}

/** Multipart enrollment: card + agent + on-chain policy. */
export function postEnroll(input: EnrollInput): Promise<EnrollResponse> {
  const form = new FormData();
  form.append('beneficiaryId', input.beneficiaryId);
  form.append('uid', input.uid);
  if (input.samplePhoto !== undefined) form.append('samplePhoto', input.samplePhoto);
  if (input.photo !== undefined) form.append('photo', input.photo, input.photoFileName ?? fileNameOf(input.photo));
  if (input.officerConfirmed !== undefined) form.append('officerConfirmed', input.officerConfirmed ? 'true' : 'false');
  return postForm<EnrollResponse>('/enroll', form);
}

// ---- #11–#12 tranche ----------------------------------------------------------------------------------

/** Plays the simulated price feed; 202 with the point count and tick interval. */
export function postTrancheStart(): Promise<TrancheStartResponse> {
  return postJson<TrancheStartResponse>('/agents/tranche/start');
}

/** Polled by `/demo` until `running === false`; carries the whole series so a reload redraws the chart. */
export function getTrancheState(): Promise<TrancheState> {
  return request<TrancheState>('/agents/tranche/state');
}

// ---- #13–#17 taps, burst, stations, settlement ---------------------------------------------------------

/** `POST /api/taps` body (§5.2 #13): a card read (`uid`) or a simulated tap (`cardId` + `simulated`). */
export interface TapRequest {
  stationId: string;
  amountPhp: number;
  uid?: string;
  cardId?: string;
  simulated?: boolean;
}

/** One tap. A declined tap is still a 200: render `tap.status`, `tap.reasonCode` and `message` verbatim. */
export function postTap(body: TapRequest): Promise<TapResponse> {
  return postJson<TapResponse>('/taps', body);
}

/** Replays the 30-edge anomaly burst at Station B (needs one prior authorized Station-B tap). */
export function postFreezeBurst(): Promise<BurstResponse> {
  return postJson<BurstResponse>('/agents/freeze/burst');
}

/** LGU unfreezes a station; held pending stays in escrow until the next settlement run. */
export function postUnfreeze(stationId: string): Promise<UnfreezeResponse> {
  return postJson<UnfreezeResponse>(`/stations/${encodeURIComponent(stationId)}/unfreeze`);
}

/** Both stations with their pending and already-claimed totals. */
export function getStations(): Promise<Station[]> {
  return request<Station[]>('/stations');
}

/** Claims the pending taps of every active station; a frozen station is `HELD`. */
export function postSettlementRun(): Promise<SettlementResponse> {
  return postJson<SettlementResponse>('/settlement/run');
}

// ---- #18–#19 dashboard + export -------------------------------------------------------------------------

/** Every number, the invariant flag and both feeds; the page loads this, then opens `useStream`. */
export function getDashboard(): Promise<Dashboard> {
  return request<Dashboard>('/dashboard');
}

/** The COA audit export as CSV text (`text/csv`), so a page can hand it to a download link. */
export async function getCoaCsv(): Promise<string> {
  const response = await send('/export/coa.csv');
  return response.text();
}

// ---- #22–#25 accounts ------------------------------------------------------------------------------------

/** #22 `POST /api/auth/signup`: always creates a `viewer` and logs in with a session cookie (201). */
export function postSignup(body: SignupBody): Promise<AuthResponse> {
  return postJson<AuthResponse>('/auth/signup', body);
}

/** #23 `POST /api/auth/login`: 401 `UNAUTHORIZED` ("Wrong email or password.") on a bad email or password. */
export function postLogin(body: LoginBody): Promise<AuthResponse> {
  return postJson<AuthResponse>('/auth/login', body);
}

/** #24 `POST /api/auth/logout`: 204 with an empty body, so this must not parse JSON. */
export async function postLogout(): Promise<void> {
  await send('/auth/logout', { method: 'POST' });
}

/** #25 `GET /api/auth/me`: `user: null` when there is no session or it expired. */
export function getMe(): Promise<MeResponse> {
  return request<MeResponse>('/auth/me');
}
