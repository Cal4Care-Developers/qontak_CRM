import React, { useCallback, useEffect, useId, useState } from 'react';
import { CircleAlert, CircleCheck, Eye, EyeOff, ExternalLink, LoaderCircle, LogOut, PlugZap, X } from 'lucide-react';
import { Button } from '../../components/base/buttons/button';
import { qontakApi, ok, QONTAK_CONFIG_CHANGED } from './qontakApi';
import type { QontakConfig, QontakConfigInput, QontakEnvironment } from './qontakApi';
import './qontak.css';

// Qontak CRM settings dialog. Rendered from IntegrationsModal (CRM tab) but
// self-contained: it loads and saves its own config through QontakController
// and reuses the page's `intg-` classes for a consistent look. The client
// secret never comes back from the server; the form only learns whether one
// is stored (`client_secret_set`) and leaving the field blank keeps it.

interface Props {
  onClose: () => void;
  /** Lets the CRM card refresh its badge after save/disconnect. */
  onStatusChange?: (status: QontakConfig['connection_status'], enabled: boolean) => void;
}

const browserTimeZone = (): string => {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
};

const timeZoneOptions = (current: string): string[] => {
  let zones: string[] = [];
  try { zones = (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('timeZone') : []; } catch { zones = []; }
  const all = new Set([current, browserTimeZone(), 'UTC', ...zones]);
  return Array.from(all).filter(Boolean).sort();
};

const DEFAULT_SCREENPOP_URL = 'https://chat.qontak.com/customers/{customer_id}';
const DEFAULT_UNKNOWN_URL = 'https://chat.qontak.com/customers/all-customers';

const DEFAULTS: QontakConfigInput = {
  enabled: false,
  environment: 'production',
  client_id: '',
  client_secret: '',
  crm_user_sso_id: '',
  popup_incoming: true,
  popup_outgoing: true,
  call_journaling: true,
  contact_creation: false,
  task_category_name: 'Call',
  ai_transcription: false,
  ai_summary: false,
  ai_sentiment: false,
  timezone: browserTimeZone(),
  screenpop_incoming: false,
  screenpop_outgoing: false,
  screenpop_url: DEFAULT_SCREENPOP_URL,
  screenpop_unknown_url: DEFAULT_UNKNOWN_URL,
  screenpop_target: 'qontak_task',
};

const fmtDate = (v: string | null | undefined) => {
  if (!v) return 'Never';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? v : d.toLocaleString();
};

export const QontakMark: React.FC = () => <span className="qk-logo-mark" aria-hidden="true">Q</span>;

const Switch: React.FC<{ id: string; title: string; description?: string; checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }> = ({
  id, title, description, checked, disabled, onChange,
}) => (
  <div className="intg-switch-row">
    <div className="intg-switch-text">
      <label htmlFor={id} className="intg-switch-title">{title}</label>
      {description && <span className="intg-switch-desc">{description}</span>}
    </div>
    <label className="intg-switch">
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className="intg-switch-track" aria-hidden="true" />
    </label>
  </div>
);

const StatusBadge: React.FC<{ status: QontakConfig['connection_status'] | undefined; enabled: boolean }> = ({ status, enabled }) => {
  if (status === 'connected' && enabled) return <span className="intg-badge intg-badge-success"><span className="intg-badge-dot" aria-hidden="true" />Connected</span>;
  if (status === 'connected') return <span className="intg-badge"><span className="intg-badge-dot" aria-hidden="true" />Disabled</span>;
  if (status === 'error') return <span className="intg-badge intg-badge-danger"><span className="intg-badge-dot" aria-hidden="true" />Connection error</span>;
  return <span className="intg-badge"><span className="intg-badge-dot" aria-hidden="true" />Not configured</span>;
};

const QontakSettingsDialog: React.FC<Props> = ({ onClose, onStatusChange }) => {
  const titleId = useId();
  const [form, setForm] = useState<QontakConfigInput>(DEFAULTS);
  const [config, setConfig] = useState<QontakConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [message, setMessage] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof QontakConfigInput, string>>>({});

  const applyConfig = useCallback((c: QontakConfig) => {
    setConfig(c);
    setForm({
      enabled: !!c.enabled,
      environment: c.environment === 'sandbox' ? 'sandbox' : 'production',
      client_id: c.client_id || '',
      client_secret: '',
      crm_user_sso_id: c.crm_user_sso_id || '',
      popup_incoming: !!c.popup_incoming,
      popup_outgoing: !!c.popup_outgoing,
      call_journaling: !!c.call_journaling,
      contact_creation: !!c.contact_creation,
      task_category_name: c.task_category_name || 'Call',
      ai_transcription: !!c.ai_transcription,
      ai_summary: !!c.ai_summary,
      ai_sentiment: !!c.ai_sentiment,
      // Never saved yet (server default UTC): suggest this computer's zone.
      timezone: c.timezone && c.timezone !== 'UTC' ? c.timezone : browserTimeZone(),
      screenpop_incoming: !!c.screenpop_incoming,
      screenpop_outgoing: !!c.screenpop_outgoing,
      screenpop_url: c.screenpop_url || DEFAULT_SCREENPOP_URL,
      screenpop_unknown_url: c.screenpop_unknown_url || '',
      screenpop_target: c.screenpop_target === 'window' || c.screenpop_target === 'qontak_tab' ? c.screenpop_target : 'qontak_task',
    });
    onStatusChange?.(c.connection_status, !!c.enabled);
  }, [onStatusChange]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await qontakApi.getConfig();
      if (ok(data) && data.content) applyConfig(data.content as QontakConfig);
      else setLoadError(data?.message || 'Could not load Qontak settings.');
    } catch {
      setLoadError('Could not reach the server to load Qontak settings.');
    } finally {
      setLoading(false);
    }
  }, [applyConfig]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = <K extends keyof QontakConfigInput>(key: K, value: QontakConfigInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
    setMessage(null);
  };

  const validate = (): boolean => {
    const next: typeof errors = {};
    if (!form.client_id.trim()) next.client_id = 'Client ID is required.';
    else if (!/^[\w.-]{4,128}$/.test(form.client_id.trim())) next.client_id = 'Client ID contains invalid characters.';
    if (!form.client_secret && !config?.client_secret_set) next.client_secret = 'Client Secret is required.';
    if (form.client_secret && form.client_secret.length > 256) next.client_secret = 'Client Secret is too long.';
    if (form.crm_user_sso_id && !/^[0-9a-fA-F-]{8,64}$/.test(form.crm_user_sso_id.trim())) next.crm_user_sso_id = 'Must be the user SSO ID (UUID) from Qontak.';
    if (!form.task_category_name.trim()) next.task_category_name = 'Task category is required.';
    const httpsUrl = /^https:\/\/[^\s<>"]+$/i;
    // Empty = use the standard Customer 360 address (filled in by payload()).
    if (form.screenpop_url.trim() && !httpsUrl.test(form.screenpop_url.trim())) next.screenpop_url = 'Must be an https:// address.';
    if (form.screenpop_unknown_url.trim() && !httpsUrl.test(form.screenpop_unknown_url.trim())) next.screenpop_unknown_url = 'Must be an https:// address.';
    setErrors(next);
    const problems = Object.values(next).filter(Boolean) as string[];
    if (problems.length) {
      // Never fail silently: say what is wrong and bring the first field into view.
      setMessage({ tone: 'err', text: `Not saved. Please fix: ${problems.join(' ')}` });
      const firstKey = Object.keys(next)[0];
      const ids: Record<string, string> = {
        client_id: 'intg-qk-client-id', client_secret: 'intg-qk-secret', crm_user_sso_id: 'intg-qk-sso',
        task_category_name: 'intg-qk-category', screenpop_url: 'intg-qk-sp-url', screenpop_unknown_url: 'intg-qk-sp-unknown',
      };
      window.setTimeout(() => {
        const el = document.getElementById(ids[firstKey] || '');
        el?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        (el as HTMLInputElement | null)?.focus?.();
      }, 0);
    }
    return problems.length === 0;
  };

  const payload = (): QontakConfigInput => ({
    ...form,
    client_id: form.client_id.trim(),
    crm_user_sso_id: form.crm_user_sso_id.trim(),
    task_category_name: form.task_category_name.trim(),
    screenpop_url: form.screenpop_url.trim() || DEFAULT_SCREENPOP_URL,
    screenpop_unknown_url: form.screenpop_unknown_url.trim(),
  });

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    setMessage(null);
    try {
      const data = await qontakApi.saveConfig(payload());
      if (ok(data)) {
        if (data.content) applyConfig(data.content as QontakConfig);
        setMessage({ tone: 'ok', text: data.message || 'Qontak settings saved.' });
        window.dispatchEvent(new Event(QONTAK_CONFIG_CHANGED));
      } else {
        setMessage({ tone: 'err', text: data?.message || 'Could not save Qontak settings.' });
      }
    } catch {
      setMessage({ tone: 'err', text: 'Could not reach the server. Nothing was saved.' });
    } finally {
      setSaving(false);
    }
  };

  const test = async () => {
    if (!validate()) return;
    setTesting(true);
    setMessage(null);
    try {
      // Tests the values in the form (secret blank = stored secret); does not save them.
      const data = await qontakApi.testConnection(payload());
      if (ok(data)) {
        setMessage({ tone: 'ok', text: data.message || 'Connected to Qontak successfully.' });
      } else {
        setMessage({ tone: 'err', text: data?.message || 'Qontak rejected the credentials.' });
      }
      if (data?.content?.config) applyConfig(data.content.config as QontakConfig);
    } catch {
      setMessage({ tone: 'err', text: 'Could not reach the server to test the connection.' });
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    setDisconnecting(true);
    setMessage(null);
    try {
      const data = await qontakApi.disconnect();
      if (ok(data)) {
        if (data.content) applyConfig(data.content as QontakConfig);
        setConfirmDisconnect(false);
        setMessage({ tone: 'ok', text: data.message || 'Qontak disconnected and credentials removed.' });
        window.dispatchEvent(new Event(QONTAK_CONFIG_CHANGED));
      } else {
        setMessage({ tone: 'err', text: data?.message || 'Could not disconnect Qontak.' });
      }
    } catch {
      setMessage({ tone: 'err', text: 'Could not reach the server.' });
    } finally {
      setDisconnecting(false);
    }
  };

  const canManage = config ? config.can_manage !== false : true;
  const busy = saving || testing || disconnecting;
  const aiAny = form.ai_transcription || form.ai_summary || form.ai_sentiment;

  return (
    <div className="intg-overlay" onClick={onClose}>
      <div className="intg-dialog intg-dialog-lg" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="intg-dialog-header">
          <span className="intg-logo intg-logo-icon" aria-hidden="true"><QontakMark /></span>
          <div className="intg-dialog-heading">
            <h2 id={titleId} className="intg-dialog-title">
              Qontak CRM settings
              {!loading && <StatusBadge status={config?.connection_status} enabled={form.enabled} />}
            </h2>
            <p className="intg-dialog-subtitle">Look up Qontak contacts during calls and log every call as a Qontak task.</p>
          </div>
          <Button size="sm" color="tertiary" iconLeading={X} aria-label="Close" onClick={onClose} className="intg-dialog-close" />
        </div>

        <div className="intg-dialog-body">
          {loading && (
            <div className="intg-state intg-state-neutral" role="status">
              <span className="intg-state-icon" aria-hidden="true"><LoaderCircle size={20} className="intg-spin" /></span>
              <p className="intg-state-title">Loading Qontak settings…</p>
            </div>
          )}

          {!loading && loadError && (
            <div className="qk-settings-msg is-err" role="alert">
              <CircleAlert size={16} aria-hidden="true" />
              <span style={{ flex: 1 }}>{loadError} You can still enter credentials below; saving needs the server side to be ready.</span>
              <Button size="sm" color="secondary" onClick={() => void load()}>Retry</Button>
            </div>
          )}

          {!loading && (
            <>
              {!canManage && (
                <div className="qk-settings-msg is-err" role="status">
                  <CircleAlert size={16} aria-hidden="true" />
                  <span>Only administrators can change Qontak settings.</span>
                </div>
              )}

              {message && (
                <div className={`qk-settings-msg ${message.tone === 'ok' ? 'is-ok' : 'is-err'}`} role={message.tone === 'ok' ? 'status' : 'alert'}>
                  {message.tone === 'ok' ? <CircleCheck size={16} aria-hidden="true" /> : <CircleAlert size={16} aria-hidden="true" />}
                  <span>{message.text}</span>
                </div>
              )}

              <div className="intg-panel">
                <dl className="qk-settings-status">
                  <div><dt>Status</dt><dd><StatusBadge status={config?.connection_status} enabled={form.enabled} /></dd></div>
                  <div><dt>Last tested</dt><dd>{fmtDate(config?.last_tested_at)}</dd></div>
                  <div><dt>Last successful sync</dt><dd>{fmtDate(config?.last_sync_at)}</dd></div>
                  {config?.last_error && <div><dt>Last error</dt><dd>{config.last_error}</dd></div>}
                </dl>
              </div>

              <div className="intg-panel intg-panel-list">
                <Switch id="qk-enabled" title="Enable Qontak integration" description="When off, the dialer works exactly as before and nothing is sent to Qontak." checked={form.enabled} disabled={!canManage} onChange={(v) => set('enabled', v)} />
              </div>

              <div className="intg-subsection">
                <h3 className="intg-subsection-title">API credentials</h3>
                <p className="intg-hint">
                  Use the HMAC <strong>Client ID</strong> and <strong>Client Secret</strong> created for Qontak CRM in the Mekari Developer Center
                  (your Qontak company owner requests access). Your Qontak dashboard login is not an API credential.
                </p>
                <div className="intg-form-grid">
                  <div className="intg-field">
                    <label className="intg-label" htmlFor="intg-qk-env">Environment</label>
                    <select id="intg-qk-env" className="intg-input qk-native-select" value={form.environment} disabled={!canManage}
                      onChange={(e) => set('environment', e.target.value as QontakEnvironment)}>
                      <option value="production">Production (api.mekari.com)</option>
                      <option value="sandbox">Sandbox (api.mekari.io)</option>
                    </select>
                  </div>
                  <div className="intg-field">
                    <label className="intg-label" htmlFor="intg-qk-client-id">Client ID<span className="intg-req" aria-hidden="true">*</span></label>
                    <input id="intg-qk-client-id" type="text" className="intg-input" value={form.client_id} disabled={!canManage}
                      onChange={(e) => set('client_id', e.target.value)} placeholder="Mekari HMAC client ID" autoComplete="off" spellCheck={false}
                      aria-invalid={!!errors.client_id} />
                    {errors.client_id && <p className="intg-hint qk-field-err" role="alert">{errors.client_id}</p>}
                  </div>
                  <div className="intg-field intg-field-full">
                    <label className="intg-label" htmlFor="intg-qk-secret">Client Secret<span className="intg-req" aria-hidden="true">*</span></label>
                    <div className="intg-input-affix">
                      <input id="intg-qk-secret" type={showSecret ? 'text' : 'password'} className="intg-input" value={form.client_secret} disabled={!canManage}
                        onChange={(e) => set('client_secret', e.target.value)}
                        placeholder={config?.client_secret_set ? '•••••••••••• (stored, leave blank to keep)' : 'Mekari HMAC client secret'}
                        autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other"
                        aria-invalid={!!errors.client_secret} />
                      <div className="intg-input-actions">
                        <button type="button" className="intg-icon-btn" onClick={() => setShowSecret((s) => !s)} aria-label={showSecret ? 'Hide client secret' : 'Show client secret'}>
                          {showSecret ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                        </button>
                      </div>
                    </div>
                    {errors.client_secret
                      ? <p className="intg-hint qk-field-err" role="alert">{errors.client_secret}</p>
                      : <p className="intg-hint">Stored encrypted on the server and never shown again.</p>}
                  </div>
                  <div className="intg-field intg-field-full">
                    <label className="intg-label" htmlFor="intg-qk-sso">Acting CRM user SSO ID<span className="intg-optional">(optional)</span></label>
                    <input id="intg-qk-sso" type="text" className="intg-input" value={form.crm_user_sso_id} disabled={!canManage}
                      onChange={(e) => set('crm_user_sso_id', e.target.value)} placeholder="e.g. 50c3d284-7b8b-460d-88bf-9cdde2bdbc26" autoComplete="off" spellCheck={false}
                      aria-invalid={!!errors.crm_user_sso_id} />
                    {errors.crm_user_sso_id
                      ? <p className="intg-hint qk-field-err" role="alert">{errors.crm_user_sso_id}</p>
                      : <p className="intg-hint">Sent as X-Crm-User-Sso-Id: the Qontak user that contacts and tasks are created as.</p>}
                  </div>
                </div>
              </div>

              <div className="intg-subsection">
                <h3 className="intg-subsection-title">Dialer</h3>
                <div className="intg-panel intg-panel-list">
                  <Switch id="qk-pop-in" title="Contact popup on incoming calls" checked={form.popup_incoming} disabled={!canManage} onChange={(v) => set('popup_incoming', v)} />
                  <Switch id="qk-pop-out" title="Contact popup on outgoing calls" checked={form.popup_outgoing} disabled={!canManage} onChange={(v) => set('popup_outgoing', v)} />
                  <Switch id="qk-journal" title="Call journaling" description="Log answered, missed, rejected and failed calls as Qontak tasks." checked={form.call_journaling} disabled={!canManage} onChange={(v) => set('call_journaling', v)} />
                  <Switch id="qk-create" title="Contact creation" description="Let agents create a Qontak contact for unknown numbers." checked={form.contact_creation} disabled={!canManage} onChange={(v) => set('contact_creation', v)} />
                </div>
                <div className="intg-form-grid" style={{ marginTop: 12 }}>
                  <div className="intg-field">
                    <label className="intg-label" htmlFor="intg-qk-category">Task category</label>
                    <input id="intg-qk-category" type="text" className="intg-input" value={form.task_category_name} disabled={!canManage}
                      onChange={(e) => set('task_category_name', e.target.value)} maxLength={60} autoComplete="off" aria-invalid={!!errors.task_category_name} />
                    {errors.task_category_name
                      ? <p className="intg-hint qk-field-err" role="alert">{errors.task_category_name}</p>
                      : <p className="intg-hint">Created in Qontak if it doesn't exist.</p>}
                  </div>
                  <div className="intg-field">
                    <label className="intg-label" htmlFor="intg-qk-tz">Time zone</label>
                    <select id="intg-qk-tz" className="intg-input qk-native-select" value={form.timezone} disabled={!canManage}
                      onChange={(e) => set('timezone', e.target.value)}>
                      {timeZoneOptions(form.timezone).map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                    <p className="intg-hint">Call times in Qontak tasks are written in this time zone.</p>
                  </div>
                </div>
              </div>

              <div className="intg-subsection">
                <h3 className="intg-subsection-title">CRM screen pop</h3>
                <p className="intg-hint">When a call comes in or goes out, automatically open the caller in Qontak. One tab/window is reused for every call. Allow pop-ups for this site in the browser.</p>
                <div className="intg-panel intg-panel-list">
                  <Switch id="qk-sp-in" title="Screen pop on incoming calls" checked={form.screenpop_incoming} disabled={!canManage} onChange={(v) => set('screenpop_incoming', v)} />
                  <Switch id="qk-sp-out" title="Screen pop on outgoing calls" checked={form.screenpop_outgoing} disabled={!canManage} onChange={(v) => set('screenpop_outgoing', v)} />
                </div>
                <div className="intg-form-grid" style={{ marginTop: 12 }}>
                  <div className="intg-field intg-field-full">
                    <label className="intg-label" htmlFor="intg-qk-sp-target">Screen pop opens</label>
                    <select id="intg-qk-sp-target" className="intg-input qk-native-select" value={form.screenpop_target} disabled={!canManage}
                      onChange={(e) => set('screenpop_target', (['window', 'qontak_tab'].includes(e.target.value) ? e.target.value : 'qontak_task') as QontakConfigInput['screenpop_target'])}>
                      <option value="qontak_task">This call&apos;s Qontak task (call details)</option>
                      <option value="qontak_tab">Qontak customer page</option>
                      <option value="window">RingQ call-details window</option>
                    </select>
                  </div>
                  <div className="intg-field intg-field-full">
                    <label className="intg-label" htmlFor="intg-qk-sp-url">Qontak contact page URL</label>
                    <input id="intg-qk-sp-url" type="text" className="intg-input" value={form.screenpop_url} disabled={!canManage}
                      onChange={(e) => set('screenpop_url', e.target.value)} autoComplete="off" spellCheck={false} aria-invalid={!!errors.screenpop_url} />
                    {errors.screenpop_url
                      ? <p className="intg-hint qk-field-err" role="alert">{errors.screenpop_url}</p>
                      : <p className="intg-hint">{'{customer_id}'} (Qontak Customer 360), {'{contact_id}'}, {'{slug}'} and {'{phone}'} are replaced for each call.</p>}
                  </div>
                  <div className="intg-field intg-field-full">
                    <label className="intg-label" htmlFor="intg-qk-sp-unknown">Unknown caller URL<span className="intg-optional">(optional)</span></label>
                    <input id="intg-qk-sp-unknown" type="text" className="intg-input" value={form.screenpop_unknown_url} disabled={!canManage}
                      onChange={(e) => set('screenpop_unknown_url', e.target.value)} placeholder="e.g. https://chat.qontak.com/customers/all-customers" autoComplete="off" spellCheck={false} aria-invalid={!!errors.screenpop_unknown_url} />
                    {errors.screenpop_unknown_url
                      ? <p className="intg-hint qk-field-err" role="alert">{errors.screenpop_unknown_url}</p>
                      : <p className="intg-hint">Opened when no Qontak contact matches the number. Leave empty to open nothing.</p>}
                  </div>
                </div>
              </div>

              <div className="intg-subsection">
                <h3 className="intg-subsection-title">AI call intelligence (optional)</h3>
                <p className="intg-hint">
                  Qontak CRM has no native transcription or sentiment API. These use RingQ's own call transcription service on the
                  recording, then add the results to the Qontak task. Off by default; nothing is processed while off.
                </p>
                <div className="intg-panel intg-panel-list">
                  <Switch id="qk-ai-tx" title="AI transcription" checked={form.ai_transcription} disabled={!canManage} onChange={(v) => set('ai_transcription', v)} />
                  <Switch id="qk-ai-sum" title="AI call summary" checked={form.ai_summary} disabled={!canManage} onChange={(v) => set('ai_summary', v)} />
                  <Switch id="qk-ai-sent" title="Sentiment analysis" checked={form.ai_sentiment} disabled={!canManage} onChange={(v) => set('ai_sentiment', v)} />
                </div>
                {aiAny && <p className="intg-hint">Requires call recording to be enabled for the extension or queue.</p>}
              </div>

              {confirmDisconnect && (
                <div className="qk-settings-msg is-err" role="alertdialog" aria-label="Confirm disconnect">
                  <CircleAlert size={16} aria-hidden="true" />
                  <span style={{ flex: 1 }}>Disconnect Qontak? Stored credentials are deleted and journaling stops. Existing call logs are kept.</span>
                  <Button size="sm" color="secondary" onClick={() => setConfirmDisconnect(false)} isDisabled={disconnecting}>Keep</Button>
                  <Button size="sm" color="primary" onClick={() => void disconnect()} isDisabled={disconnecting} isLoading={disconnecting} showTextWhileLoading>Disconnect</Button>
                </div>
              )}
            </>
          )}
        </div>

        <div className="intg-dialog-footer">
          <div className="intg-dialog-footer-start">
            {/* Result of Save/Test next to the buttons (the top banner can be scrolled out of view). */}
            {message && (
              <span className={`qk-footer-msg ${message.tone === 'ok' ? 'is-ok' : 'is-err'}`} role="status">
                {message.tone === 'ok' ? <CircleCheck size={14} aria-hidden="true" /> : <CircleAlert size={14} aria-hidden="true" />}
                {message.text}
              </span>
            )}
            {!message && !loading && !loadError && canManage && config?.client_secret_set && !confirmDisconnect && (
              <Button size="md" color="tertiary" iconLeading={LogOut} onClick={() => setConfirmDisconnect(true)} isDisabled={busy}>Disconnect</Button>
            )}
            {!config?.client_secret_set && (
              <a className="intg-help-link" href="https://developers.mekari.com/docs/kb/hmac-authentication" target="_blank" rel="noopener noreferrer">
                Mekari API credentials <ExternalLink size={14} aria-hidden="true" />
              </a>
            )}
          </div>
          <div className="intg-dialog-actions">
            <Button size="md" color="secondary" onClick={onClose}>Cancel</Button>
            <Button size="md" color="secondary" iconLeading={PlugZap} onClick={() => void test()} isDisabled={loading || busy || !canManage} isLoading={testing} showTextWhileLoading>
              {testing ? 'Testing…' : 'Test connection'}
            </Button>
            <Button size="md" color="primary" onClick={() => void save()} isDisabled={loading || busy || !canManage} isLoading={saving} showTextWhileLoading>
              {saving ? 'Saving…' : 'Save configuration'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QontakSettingsDialog;
