import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, ChevronDown, CircleAlert, CircleCheck, ExternalLink, LoaderCircle, Mail, Minus, Phone, RefreshCw, UserPlus, X } from 'lucide-react';
import { qontakApi, ok } from './qontakApi';
import type { QontakContact, QontakJournal } from './qontakApi';
import type { PopupCall } from './QontakCallBridge';
import { readStoredSession } from '../../utils/storedSession';

export type LookupState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'none' }
  | { kind: 'error'; message: string }
  | { kind: 'found'; contacts: QontakContact[] };

interface Props {
  call: PopupCall;
  lookup: LookupState;
  selectedContact: QontakContact | null;
  canCreateContact: boolean;
  journaling: boolean;
  onSelectContact: (c: QontakContact) => void;
  onContactCreated: (c: QontakContact) => void;
  onRetryLookup: () => void;
  onClose: () => void;
  /** Render in place (inside the separate call window) instead of floating over the app. */
  inline?: boolean;
}

export const contactName = (c: QontakContact) =>
  c.full_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Unnamed contact';

const STATUS_LABEL: Record<string, string> = {
  completed: 'Completed', missed: 'Missed', rejected: 'Rejected', busy: 'Busy', no_answer: 'No answer', failed: 'Failed',
};

const fmtTime = (iso: string | null | undefined) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

const agentLabel = () => {
  const s = readStoredSession();
  const ext = s?.extension ?? s?.username;
  const name = s?.name || [s?.first_name, s?.last_name].filter(Boolean).join(' ');
  if (!ext && !name) return '—';
  return name ? `${name}${ext ? ` (${ext})` : ''}` : String(ext);
};

const CreateContactForm: React.FC<{ phone: string; onCreated: (c: QontakContact) => void }> = ({ phone, onCreated }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim()) { setError('First name is required.'); return; }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Enter a valid email address.'); return; }
    setBusy(true);
    setError('');
    try {
      const data = await qontakApi.createContact({ first_name: firstName.trim(), last_name: lastName.trim(), telephone: phone, email: email.trim() });
      if (ok(data) && data.content?.contact) onCreated(data.content.contact as QontakContact);
      else setError(data?.message || 'Could not create the contact.');
    } catch {
      setError('Qontak is unreachable. Try again later.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="qk-create" onSubmit={submit} noValidate>
      <div className="qk-create-row">
        <input className="qk-input" placeholder="First name *" value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-label="First name" />
        <input className="qk-input" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} aria-label="Last name" />
      </div>
      <input className="qk-input" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="Email" />
      <input className="qk-input" value={phone} readOnly aria-label="Phone" />
      {error && <p className="qk-error" role="alert">{error}</p>}
      <button type="submit" className="qk-btn qk-btn-primary" disabled={busy}>
        {busy ? <LoaderCircle size={14} className="qk-spin" aria-hidden="true" /> : <UserPlus size={14} aria-hidden="true" />}
        {busy ? 'Creating…' : 'Create contact'}
      </button>
    </form>
  );
};

const ContactCard: React.FC<{ c: QontakContact }> = ({ c }) => (
  <div className="qk-contact">
    <div className="qk-contact-name">{contactName(c)}</div>
    {c.job_title && <div className="qk-muted">{c.job_title}</div>}
    <ul className="qk-facts">
      {c.telephone && <li><Phone size={13} aria-hidden="true" /><span>{c.telephone}</span></li>}
      {c.email && <li><Mail size={13} aria-hidden="true" /><a href={`mailto:${c.email}`}>{c.email}</a></li>}
      {c.company_name && <li><Building2 size={13} aria-hidden="true" /><span>{c.company_name}</span></li>}
    </ul>
    {(c.owner_name || c.status_name) && (
      <div className="qk-muted qk-small">
        {c.owner_name && <>Owner: {c.owner_name}</>}
        {c.owner_name && c.status_name && ' · '}
        {c.status_name && <>Status: {c.status_name}</>}
      </div>
    )}
    {c.url && (
      <a className="qk-link" href={c.url} target="_blank" rel="noopener noreferrer">
        Open in Qontak <ExternalLink size={12} aria-hidden="true" />
      </a>
    )}
  </div>
);

// Calls already sent to RingQ transcription from this page (popup + call window share it).
const transcribeStarted = new Set<string>();

const JournalPanel: React.FC<{ localCallId: string }> = ({ localCallId }) => {
  const [journal, setJournal] = useState<QontakJournal | null>(null);
  const [error, setError] = useState('');
  const [showTranscript, setShowTranscript] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [aiRetrying, setAiRetrying] = useState(false);
  const [pollRound, setPollRound] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    let timer: number | undefined;
    const poll = async () => {
      tries += 1;
      try {
        const data = await qontakApi.getJournal(localCallId);
        if (cancelled) return;
        const j = ok(data) ? (data.content?.journal as QontakJournal | undefined) : undefined;
        if (j) { setJournal(j); setError(''); }
        // Recording linked + AI wanted: transcribe now with RingQ's own endpoint
        // (/reports/audiototext, as Call Logs does), then let Qontak pick it up.
        if (j && j.ai_status === 'pending' && j.call_uuid && !transcribeStarted.has(localCallId)) {
          transcribeStarted.add(localCallId);
          const callUuid = j.call_uuid;
          void (async () => {
            let err = '';
            try {
              const tx = await qontakApi.ringqTranscribe(callUuid);
              if (!ok(tx)) err = tx?.message || 'Transcription failed.';
            } catch {
              err = '';  // network hiccup: the server falls back to its own transcription
            }
            try {
              const done = await qontakApi.transcriptReady(localCallId, err);
              const nj = ok(done) ? (done.content?.journal as QontakJournal | undefined) : undefined;
              if (!cancelled && nj) setJournal(nj);
            } catch {
              // Polling keeps going; the background job adds the transcript.
            }
          })();
        }
        const settled = j && j.sync_status !== 'pending' && j.ai_status !== 'pending';
        // Transcription runs on the server after the call (can take a few minutes).
        if (!settled && tries < 300) timer = window.setTimeout(poll, 2000);
      } catch {
        if (!cancelled) {
          setError('Could not load the call journal.');
          if (tries < 60) timer = window.setTimeout(poll, 3000);
        }
      }
    };
    timer = window.setTimeout(poll, 1000);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [localCallId, pollRound]);

  const retryAi = async () => {
    setAiRetrying(true);
    try {
      const data = await qontakApi.retryAi(localCallId);
      if (ok(data) && data.content?.journal) { transcribeStarted.delete(localCallId); setJournal(data.content.journal as QontakJournal); setPollRound((n) => n + 1); }
      else setError(data?.message || 'Could not restart AI analysis.');
    } catch {
      setError('Could not restart AI analysis.');
    } finally {
      setAiRetrying(false);
    }
  };

  const retry = async () => {
    setRetrying(true);
    try {
      const data = await qontakApi.retrySync(localCallId);
      if (ok(data) && data.content?.journal) setJournal(data.content.journal as QontakJournal);
      else setError(data?.message || 'Retry failed.');
    } catch {
      setError('Retry failed. Qontak may be unavailable.');
    } finally {
      setRetrying(false);
    }
  };

  if (!journal) {
    return <div className="qk-journal qk-muted qk-small">{error || <><LoaderCircle size={12} className="qk-spin" aria-hidden="true" /> Logging call to Qontak…</>}</div>;
  }

  return (
    <div className="qk-journal">
      <div className="qk-journal-row">
        <span>Qontak log</span>
        <span className={`qk-pill qk-pill-${journal.sync_status}`}>
          {journal.sync_status === 'synced' ? 'Synced' : journal.sync_status === 'failed' ? 'Failed' : journal.sync_status === 'skipped' ? 'Skipped' : 'Pending'}
        </span>
      </div>
      {journal.sync_status === 'failed' && (
        <div className="qk-journal-err">
          <span className="qk-small">{journal.last_error || 'Sync failed.'}</span>
          <button type="button" className="qk-btn" onClick={retry} disabled={retrying}>
            <RefreshCw size={13} className={retrying ? 'qk-spin' : ''} aria-hidden="true" /> Retry
          </button>
        </div>
      )}
      {journal.sync_status === 'synced' && (
        <div className="qk-small qk-saved"><CircleCheck size={13} aria-hidden="true" /> Call saved to Qontak{journal.recording_available ? ' with recording link' : ''}.</div>
      )}
      {/* AI is optional background work: never presented as if the save were still running. */}
      {journal.ai_status === 'pending' && (
        <div className="qk-small qk-muted"><LoaderCircle size={12} className="qk-spin" aria-hidden="true" /> Transcribing the call; it will be added to the Qontak task when ready.</div>
      )}
      {journal.ai_status === 'failed' && (
        <div className="qk-journal-err">
          <span className="qk-small">AI analysis not available: {journal.ai_error || 'the call could not be transcribed.'}</span>
          <button type="button" className="qk-btn" onClick={retryAi} disabled={aiRetrying}>
            <RefreshCw size={13} className={aiRetrying ? 'qk-spin' : ''} aria-hidden="true" /> Retry AI
          </button>
        </div>
      )}
      {journal.summary && (
        <div className="qk-ai"><div className="qk-ai-label">Summary</div><p>{journal.summary}</p></div>
      )}
      {journal.sentiment && (
        <div className="qk-ai"><div className="qk-ai-label">Sentiment</div><span className={`qk-pill qk-sent-${journal.sentiment.toLowerCase()}`}>{journal.sentiment}</span></div>
      )}
      {journal.transcription && (
        <div className="qk-ai">
          <button type="button" className="qk-ai-toggle" aria-expanded={showTranscript} onClick={() => setShowTranscript((v) => !v)}>
            Transcription <ChevronDown size={13} aria-hidden="true" className={showTranscript ? 'qk-rot' : ''} />
          </button>
          {showTranscript && <p className="qk-transcript">{journal.transcription}</p>}
        </div>
      )}
    </div>
  );
};

export const QontakContactPopup: React.FC<Props> = ({
  call, lookup, selectedContact, canCreateContact, journaling, onSelectContact, onContactCreated, onRetryLookup, onClose, inline = false,
}) => {
  const [minimized, setMinimized] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => { setMinimized(false); setCreating(false); }, [call.localCallId]);

  const statusText = call.status === 'ringing'
    ? (call.direction === 'inbound' ? 'Incoming call' : 'Calling…')
    : call.status === 'active' ? 'In call' : (STATUS_LABEL[call.finalStatus || ''] || 'Ended');

  // Portal to <body>: outside every app stacking context, so nothing in the
  // dialer or call overlays can cover it.
  const panel = (
    <aside className={`qk-popup${inline ? ' qk-popup-inline' : ''}${minimized && !inline ? ' is-min' : ''}`} aria-label="Qontak contact" role="complementary">
      <header className="qk-head">
        <span className="qk-mark" aria-hidden="true">Q</span>
        <div className="qk-head-text">
          <div className="qk-title">{selectedContact ? contactName(selectedContact) : call.remoteNumber || 'Unknown number'}</div>
          <div className="qk-sub">
            <span className={`qk-dot qk-dot-${call.status}`} aria-hidden="true" />
            {statusText} · {call.direction === 'inbound' ? 'Inbound' : 'Outbound'}
          </div>
        </div>
        {!inline && (
          <button type="button" className="qk-icon" onClick={() => setMinimized((m) => !m)} aria-label={minimized ? 'Expand' : 'Minimize'}>
            <Minus size={15} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="qk-icon" onClick={onClose} aria-label="Close Qontak popup"><X size={15} aria-hidden="true" /></button>
      </header>

      {!minimized && (
        <div className="qk-body">
          {lookup.kind === 'loading' && (
            <div className="qk-skel" aria-busy="true"><span /><span /><span /></div>
          )}

          {lookup.kind === 'error' && (
            <div className="qk-state">
              <CircleAlert size={16} aria-hidden="true" />
              <span>{lookup.message}</span>
              <button type="button" className="qk-btn" onClick={onRetryLookup}><RefreshCw size={13} aria-hidden="true" /> Retry</button>
            </div>
          )}

          {lookup.kind === 'none' && (
            <div className="qk-state-col">
              <p className="qk-muted">No Qontak contact matches <strong>{call.remoteNumber}</strong>.</p>
              {canCreateContact && !creating && (
                <button type="button" className="qk-btn" onClick={() => setCreating(true)}><UserPlus size={13} aria-hidden="true" /> Create contact</button>
              )}
              {canCreateContact && creating && <CreateContactForm phone={call.remoteNumber} onCreated={onContactCreated} />}
            </div>
          )}

          {lookup.kind === 'found' && lookup.contacts.length > 1 && !selectedContact && (
            <div className="qk-state-col">
              <p className="qk-muted qk-small">{lookup.contacts.length} contacts share this number. Pick the right one to log the call against:</p>
              <ul className="qk-matches">
                {lookup.contacts.map((c) => (
                  <li key={String(c.id)}>
                    <button type="button" className="qk-match" onClick={() => onSelectContact(c)}>
                      <span className="qk-match-name">{contactName(c)}</span>
                      <span className="qk-muted qk-small">{[c.company_name, c.email].filter(Boolean).join(' · ') || c.telephone}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedContact && <ContactCard c={selectedContact} />}

          <dl className="qk-meta">
            <div><dt>Number</dt><dd>{call.remoteNumber || '—'}</dd></div>
            <div><dt>Started</dt><dd>{fmtTime(call.startedAt)}</dd></div>
            <div><dt>Answered</dt><dd>{fmtTime(call.answeredAt)}</dd></div>
            <div><dt>Agent</dt><dd>{agentLabel()}</dd></div>
          </dl>

          {call.status === 'ended' && journaling && <JournalPanel localCallId={call.localCallId} />}
        </div>
      )}
    </aside>
  );
  return inline ? panel : createPortal(panel, document.body);
};
