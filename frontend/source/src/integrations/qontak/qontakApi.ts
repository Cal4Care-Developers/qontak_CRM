import { getApiBaseUrl } from '../../services/apiConfig';

// Network layer for the Qontak CRM integration. Every call goes to OUR Phalcon
// backend (QontakController), never to Qontak directly: the Mekari HMAC client
// secret only exists server-side, and the browser only ever sees whether a
// secret is set (`client_secret_set`), never its value.
//
// Auth is the same session cookie every other RingQ endpoint uses
// (credentials: 'include'); responses use the usual {result, message, content}
// envelope.

export interface ApiResult<T = any> {
  result?: string;
  status?: string;
  message?: string;
  content?: T;
}

export const ok = (data: ApiResult | null | undefined) =>
  !!data && (data.result === 'success' || data.status === 'success');

export type QontakEnvironment = 'production' | 'sandbox';

export interface QontakConfig {
  enabled: boolean;
  environment: QontakEnvironment;
  client_id: string;
  client_secret_set: boolean;
  crm_user_sso_id: string;
  popup_incoming: boolean;
  popup_outgoing: boolean;
  call_journaling: boolean;
  contact_creation: boolean;
  task_category_name: string;
  ai_transcription: boolean;
  ai_summary: boolean;
  ai_sentiment: boolean;
  timezone: string;
  screenpop_incoming: boolean;
  screenpop_outgoing: boolean;
  /** Template with {contact_id} / {phone}. */
  screenpop_url: string;
  /** Optional page for numbers with no Qontak contact; {phone} allowed. */
  screenpop_unknown_url: string;
  /** 'qontak_tab' = open the Qontak contact page; 'window' = RingQ call-details window. */
  screenpop_target: 'qontak_task' | 'qontak_tab' | 'window';
  connection_status: 'not_configured' | 'connected' | 'error' | 'disconnected';
  last_tested_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  can_manage: boolean;
}

export interface QontakConfigInput {
  enabled: boolean;
  environment: QontakEnvironment;
  client_id: string;
  /** Empty string keeps the stored secret. */
  client_secret: string;
  crm_user_sso_id: string;
  popup_incoming: boolean;
  popup_outgoing: boolean;
  call_journaling: boolean;
  contact_creation: boolean;
  task_category_name: string;
  ai_transcription: boolean;
  ai_summary: boolean;
  ai_sentiment: boolean;
  /** IANA zone for times written into Qontak tasks. */
  timezone: string;
  screenpop_incoming: boolean;
  screenpop_outgoing: boolean;
  /** Template with {contact_id} / {phone}. */
  screenpop_url: string;
  /** Optional page for numbers with no Qontak contact; {phone} allowed. */
  screenpop_unknown_url: string;
  /** 'qontak_tab' = open the Qontak contact page; 'window' = RingQ call-details window. */
  screenpop_target: 'qontak_task' | 'qontak_tab' | 'window';
}

export interface QontakContact {
  id: number | string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  telephone?: string;
  job_title?: string;
  company_name?: string;
  owner_name?: string;
  status_name?: string;
  url?: string;
  /** UUID Qontak uses in its web page URLs. */
  slug?: string;
  /** Qontak Customer 360 id (chat.qontak.com/customers/<id>). */
  customer_id?: string;
}

export type CallStatus = 'ringing' | 'answered' | 'completed' | 'missed' | 'rejected' | 'busy' | 'no_answer' | 'failed';

export interface QontakJournal {
  local_call_id: string;
  /** Unique reference in the Qontak task name, e.g. RQ1a2b3c4d. */
  call_ref?: string;
  qontak_contact_id: string | null;
  qontak_task_id: string | null;
  caller_number: string;
  destination_number: string;
  call_direction: 'inbound' | 'outbound';
  call_status: CallStatus;
  agent_extension: string | null;
  started_at: string | null;
  answered_at: string | null;
  ended_at: string | null;
  duration: number;
  talk_duration: number;
  recording_available: boolean;
  /** RingQ call id (xml_cdr_uuid), set once the recording is linked. */
  call_uuid?: string | null;
  transcription: string | null;
  summary: string | null;
  sentiment: string | null;
  ai_status: 'disabled' | 'pending' | 'done' | 'failed' | null;
  /** Why AI could not run for this call, when ai_status is 'failed'. */
  ai_error?: string | null;
  sync_status: 'pending' | 'synced' | 'failed' | 'skipped';
  retry_count: number;
  last_error: string | null;
}

export interface CallEventInput {
  local_call_id: string;
  event: 'started' | 'answered' | 'ended';
  direction: 'inbound' | 'outbound';
  remote_number: string;
  status?: CallStatus;
  /** ISO-8601 timestamps from the browser clock; the backend clamps them. */
  started_at?: string;
  answered_at?: string;
  ended_at?: string;
  talk_duration?: number;
  qontak_contact_id?: string | number | null;
}

async function parse(response: Response): Promise<ApiResult> {
  const text = await response.text();
  if (!text.trim()) return { result: 'error', message: `Empty response (HTTP ${response.status})` };
  try {
    return JSON.parse(text);
  } catch {
    return { result: 'error', message: `Unexpected response (HTTP ${response.status})` };
  }
}

async function request(method: 'GET' | 'POST', path: string, body?: Record<string, unknown>, signal?: AbortSignal): Promise<ApiResult> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    method,
    credentials: 'include',
    // JSON body sent as a "simple" form content type, like the rest of the app
    // (FLUTTER_HEADERS in IntegrationsModal): the live page (:443) calls the API
    // on :8443, and application/json would trigger a CORS preflight (OPTIONS,
    // no cookie) that the backend rejects. QontakController::input() reads it.
    headers: body ? { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } : { Accept: 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });
  return parse(response);
}

export const qontakApi = {
  getConfig: () => request('GET', '/qontak/config'),
  saveConfig: (input: QontakConfigInput) => request('POST', '/qontak/config', input as unknown as Record<string, unknown>),
  testConnection: (input?: Partial<QontakConfigInput>) => request('POST', '/qontak/testConnection', (input || {}) as Record<string, unknown>),
  disconnect: () => request('POST', '/qontak/disconnect', {}),
  searchContacts: (phone: string, signal?: AbortSignal) =>
    request('GET', `/qontak/contactsSearch?phone=${encodeURIComponent(phone)}`, undefined, signal),
  createContact: (input: { first_name: string; last_name?: string; telephone: string; email?: string }) =>
    request('POST', '/qontak/contacts', input),
  callEvent: (input: CallEventInput) => request('POST', '/qontak/callEvents', input as unknown as Record<string, unknown>),
  getJournal: (localCallId: string) => request('GET', `/qontak/callJournals?local_call_id=${encodeURIComponent(localCallId)}`),
  listJournals: (page = 1, phone = '') =>
    request('GET', `/qontak/callJournals?page=${page}${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`),
  retrySync: (localCallId: string) => request('POST', '/qontak/callJournals', { local_call_id: localCallId, action: 'retry' }),
  retryAi: (localCallId: string) => request('POST', '/qontak/aiAnalysis', { local_call_id: localCallId }),
  /** RingQ's own transcription (same as Call Logs → Transcribe); stores the text on the CDR. */
  ringqTranscribe: (callUuid: string) => request('GET', `/reports/audiototext/${encodeURIComponent(callUuid)}`),
  /** Tell the backend the CDR now has the transcript (or why it failed) so it updates the Qontak task. */
  transcriptReady: (localCallId: string, error = '') =>
    request('POST', '/qontak/callJournals', { local_call_id: localCallId, action: 'transcript', error }),
};

/** Settings dialog → call bridge: tells the dialer side to reload the config. */
export const QONTAK_CONFIG_CHANGED = 'qontak:config-changed';
