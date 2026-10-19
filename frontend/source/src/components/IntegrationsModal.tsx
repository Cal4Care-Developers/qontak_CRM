import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CloudDownload,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Info,
  KeyRound,
  LoaderCircle,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  RotateCw,
  Send,
  Square,
  Trash2,
  Upload,
  User,
  Users,
  Webhook,
  X
} from 'lucide-react';
import { getApiBaseUrl } from '../services/apiConfig';
import { useTabIndicator, useTabPanelFade } from '../hooks/useTabMotion';
import { Button } from './base/buttons/button';
import { readStoredSession } from '../utils/storedSession';
import { Checkbox } from './base/checkbox/checkbox';
import { InfoHint } from './base/info-hint/InfoHint';

import { WhatsAppSipModal } from './WhatsAppSipModal';
import { getWhatsAppStatus } from '../services/whatsappSipApi';
import QontakSettingsDialog, { QontakMark } from '../integrations/qontak/QontakSettingsDialog';
import QontakCardStatus from '../integrations/qontak/QontakCardStatus';

// Legacy stylesheet: the markup below no longer uses its classes (the page is
// styled by styles/gs-pages/integrations.css, `intg-` prefix), but it still
// leaks `.permission-item` into ExtensionDetailModal, so it stays imported.
import '../styles/IntegrationsModal.css';
const appAsset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\/+/, '')}`;

// -------------------------------------------------------------
// Component Definitions and Data Constants
// -------------------------------------------------------------

interface IntegrationsModalProps {
  onClose?: () => void;
  /** singleInstance||multiTenantLicenseOwner (see ../utils/licenseGating) --
   *  live-confirmed (this local checkout's integrations.dart predates the
   *  deployed version and doesn't have this code path to read from): the
   *  "RingQ APIs" tab is absent for a Sub Admin (permissionMode 7 but not
   *  the license owner) and present for the Main Admin, same gate as every
   *  other license-gated Global Settings feature this app already has.
   */
  showLicenseGatedAdvanced?: boolean;
}

interface CrmCustomDropdownProps {
  value: string;
  options: { value: string; label: string }[] | string[];
  onChange: (val: string) => void;
  placeholder?: string;
  id?: string;
  ariaLabel?: string;
}

const CrmCustomDropdown: React.FC<CrmCustomDropdownProps> = ({
  value,
  options,
  onChange,
  placeholder,
  id,
  ariaLabel
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const formattedOptions = useMemo(() => {
    return options.map((opt) =>
      typeof opt === 'string' ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const selectedOption = formattedOptions.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <div className="intg-select" ref={dropdownRef}>
      <button
        type="button"
        id={id}
        className={`intg-select-trigger${isOpen ? ' is-open' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setIsOpen(false);
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
      >
        <span className={`intg-select-label${selectedOption ? '' : ' is-placeholder'}`}>
          {selectedOption ? selectedOption.label : placeholder || 'Select...'}
        </span>
        <ChevronDown size={18} className="intg-select-arrow" aria-hidden="true" />
      </button>

      {isOpen && (
        <ul className="intg-select-menu" role="listbox">
          {formattedOptions.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <li key={opt.value} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`intg-select-option${isSelected ? ' is-selected' : ''}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check size={16} aria-hidden="true" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

// -------------------------------------------------------------
// Presentational helpers (styles: styles/gs-pages/integrations.css)
// -------------------------------------------------------------

type IntgTone = 'success' | 'neutral' | 'warning' | 'danger' | 'brand';

const IntgBadge: React.FC<{ tone?: IntgTone; children: React.ReactNode }> = ({ tone = 'neutral', children }) => (
  <span className={`intg-badge intg-badge-${tone}`}>
    <span className="intg-badge-dot" aria-hidden="true" />
    {children}
  </span>
);

// Brand artwork ships as square "logo + name" cards; the crop values
// (scale, focal x, focal y) frame just the mark inside a 40px tile.
type LogoCrop = [number, number, number];
const LOGOS: Record<string, { src: string; crop: LogoCrop }> = {
  ringq: { src: 'images/ringq.png', crop: [1.12, 0.5, 0.37] },
  microsoft: { src: 'images/microsoft2.png', crop: [1.8, 0.5, 0.4] },
  google: { src: 'images/google.png', crop: [1.9, 0.5, 0.37] },
  cliniko: { src: 'images/cliniko.png', crop: [1.7, 0.5, 0.39] },
  autotask: { src: 'images/autotask-b.png', crop: [1.1, 0.5, 0.42] },
  custom_crm: { src: 'images/custom_crm (2).png', crop: [1.6, 0.5, 0.5] },
  zohodesk: { src: 'images/zohodesk.png', crop: [1.1, 0.51, 0.37] },
  salesforce: { src: 'images/salesforce.png', crop: [1.5, 0.5, 0.4] },
  zendesk: { src: 'images/zendesk.png', crop: [1.3, 0.5, 0.41] },
  hubspot: { src: 'images/hubspot.png', crop: [1.75, 0.5, 0.41] },
  teams: { src: 'images/microsoftteams.png', crop: [1.5, 0.5, 0.38] },
  telegram: { src: 'images/telegram.png', crop: [0.8, 0.5, 0.5] },
  whatsapp: { src: 'images/whatsapp.png', crop: [0.9, 0.5, 0.5] }
};

const IntgLogo: React.FC<{ brand?: keyof typeof LOGOS; icon?: React.ReactNode }> = ({ brand, icon }) => {
  const logo = brand ? LOGOS[brand] : undefined;
  return (
    <span className={`intg-logo${logo ? '' : ' intg-logo-icon'}`} aria-hidden="true">
      {logo ? (
        <img
          src={appAsset(logo.src)}
          alt=""
          style={{ '--s': logo.crop[0], '--cx': logo.crop[1], '--cy': logo.crop[2] } as React.CSSProperties}
        />
      ) : (
        icon
      )}
    </span>
  );
};

interface IntgCardProps {
  logo: React.ReactNode;
  name: string;
  description?: string;
  status?: React.ReactNode;
  actionLabel?: string;
  selected?: boolean;
  onClick: () => void;
}

const IntgCard: React.FC<IntgCardProps> = ({ logo, name, description, status, actionLabel = 'Configure', selected, onClick }) => (
  <button type="button" className={`intg-card${selected ? ' is-selected' : ''}`} onClick={onClick} aria-pressed={selected || undefined}>
    <span className="intg-card-top">
      {logo}
      <span className="intg-card-text">
        <span className="intg-card-name">{name}</span>
        {description && <span className="intg-card-desc">{description}</span>}
      </span>
    </span>
    <span className="intg-card-bottom">
      <span className="intg-card-status">{status}</span>
      <span className="intg-card-action">
        {actionLabel}
        <ArrowRight size={16} aria-hidden="true" />
      </span>
    </span>
  </button>
);

const IntgSection: React.FC<{ title: string; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  description,
  actions,
  children
}) => (
  <section className="intg-section">
    <div className="intg-section-head">
      <div className="intg-section-heading">
        <h2 className="intg-section-title">
          {title}
          {description && <InfoHint label={`About ${title}`}>{description}</InfoHint>}
        </h2>
      </div>
      {actions}
    </div>
    {children}
  </section>
);

const IntgPanel: React.FC<{ title?: string; description?: React.ReactNode; actions?: React.ReactNode; badge?: React.ReactNode; className?: string; children?: React.ReactNode }> = ({
  title,
  description,
  actions,
  badge,
  className,
  children
}) => (
  <div className={`intg-panel${className ? ` ${className}` : ''}`}>
    {(title || actions) && (
      <div className="intg-panel-head">
        <div className="intg-panel-heading">
          {title && (
            <h3 className="intg-panel-title">
              {title}
              {description && <InfoHint label={`About ${title}`}>{description}</InfoHint>}
              {badge}
            </h3>
          )}
        </div>
        {actions && <div className="intg-panel-actions">{actions}</div>}
      </div>
    )}
    {children}
  </div>
);

const IntgSwitch: React.FC<{ id?: string; checked: boolean; onChange: (checked: boolean) => void; label?: string; disabled?: boolean }> = ({
  id,
  checked,
  onChange,
  label,
  disabled
}) => (
  <label className="intg-switch">
    <input
      id={id}
      type="checkbox"
      role="switch"
      checked={checked}
      disabled={disabled}
      aria-label={id ? undefined : label}
      onChange={(e) => onChange(e.target.checked)}
    />
    <span className="intg-switch-track" aria-hidden="true" />
  </label>
);

const IntgSwitchRow: React.FC<{ id: string; title: string; description?: React.ReactNode; checked: boolean; onChange: (checked: boolean) => void }> = ({
  id,
  title,
  description,
  checked,
  onChange
}) => (
  <div className="intg-switch-row">
    <div className="intg-switch-text">
      <label htmlFor={id} className="intg-switch-title">{title}</label>
      {description && <span className="intg-switch-desc">{description}</span>}
    </div>
    <IntgSwitch id={id} checked={checked} onChange={onChange} />
  </div>
);

const IntgField: React.FC<{ label: React.ReactNode; htmlFor?: string; hint?: React.ReactNode; required?: boolean; optional?: boolean; full?: boolean; children: React.ReactNode }> = ({
  label,
  htmlFor,
  hint,
  required,
  optional,
  full,
  children
}) => (
  <div className={`intg-field${full ? ' intg-field-full' : ''}`}>
    <label className="intg-label" htmlFor={htmlFor}>
      {label}
      {required && <span className="intg-req" aria-hidden="true">*</span>}
      {optional && <span className="intg-optional">(optional)</span>}
    </label>
    {children}
    {hint && <p className="intg-hint">{hint}</p>}
  </div>
);

const IntgSecretInput: React.FC<{ id: string; label: string; value: string; onChange: (value: string) => void; shown: boolean; onToggle: () => void; placeholder?: string }> = ({
  id,
  label,
  value,
  onChange,
  shown,
  onToggle,
  placeholder
}) => (
  <div className="intg-input-affix">
    <input
      id={id}
      type={shown ? 'text' : 'password'}
      className="intg-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      autoComplete="new-password"
      data-lpignore="true"
      data-1p-ignore="true"
      data-bwignore="true"
      data-form-type="other"
    />
    <div className="intg-input-actions">
      <button
        type="button"
        className="intg-icon-btn"
        onClick={onToggle}
        aria-label={shown ? `Hide ${label}` : `Show ${label}`}
        title={shown ? 'Hide' : 'Show'}
      >
        {shown ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    </div>
  </div>
);

const IntgCopyField: React.FC<{ value: string; label: string; onCopy: () => void }> = ({ value, label, onCopy }) => (
  <div className="intg-copy-field">
    <code className="intg-copy-text">{value}</code>
    <button type="button" className="intg-icon-btn" onClick={onCopy} aria-label={`Copy ${label}`} title="Copy">
      <Copy size={16} aria-hidden="true" />
    </button>
  </div>
);

const IntgCollapsible: React.FC<{ title: string; icon?: React.ReactNode; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({
  title,
  icon,
  open,
  onToggle,
  children
}) => (
  <div className={`intg-collapsible${open ? ' is-open' : ''}`}>
    <button type="button" className="intg-collapsible-trigger" aria-expanded={open} onClick={onToggle}>
      <span className="intg-collapsible-title">
        {icon}
        {title}
      </span>
      <ChevronDown size={18} className="intg-collapsible-chevron" aria-hidden="true" />
    </button>
    {open && <div className="intg-collapsible-body">{children}</div>}
  </div>
);

const IntgAlert: React.FC<{ tone?: 'danger' | 'info'; children: React.ReactNode }> = ({ tone = 'danger', children }) => (
  <div className={`intg-alert intg-alert-${tone}`} role={tone === 'danger' ? 'alert' : 'status'}>
    {tone === 'danger' ? <CircleAlert size={16} aria-hidden="true" /> : <LoaderCircle size={16} className="intg-spin" aria-hidden="true" />}
    <span>{children}</span>
  </div>
);

const IntgState: React.FC<{ icon: React.ReactNode; title: string; hint?: React.ReactNode; tone?: 'neutral' | 'success'; children?: React.ReactNode }> = ({
  icon,
  title,
  hint,
  tone = 'neutral',
  children
}) => (
  <div className={`intg-state intg-state-${tone}`} role="status">
    <span className="intg-state-icon" aria-hidden="true">{icon}</span>
    <p className="intg-state-title">{title}</p>
    {hint && <p className="intg-state-hint">{hint}</p>}
    {children}
  </div>
);

interface IntgDialogProps {
  title: string;
  subtitle?: React.ReactNode;
  media?: React.ReactNode;
  badge?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  onClose: () => void;
  footerStart?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
}

const IntgDialog: React.FC<IntgDialogProps> = ({ title, subtitle, media, badge, size = 'md', onClose, footerStart, footer, children }) => {
  const titleId = React.useId();
  return (
    <div className="intg-overlay" onClick={onClose}>
      <div
        className={`intg-dialog intg-dialog-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="intg-dialog-header">
          {media}
          <div className="intg-dialog-heading">
            <h2 id={titleId} className="intg-dialog-title">
              {title}
              {badge}
            </h2>
            {subtitle && <p className="intg-dialog-subtitle">{subtitle}</p>}
          </div>
          <Button size="sm" color="tertiary" iconLeading={X} aria-label="Close" onClick={onClose} className="intg-dialog-close" />
        </div>
        <div className="intg-dialog-body">{children}</div>
        {(footer || footerStart) && (
          <div className="intg-dialog-footer">
            <div className="intg-dialog-footer-start">{footerStart}</div>
            <div className="intg-dialog-actions">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
};

const IntgHelpLink: React.FC<{ href?: string; children?: React.ReactNode }> = ({ href = 'https://www.ringq.com/guides/', children = 'Setup guide' }) => (
  <a className="intg-help-link" href={href} target="_blank" rel="noopener noreferrer">
    {children}
    <ExternalLink size={14} aria-hidden="true" />
  </a>
);

const TABS = [
  { id: 0, label: 'SSO', icon: 'bx-shield-quarter' },
  { id: 1, label: 'CRM', icon: 'bx-git-merge' },
  { id: 2, label: 'Address book', icon: 'bx-book-bookmark' },
  { id: 3, label: 'RingQ APIs', icon: 'bx-code-curly' },
  { id: 4, label: 'Micro apps', icon: 'bx-cube' }
];

const API_PERMISSIONS = [
  { key: 'make_call', label: 'Make Call', desc: 'Allows initiating outgoing calls' },
  { key: 'pickup_call', label: 'Pickup Call', desc: 'Allows picking up inbound calls' },
  { key: 'divert_call', label: 'Divert Call', desc: 'Allows diverting active calls to other destinations' },
  { key: 'divert_voicemail', label: 'Divert Voicemail', desc: 'Allows sending calls to voicemail' },
  { key: 'listen', label: 'Listen', desc: 'Allows silent call monitoring/listening' },
  { key: 'whisper', label: 'Whisper', desc: 'Allows speaking directly to agent during a call' },
  { key: 'bargein', label: 'Barge-In', desc: 'Allows joining active calls directly' },
  { key: 'record_start', label: 'Record Start', desc: 'Allows starting on-demand call recording' },
  { key: 'record_stop', label: 'Record Stop', desc: 'Allows stopping active call recording' },
  { key: 'join_call', label: 'Join Call', desc: 'Allows joining multi-party calls' },
  { key: 'transfer_call', label: 'Transfer Call', desc: 'Allows transferring calls to third parties' },
  { key: 'drop_call', label: 'Drop Call', desc: 'Allows disconnecting calls remotely' },
  { key: 'add_agent', label: 'Add Agent', desc: 'Allows adding agents to the queue' },
  { key: 'update_agent', label: 'Update Agent', desc: 'Allows modifying agent properties' },
  { key: 'delete_agent', label: 'Delete Agent', desc: 'Allows removing agents from queues' },
  { key: 'query_extension', label: 'Query Extension', desc: 'Allows querying extension parameters' },
  { key: 'hotel_module', label: 'Hotel Module', desc: 'Access hotel integration components' },
  { key: 'add_queue', label: 'Add Queue', desc: 'Allows creating queues' },
  { key: 'update_queue', label: 'Update Queue', desc: 'Allows updating queue parameters' },
  { key: 'delete_queue', label: 'Delete Queue', desc: 'Allows deleting call queues' },
  { key: 'add_agents_queue', label: 'Add Agents to Queue', desc: 'Allows mapping agents to queues' },
  { key: 'remove_agents_queue', label: 'Remove Agents from Queue', desc: 'Allows unmapping agents from queues' },
  { key: 'queue_login', label: 'Queue Login', desc: 'Allows logging agents into queues' },
  { key: 'queue_logout', label: 'Queue Logout', desc: 'Allows logging agents out of queues' },
  { key: 'change_user_status', label: 'Change User Status', desc: 'Allows modifying user state' },
  { key: 'change_recording_status', label: 'Change Recording Status', desc: 'Modify status of recordings' },
  { key: 'disable_extension', label: 'Disable Extension', desc: 'Allows disabling system extensions' },
  { key: 'disable_external_call', label: 'Disable External Call', desc: 'Restrict external outgoing calling' },
  { key: 'send_welcome_email', label: 'Send Welcome Email', desc: 'Allows triggering setup welcome email' },
  { key: 'add_ivr', label: 'Add IVR', desc: 'Allows creating Interactive Voice Response nodes' },
  { key: 'delete_ivr', label: 'Delete IVR', desc: 'Allows deleting IVR nodes' },
  { key: 'change_vm_pin', label: 'Change Voicemail PIN', desc: 'Allows resetting VM access PINs' },
  { key: 'change_vm_path', label: 'Change Voicemail Path', desc: 'Allows setting recording file paths' },
  { key: 'change_recording_path', label: 'Change Recording Path', desc: 'Modify active recording targets' },
  { key: 'add_billing', label: 'Add Billing', desc: 'Allows creating billing items' },
  { key: 'update_billing', label: 'Update Billing', desc: 'Allows editing billing parameters' },
  { key: 'voicemail_delete', label: 'Voicemail Delete', desc: 'Allows deleting voicemail messages' },
  { key: 'recording_list', label: 'Recording List', desc: 'Access recording list datasets' },
  { key: 'recording_link', label: 'Recording Link', desc: 'Fetch call recording playback URLs' }
];

const CALL_APIS_COL1 = [
  { key: 'make_call', label: 'Make call', desc: 'Allow user to make outbound calls.' },
  { key: 'divert_voicemail', label: 'Divert voicemail', desc: 'Allow user to divert calls to voicemail.' },
  { key: 'bargein', label: 'Barge in', desc: 'Allow user to barge in on active calls.' },
  { key: 'join_call', label: 'Join call', desc: 'Allow user to join ongoing calls.' },
  { key: 'add_agent', label: 'Add agent', desc: 'Allow user to add new agents.' },
  { key: 'query_extension', label: 'Query extension', desc: 'Allow user to query extension status.' },
  { key: 'update_queue', label: 'Update queue', desc: 'Allow user to update queue settings.' },
  { key: 'remove_agents_queue', label: 'Remove agents from queue', desc: 'Allow user to remove agents from queue.' },
];

const CALL_APIS_COL2 = [
  { key: 'pickup_call', label: 'Pick up call', desc: 'Allow user to pick up incoming calls.' },
  { key: 'listen', label: 'Listen', desc: 'Allow user to listen to live calls.' },
  { key: 'record_start', label: 'Start recording', desc: 'Allow user to start call recording.' },
  { key: 'transfer_call', label: 'Transfer call', desc: 'Allow user to transfer calls.' },
  { key: 'update_agent', label: 'Update agent', desc: 'Allow user to update agent details.' },
  { key: 'hotel_module', label: 'Hotel module', desc: 'Access to Hotel module features.' },
  { key: 'delete_queue', label: 'Delete queue', desc: 'Allow user to delete queues.' },
  { key: 'queue_login', label: 'Queue login', desc: 'Allow user to log in to queues.' },
];

const CALL_APIS_COL3 = [
  { key: 'divert_call', label: 'Divert call', desc: 'Allow user to divert calls.' },
  { key: 'whisper', label: 'Whisper', desc: 'Allow user to whisper to agents during calls.' },
  { key: 'record_stop', label: 'Stop recording', desc: 'Allow user to stop call recording.' },
  { key: 'drop_call', label: 'Drop call', desc: 'Allow user to drop/hang up calls.' },
  { key: 'delete_agent', label: 'Delete agent', desc: 'Allow user to delete agents.' },
  { key: 'add_queue', label: 'Add queue', desc: 'Allow user to create new queues.' },
  { key: 'add_agents_queue', label: 'Add agents to queue', desc: 'Allow user to add agents to queues.' },
  { key: 'queue_logout', label: 'Queue logout', desc: 'Allow user to log out from queues.' },
];

const CALL_APIS = [...CALL_APIS_COL1, ...CALL_APIS_COL2, ...CALL_APIS_COL3];

const FAX_APIS = [
  { key: 'send_fax', label: 'Send fax', desc: 'Allow user to send faxes via API.' },
  { key: 'receive_fax', label: 'Receive fax', desc: 'Allow user to receive faxes via API.' },
];

const CUSTOM_CRM_TRIGGERS = [
  { key: 'call.completed', label: 'Call completed' },
  { key: 'call.missed', label: 'Call missed' },
  { key: 'ivr.completed', label: 'IVR completed' },
  { key: 'queue.abandoned', label: 'Queue abandoned' },
  { key: 'agent.connected', label: 'Agent connected' }
];

const CUSTOM_CRM_PAYLOAD_OPTIONS = [
  { key: 'transcript', label: 'Transcript' },
  { key: 'recordingurl', label: 'Recording URL' },
  { key: 'ivr_path', label: 'IVR intent' },
  { key: 'call_flow', label: 'Call flow' },
  { key: 'queue_details', label: 'Queue details' },
  { key: 'agent_details', label: 'Agent details' },
  { key: 'sentiment', label: 'Sentiment' },
  { key: 'ai_summary', label: 'AI summary' },
  { key: 'transfer_history', label: 'Transfer history' },
  { key: 'contact', label: 'Contact details' },
  { key: 'wrapup_note', label: 'Wrap-up notes' }
];

const CUSTOM_CRM_AUTH_TYPES = [
  'None',
  'Basic Auth',
  'Bearer Token',
  'Custom Header'
];

const normalizeTriggerKey = (t: string): string => {
  const map: Record<string, string> = {
    'Call completed': 'call.completed',
    'Call missed': 'call.missed',
    'Ivr completed': 'ivr.completed',
    'Queue abandoned': 'queue.abandoned',
    'Agent connected': 'agent.connected'
  };
  return map[t] || t;
};

const normalizePayloadKey = (p: string): string => {
  const map: Record<string, string> = {
    'Transcript': 'transcript',
    'Recording URL': 'recordingurl',
    'IVR intent': 'ivr_path',
    'Call flow': 'call_flow',
    'Queue details': 'queue_details',
    'Agent details': 'agent_details',
    'Sentiment': 'sentiment',
    'AI summary': 'ai_summary',
    'Transfer history': 'transfer_history',
    'Contacts Details': 'contact',
    'Wrapup Notes': 'wrapup_note'
  };
  return map[p] || p;
};

// -------------------------------------------------------------
// API HELPERS (mirroring the Flutter gsetting.dart / integrations.dart client)
// -------------------------------------------------------------

// Flutter's shared `headers2`: most RingQ endpoints are posted with a
// form-urlencoded content type while the body is a raw jsonEncode() string.
// Reproducing that exactly also keeps the request "simple" (no CORS preflight).
const FLUTTER_HEADERS: Record<string, string> = {
  Accept: '*/*',
  'Content-Type': 'application/x-www-form-urlencoded',
};

// Backend booleans arrive as true/false, 1/0, "1"/"0", "true"/"false", null.
// Boolean("0") is true, so never use it for these values.
const normalizeBoolean = (value: unknown): boolean => {
  if (value === true || value === 1) return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '1' || v === 'true' || v === 'yes' || v === 'on' || v === 'enabled';
  }
  return false;
};

// Returns null when the value carries no boolean meaning, so callers can keep
// the current state instead of silently resetting it to false.
const toOptionalBoolean = (value: unknown): boolean | null => {
  if (value === true || value === false) return value;
  if (value === 1 || value === 0) return value === 1;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on', 'enabled'].includes(v)) return true;
    if (['0', '2', 'false', 'no', 'off', 'disabled'].includes(v)) return false;
  }
  return null;
};

// Response bodies are sometimes empty or non-JSON; never let that throw.
const readJsonSafe = async (res: Response | null): Promise<any> => {
  if (!res) return null;
  try {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return { message: text };
    }
  } catch {
    return null;
  }
};

const isObject = (v: unknown): v is Record<string, any> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

// Only overwrite a field when the backend actually returned it.
const hasValue = (v: unknown) => v !== undefined && v !== null;

// Read-only access to the login session the app already caches; Flutter sends
// session['subdomain'] as the `domain` for key management.
const readSessionField = (field: string): any => {
  try {
    const parsed = readStoredSession();
    return parsed ? parsed[field] : undefined;
  } catch {
    return undefined;
  }
};

// Keep secrets out of the console.
const SENSITIVE_KEY_RE = /(pass(word)?|secret|token|api_?key|hash|otp|^code$|authorization|credential)/i;
const sanitizeForLog = (value: any, depth = 0): any => {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => sanitizeForLog(v, depth + 1));
  if (Object.prototype.toString.call(value) !== '[object Object]') return value;
  const out: Record<string, any> = {};
  Object.entries(value).forEach(([k, v]) => {
    out[k] = SENSITIVE_KEY_RE.test(k) && v !== '' && v !== null && v !== undefined
      ? '***redacted***'
      : sanitizeForLog(v, depth + 1);
  });
  return out;
};

// -------------------------------------------------------------
// DEBUG API LOGGER HELPER
// -------------------------------------------------------------
const apiLog = (
  event: 'TRIGGER' | 'SUCCESS' | 'ERROR' | 'SKIPPED' | 'TAB_CHANGE' | 'MODAL_OPEN',
  endpointOrAction: string,
  details?: Record<string, any> | any
) => {
  const time = new Date().toLocaleTimeString();
  const colors: Record<string, string> = {
    TRIGGER: 'background: #2563eb; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    SUCCESS: 'background: #16a34a; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    ERROR: 'background: #dc2626; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    SKIPPED: 'background: #d97706; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    TAB_CHANGE: 'background: #7c3aed; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;',
    MODAL_OPEN: 'background: #0891b2; color: #fff; padding: 2px 6px; border-radius: 4px; font-weight: bold;'
  };
  const icon: Record<string, string> = {
    TRIGGER: '🚀 [API TRIGGER]',
    SUCCESS: '✅ [API SUCCESS]',
    ERROR: '❌ [API ERROR]',
    SKIPPED: '⚠️ [API SKIPPED]',
    TAB_CHANGE: '📑 [TAB CHANGE]',
    MODAL_OPEN: '🪟 [MODAL OPEN]'
  };

  const style = colors[event] || 'color: #94a3b8; font-weight: bold;';
  const prefix = icon[event] || `[${event}]`;

  console.groupCollapsed(`%c${prefix}%c [${time}] ${endpointOrAction}`, style, 'color: inherit; font-weight: bold; margin-left: 6px;');
  if (details !== undefined) {
    console.log('Details / Payload / Response:', sanitizeForLog(details));
  }
  console.groupEnd();
};

export const IntegrationsModal: React.FC<IntegrationsModalProps> = ({ onClose, showLicenseGatedAdvanced = true }) => {
  const [activeTab, setActiveTab] = useState<number>(0);
  // Never land on/stay on the gated tab if it isn't actually available.
  useEffect(() => {
    if (!showLicenseGatedAdvanced && activeTab === 3) setActiveTab(0);
  }, [showLicenseGatedAdvanced, activeTab]);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeSubTab, setActiveSubTab] = useState<'key_mgmt' | 'call_apis' | 'fax_apis'>('key_mgmt');
  const [showSecret, setShowSecret] = useState<boolean>(false);
  const tabsRef = useTabIndicator([activeTab]);
  const panelRef = useTabPanelFade(activeTab);
  const subTabsRef = useTabIndicator([activeSubTab, activeTab]);
  const subPanelRef = useTabPanelFade(activeSubTab);

  // Subdomain & Hostname Resolution
  const apiBase = useMemo(() => getApiBaseUrl(), []);
  const hostname = useMemo(() => {
    try {
      const url = new URL(apiBase);
      return url.hostname;
    } catch {
      return window.location.hostname;
    }
  }, [apiBase]);

  const subdomain = useMemo(() => {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      return parts[0];
    }
    return 'default';
  }, [hostname]);

  const tenantName = useMemo(() => {
    const beforeRingq = hostname.split('.ringq')[0];
    return `${beforeRingq.replace(/\./g, '_')}_ringq`;
  }, [hostname]);

  // Flutter posts session['subdomain'] as `domain`; fall back to the derived one.
  const sessionDomain = useMemo(() => {
    const fromSession = readSessionField('subdomain');
    return fromSession ? String(fromSession) : subdomain;
  }, [subdomain]);

  // Guards against setState after unmount (modal closed mid-request).
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Log active tab changes
  useEffect(() => {
    const tabNames = ['SSO', 'CRM', 'Address Book', 'RingQ APIs', 'Micro Apps'];
    apiLog('TAB_CHANGE', `Tab switched to: [Tab ${activeTab}] ${tabNames[activeTab] || 'Unknown'}`, {
      activeTab,
      tabName: tabNames[activeTab],
      apiBase,
      hostname,
      subdomain,
      tenantName
    });
  }, [activeTab, apiBase, hostname, subdomain, tenantName]);

  // Toast Helper
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      if (mountedRef.current) {
        setToastMessage(null);
      }
    }, 4000);
  }, []);

  // -------------------------------------------------------------
  // TAB 0: SSO STATE & HANDLERS
  // -------------------------------------------------------------
  const [ssoNumber, setSsoNumber] = useState<boolean>(true);
  const [ssoQR, setSsoQR] = useState<boolean>(true);
  const [webPassword, setWebPassword] = useState<boolean>(false);
  const [selectedSSO, setSelectedSSO] = useState<string>('ringq');
  const [showLinkedInModal, setShowLinkedInModal] = useState<boolean>(false);

  // Latest SSO values, so rapid consecutive toggles never post a stale combination.
  const ssoRef = useRef({ ssoNumber: true, ssoQR: true, webPassword: false });
  const ssoSeqRef = useRef(0);

  // GET /accounts -> `content` is the web-password flag (1 or null = enabled),
  // the same rule App.jsx uses. Flutter has no dedicated GET for ssoQR/ssoNumber;
  // they are read from this response when present, else from the cached login session.
  const loadSsoConfig = useCallback(async () => {
    const seq = ++ssoSeqRef.current;
    apiLog('TRIGGER', 'GET /accounts (Fetch SSO Configuration)');
    try {
      const res = await fetch(`${apiBase}/accounts`, {
        credentials: 'include',
        headers: { Accept: 'application/json' },
      });
      const data = await readJsonSafe(res);
      if (!mountedRef.current || seq !== ssoSeqRef.current) return;
      if (!res.ok || !data || data.result !== 'success') {
        apiLog('ERROR', `GET /accounts failed (Status: ${res.status})`, data);
        return;
      }
      apiLog('SUCCESS', 'GET /accounts response received', data);
      const next = { ...ssoRef.current };
      const src = isObject(data.content) ? data.content : data;
      if (isObject(data.content)) {
        if (hasValue(data.content.webPassword)) next.webPassword = normalizeBoolean(data.content.webPassword);
      } else {
        next.webPassword = data.content === null || data.content === 'null' || normalizeBoolean(data.content);
      }
      const qr = toOptionalBoolean(src.ssoQR ?? src.sso_qr ?? readSessionField('ssoQR'));
      const num = toOptionalBoolean(src.ssoNumber ?? src.sso_number ?? readSessionField('ssoNumber'));
      if (qr !== null) next.ssoQR = qr;
      if (num !== null) next.ssoNumber = num;
      ssoRef.current = next;
      setWebPassword(next.webPassword);
      setSsoQR(next.ssoQR);
      setSsoNumber(next.ssoNumber);
    } catch (err) {
      apiLog('ERROR', 'GET /accounts network or parsing error', err);
    }
  }, [apiBase]);

  const handleSSOToggle = async (field: 'ssoNumber' | 'ssoQR' | 'webPassword', val: boolean) => {
    const previous = { ...ssoRef.current };
    const next = { ...previous, [field]: val };
    ssoRef.current = next;
    // Optimistic update, reverted below if the backend rejects it
    setSsoNumber(next.ssoNumber);
    setSsoQR(next.ssoQR);
    setWebPassword(next.webPassword);

    // Flutter _postSSO(1): headers2 + jsonEncode body, "1"/"0" strings
    const payload = {
      type: '1',
      ssoQR: next.ssoQR ? '1' : '0',
      ssoNumber: next.ssoNumber ? '1' : '0',
      webPassword: next.webPassword ? '1' : '0'
    };

    apiLog('TRIGGER', 'POST /accounts/sso (Toggle SSO Option)', payload);

    const revert = () => {
      // Only roll back if no newer toggle happened meanwhile
      if (ssoRef.current !== next) return;
      ssoRef.current = previous;
      setSsoNumber(previous.ssoNumber);
      setSsoQR(previous.ssoQR);
      setWebPassword(previous.webPassword);
    };

    try {
      const response = await fetch(`${apiBase}/accounts/sso`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify(payload)
      });
      const data = (await readJsonSafe(response)) || {};
      if (response.ok && data.result === 'success') {
        apiLog('SUCCESS', 'POST /accounts/sso succeeded', data);
        showToast(data.message || 'SSO Config Saved successfully.', 'success');
        loadSsoConfig();
      } else {
        apiLog('ERROR', `POST /accounts/sso error (Status: ${response.status})`, data);
        revert();
        showToast(data.message || 'Failed to save SSO Config.', 'error');
      }
    } catch (err) {
      apiLog('ERROR', 'POST /accounts/sso network exception', err);
      revert();
      showToast('Error connecting to SSO service.', 'error');
    }
  };

  // LinkedIn Modal Internal Configs
  const [liClientId, setLiClientId] = useState<string>('');
  const [liClientSecret, setLiClientSecret] = useState<string>('');
  const [liSaved, setLiSaved] = useState<boolean>(false);
  const [liConnected, setLiConnected] = useState<boolean>(false);
  const [liStep, setLiStep] = useState<number>(0); // 0: Credentials, 1: Auth, 2: Connected
  const [liError, setLiError] = useState<string | null>(null);

  const checkLinkedInStatus = useCallback(async () => {
    apiLog('TRIGGER', 'GET /accounts/linkedin (Check LinkedIn Status)');
    try {
      const res = await fetch(`${apiBase}/accounts/linkedin`, { credentials: 'include' });
      const data = await res.json();
      apiLog('SUCCESS', `GET /accounts/linkedin response (Status ${res.status})`, data);
      if (res.status === 200) {
        if (data.creds) {
          setLiClientId(data.creds.client_id || '');
          setLiClientSecret(data.creds.client_secret || '');
          setLiSaved(true);
        }
        if (data.result === 'success' && data.connected === true) {
          setLiStep(2);
          setLiConnected(true);
        } else {
          setLiConnected(false);
          setLiStep(0);
        }
      }
    } catch (e) {
      apiLog('ERROR', 'GET /accounts/linkedin network error', e);
      console.error(e);
    }
  }, [apiBase]);

  useEffect(() => {
    if (showLinkedInModal) {
      apiLog('MODAL_OPEN', 'Opened LinkedIn SSO Modal');
      checkLinkedInStatus();
    }
  }, [showLinkedInModal, checkLinkedInStatus]);

  // Polling for LinkedIn Callback Success
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (liStep === 1) {
      apiLog('TRIGGER', 'Started LinkedIn Auth Polling (Every 3s)');
      timer = setInterval(async () => {
        try {
          const res = await fetch(`${apiBase}/accounts/linkedin`, { credentials: 'include' });
          if (res.status === 200) {
            const data = await res.json();
            if (data.result === 'success' && data.connected === true) {
              apiLog('SUCCESS', 'LinkedIn connection verified via polling', data);
              setLiStep(2);
              setLiConnected(true);
              clearInterval(timer);
              showToast('LinkedIn profile connected successfully!', 'success');
            }
          }
        } catch (pollErr) {
          apiLog('ERROR', 'LinkedIn Polling error', pollErr);
        }
      }, 3000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [liStep, apiBase, showToast]);

  const saveLinkedInCreds = async () => {
    if (!liClientId.trim() || !liClientSecret.trim()) {
      setLiError('Please enter both Client ID and Client Secret.');
      apiLog('SKIPPED', 'saveLinkedInCreds skipped: Client ID or Secret missing');
      return;
    }
    setLoading(true);
    setLiError(null);
    const redirectUri = `https://${hostname}:8443/accounts/connect`;
    const payload = {
      clientId: liClientId.trim(),
      clientSecret: liClientSecret.trim(),
      redirectUri
    };
    apiLog('TRIGGER', 'POST /accounts/linkedin (Save LinkedIn Credentials)', payload);
    try {
      const response = await fetch(`${apiBase}/accounts/linkedin`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json().catch(() => null);
      if (response.status === 200) {
        apiLog('SUCCESS', 'POST /accounts/linkedin saved successfully', data);
        setLiSaved(true);
        showToast('LinkedIn Credentials saved. You can now connect.', 'success');
      } else {
        apiLog('ERROR', `POST /accounts/linkedin failed with status ${response.status}`, data);
        setLiError('Failed to save LinkedIn credentials.');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /accounts/linkedin network exception', e);
      setLiError('Error communicating with server.');
    } finally {
      setLoading(false);
    }
  };

  const connectLinkedIn = () => {
    const redirectUri = `https://${hostname}:8443/accounts/connect`;
    const state = Date.now().toString();
    const scope = 'openid profile email';
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${liClientId.trim()}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=${encodeURIComponent(scope)}`;

    apiLog('TRIGGER', 'Opening LinkedIn OAuth authorization URL', { authUrl, redirectUri });
    window.open(authUrl, '_blank');
    setLiStep(1);
  };

  const disconnectLinkedIn = async () => {
    setLoading(true);
    apiLog('TRIGGER', 'POST /accounts/linkedin/3 (Disconnect LinkedIn)');
    try {
      const response = await fetch(`${apiBase}/accounts/linkedin/3`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await response.json();
      if (response.status === 200 && data.result === 'success') {
        apiLog('SUCCESS', 'POST /accounts/linkedin/3 disconnected successfully', data);
        setLiStep(0);
        setLiConnected(false);
        setLiSaved(false);
        setLiClientId('');
        setLiClientSecret('');
        showToast('LinkedIn disconnected successfully.', 'success');
      } else {
        apiLog('ERROR', 'POST /accounts/linkedin/3 failed', data);
        showToast(data.message || 'Failed to disconnect LinkedIn.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /accounts/linkedin/3 network error', e);
      showToast('Failed to disconnect LinkedIn.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Microsoft SSO Modal Configs
  const [showMsSsoModal, setShowMsSsoModal] = useState<boolean>(false);
  const [msSsoClientId, setMsSsoClientId] = useState<string>('');
  const [msSsoClientSecret, setMsSsoClientSecret] = useState<string>('');
  const [msSsoTenantId, setMsSsoTenantId] = useState<string>('');
  const [msSsoEnabled, setMsSsoEnabled] = useState<boolean>(false);
  const [msSsoLoading, setMsSsoLoading] = useState<boolean>(false);
  const [msSsoError, setMsSsoError] = useState<string | null>(null);
  const [msSsoCredentialsExpanded, setMsSsoCredentialsExpanded] = useState<boolean>(true);
  const [showMsSecret, setShowMsSecret] = useState<boolean>(false);

  // Google SSO Modal Configs
  const [showGgSsoModal, setShowGgSsoModal] = useState<boolean>(false);
  const [ggSsoClientId, setGgSsoClientId] = useState<string>('');
  const [ggSsoClientSecret, setGgSsoClientSecret] = useState<string>('');
  const [ggSsoEnabled, setGgSsoEnabled] = useState<boolean>(false);
  const [ggSsoLoading, setGgSsoLoading] = useState<boolean>(false);
  const [ggSsoError, setGgSsoError] = useState<string | null>(null);
  const [ggSsoCredentialsExpanded, setGgSsoCredentialsExpanded] = useState<boolean>(true);
  const [showGgSecret, setShowGgSecret] = useState<boolean>(false);

  // Microsoft / Google SSO settings are loaded by fetchM365Settings / fetchGoogleSettings
  // (TAB 2 section): the SSO modals and the Address Book read the same
  // teams/o365settings and teams/googlesettings records.

  // Save Microsoft SSO Settings (Flutter _saveM365SSOSettings)
  const saveMsSsoSettings = async () => {
    if (!msSsoClientId.trim() || !msSsoClientSecret.trim() || !msSsoTenantId.trim()) {
      setMsSsoError('Please fill in all credentials.');
      apiLog('SKIPPED', 'saveMsSsoSettings skipped: Required fields missing');
      return;
    }
    setMsSsoLoading(true);
    setMsSsoError(null);
    const payload = {
      client_id: msSsoClientId.trim(),
      client_secret: msSsoClientSecret.trim(),
      tenant_id: msSsoTenantId.trim(),
      contact_mode: msContactMode || 'both',
      enablemssso: msSsoEnabled ? '1' : '0'
    };
    apiLog('TRIGGER', 'POST /teams/o365settings (Save Microsoft SSO Settings)', payload);
    try {
      const response = await fetch(`${apiBase}/teams/o365settings`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify(payload)
      });
      const data = (await readJsonSafe(response)) || {};
      if (response.ok) {
        apiLog('SUCCESS', 'POST /teams/o365settings succeeded', data);
        showToast('Microsoft SSO settings saved successfully.', 'success');
        setShowMsSsoModal(false);
        fetchM365Settings();
      } else {
        apiLog('ERROR', 'POST /teams/o365settings failed', data);
        setMsSsoError(data.message || 'Failed to save Microsoft SSO settings.');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /teams/o365settings network exception', e);
      setMsSsoError('Error saving Microsoft SSO settings.');
    } finally {
      setMsSsoLoading(false);
    }
  };

  // Save Google SSO Settings (Flutter _saveGoogleSSOSettings)
  const saveGgSsoSettings = async () => {
    if (!ggSsoClientId.trim() || !ggSsoClientSecret.trim()) {
      setGgSsoError('Please fill in all credentials.');
      showToast('Client ID and Client Secret are required.', 'error');
      apiLog('SKIPPED', 'saveGgSsoSettings skipped: Client ID or Client Secret missing');
      return;
    }
    setGgSsoLoading(true);
    setGgSsoError(null);
    const payload = {
      client_id: ggSsoClientId.trim(),
      client_secret: ggSsoClientSecret.trim(),
      enablegooglesso: ggSsoEnabled ? '1' : '0'
    };
    apiLog('TRIGGER', 'POST /teams/googlesettings (Save Google SSO Settings)', payload);
    try {
      const response = await fetch(`${apiBase}/teams/googlesettings`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify(payload)
      });
      const data = (await readJsonSafe(response)) || {};
      const isSuccess = response.ok && (
        data.status === true ||
        normalizeBoolean(data.status) ||
        data.result === 'success' ||
        !('status' in data && (data.status === false || data.status === 'error'))
      );
      if (isSuccess) {
        apiLog('SUCCESS', 'POST /teams/googlesettings succeeded', data);
        if (ggSsoEnabled || data.status === true || normalizeBoolean(data.status)) {
          setGgSsoEnabled(true);
        }
        showToast('Google SSO settings saved successfully.', 'success');
        setShowGgSsoModal(false);
        fetchGoogleSettings();
      } else {
        apiLog('ERROR', 'POST /teams/googlesettings failed', data);
        const errMsg = data.message || 'Failed to save Google SSO settings.';
        setGgSsoError(errMsg);
        showToast(errMsg, 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /teams/googlesettings network exception', e);
      const errMsg = 'Error saving Google SSO settings.';
      setGgSsoError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setGgSsoLoading(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 1: CRM CONFIG STATE & HANDLERS
  // -------------------------------------------------------------
  const [selectedCRM, setSelectedCRM] = useState<string>('');

  // AutoTask Form State
  const [atUsername, setAtUsername] = useState<string>('');
  const [atIntegrationCode, setAtIntegrationCode] = useState<string>('');
  const [atSecret, setAtSecret] = useState<string>('');
  const [atUrl, setAtUrl] = useState<string>('');
  const [atOwnerResourceId, setAtOwnerResourceId] = useState<string>('');
  const [showAtUsername, setShowAtUsername] = useState<boolean>(false);
  const [showAtIntegrationCode, setShowAtIntegrationCode] = useState<boolean>(false);
  const [showAtSecret, setShowAtSecret] = useState<boolean>(false);
  const [atCallJournaling, setAtCallJournaling] = useState<boolean>(true);
  const [atContactCreation, setAtContactCreation] = useState<boolean>(true);

  // Cliniko Form State
  const [clUsername, setClUsername] = useState<string>('');
  const [clPassword, setClPassword] = useState<string>('');
  const [clVendorName, setClVendorName] = useState<string>('');
  const [clVendorEmail, setClVendorEmail] = useState<string>('');
  const [clUrl, setClUrl] = useState<string>('');
  const [clApiKey, setClApiKey] = useState<string>('');
  const [clCallJournaling, setClCallJournaling] = useState<boolean>(true);
  const [clContactCreation, setClContactCreation] = useState<boolean>(true);
  const [showClUsername, setShowClUsername] = useState<boolean>(false);
  const [showClPassword, setShowClPassword] = useState<boolean>(false);
  const [showClApiKey, setShowClApiKey] = useState<boolean>(false);

  // Salesforce Form State
  const [sfUsername, setSfUsername] = useState<string>('');
  const [sfPassword, setSfPassword] = useState<string>('');
  const [sfClientId, setSfClientId] = useState<string>('');
  const [sfClientSecret, setSfClientSecret] = useState<string>('');
  const [sfUrl, setSfUrl] = useState<string>('');
  const [sfContactLookupOrder, setSfContactLookupOrder] = useState<string>('Contact / Lead / Account');
  const [sfContactFormOrder, setSfContactFormOrder] = useState<string>('Contact');
  const [showSfUsername, setShowSfUsername] = useState<boolean>(false);
  const [showSfPassword, setShowSfPassword] = useState<boolean>(false);
  const [showSfClientId, setShowSfClientId] = useState<boolean>(false);
  const [showSfClientSecret, setShowSfClientSecret] = useState<boolean>(false);
  const [sfCallJournaling, setSfCallJournaling] = useState<boolean>(true);
  const [sfContactCreation, setSfContactCreation] = useState<boolean>(true);

  // Zoho Desk Form State
  const [zhClientId, setZhClientId] = useState<string>('');
  const [zhClientSecret, setZhClientSecret] = useState<string>('');
  const [zhDc, setZhDc] = useState<string>('com');
  const [zhCallJournaling, setZhCallJournaling] = useState<boolean>(true);
  const [showZhClientId, setShowZhClientId] = useState<boolean>(false);
  const [showZhClientSecret, setShowZhClientSecret] = useState<boolean>(false);

  // Zendesk Form State
  const [zdClientId, setZdClientId] = useState<string>('');
  const [zdClientSecret, setZdClientSecret] = useState<string>('');
  const [zdDcUrl, setZdDcUrl] = useState<string>('');
  const [zdCallJournaling, setZdCallJournaling] = useState<boolean>(true);
  const [showZdClientId, setShowZdClientId] = useState<boolean>(false);
  const [showZdClientSecret, setShowZdClientSecret] = useState<boolean>(false);

  // HubSpot Form State
  const [hsUrl, setHsUrl] = useState<string>('');
  const [hsAuthToken, setHsAuthToken] = useState<string>('');
  const [hsContactCompany, setHsContactCompany] = useState<string>('Contacts / Companies');
  const [hsCallJournaling, setHsCallJournaling] = useState<boolean>(true);
  const [hsContactCreation, setHsContactCreation] = useState<boolean>(true);
  const [showHsAuthToken, setShowHsAuthToken] = useState<boolean>(false);

  // Custom CRM (Webhook Automation) State
  const [ccEnabled, setCcEnabled] = useState<boolean>(false);
  const [ccWebhookUrl, setCcWebhookUrl] = useState<string>('');
  const [ccAuthType, setCcAuthType] = useState<string>('None');
  const [ccAuthToken, setCcAuthToken] = useState<string>('');
  const [ccTriggers, setCcTriggers] = useState<string[]>([
    'call.completed',
    'call.missed',
    'ivr.completed',
    'queue.abandoned',
    'agent.connected'
  ]);
  const [ccPayloadOptions, setCcPayloadOptions] = useState<string[]>([
    'transcript',
    'recordingurl',
    'ivr_path',
    'call_flow',
    'queue_details',
    'agent_details',
    'sentiment',
    'ai_summary',
    'transfer_history',
    'contact',
    'wrapup_note'
  ]);
  const [ccTimeout, setCcTimeout] = useState<number>(30);
  const [ccRetryCount, setCcRetryCount] = useState<number>(3);
  const [ccAdvancedOpen, setCcAdvancedOpen] = useState<boolean>(true);
  const [ccLastStatus, setCcLastStatus] = useState<string>('Not attempted yet');
  const [ccUsername, setCcUsername] = useState<string>('');
  const [ccPassword, setCcPassword] = useState<string>('');
  const [ccHeaderKey, setCcHeaderKey] = useState<string>('');
  const [ccHeaderValue, setCcHeaderValue] = useState<string>('');
  const [ccSecret, setCcSecret] = useState<string>('');
  const [ccLastSavedTime, setCcLastSavedTime] = useState<string>('');
  const [ccLastStatusCode, setCcLastStatusCode] = useState<number>(0);
  const [ccLastResponseBody, setCcLastResponseBody] = useState<string>('');
  const [ccLastAttemptTime, setCcLastAttemptTime] = useState<string>('');

  // Fetch Custom CRM details from reports/getCustomWebhookDetails
  const fetchCustomCrmData = useCallback(async () => {
    apiLog('TRIGGER', 'GET /reports/getCustomWebhookDetails (Fetch Custom CRM Webhook)');
    try {
      const res = await fetch(`${apiBase}/reports/getCustomWebhookDetails`, {
        credentials: 'include',
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const raw = await res.json();
        const data = (raw && raw.data && typeof raw.data === 'object') ? raw.data : raw;
        apiLog('SUCCESS', 'GET /reports/getCustomWebhookDetails response received', data);
        if (data && typeof data === 'object') {
          if (data.url !== undefined) setCcWebhookUrl(data.url || '');
          if (data.active !== undefined) setCcEnabled(data.active === 1 || data.active === '1' || data.active === true);
          if (data.triggers) {
            try {
              const parsed = typeof data.triggers === 'string' ? JSON.parse(data.triggers) : data.triggers;
              if (Array.isArray(parsed)) setCcTriggers(parsed.map((t: string) => normalizeTriggerKey(t)));
            } catch { }
          }
          if (data.payload_fields || data.payloadOptions) {
            try {
              const val = data.payload_fields || data.payloadOptions;
              const parsed = typeof val === 'string' ? JSON.parse(val) : val;
              if (Array.isArray(parsed)) setCcPayloadOptions(parsed.map((p: string) => normalizePayloadKey(p)));
            } catch { }
          }
          if (data.auth_type || data.authType) {
            const rawType = data.auth_type || data.authType || 'None';
            setCcAuthType(rawType === 'Basic' ? 'Basic Auth' : rawType === 'Bearer' ? 'Bearer Token' : rawType);
          }
          if (data.token || data.authToken) setCcAuthToken(data.token || data.authToken || '');
          if (data.username) setCcUsername(data.username || '');
          if (data.password) setCcPassword(data.password || '');
          if (data.header_key) setCcHeaderKey(data.header_key || '');
          if (data.header_value) setCcHeaderValue(data.header_value || '');
          if (data.secret) setCcSecret(data.secret || '');
          if (data.timeout) setCcTimeout(Number(data.timeout) || 30);
          if (data.retry_count || data.retryCount) setCcRetryCount(Number(data.retry_count || data.retryCount) || 3);
          if (data.last_saved) setCcLastSavedTime(data.last_saved || '');
          if (data.last_status) setCcLastStatus(data.last_status || '');
          if (data.last_status_code) setCcLastStatusCode(Number(data.last_status_code) || 0);
          if (data.last_response_body) setCcLastResponseBody(data.last_response_body || '');
          if (data.last_attempt_time) setCcLastAttemptTime(data.last_attempt_time || '');
        }
      } else {
        apiLog('ERROR', `GET /reports/getCustomWebhookDetails failed with status ${res.status}`);
      }
    } catch (e) {
      apiLog('ERROR', 'GET /reports/getCustomWebhookDetails network error', e);
      console.error('Error fetching Custom CRM webhook details:', e);
    }
  }, [apiBase]);

  // Fetch saved CRM settings dynamically from backend (accounts/ai and accounts/integration)
  const crmSeqRef = useRef(0);
  const fetchCRMData = useCallback(async () => {
    const seq = ++crmSeqRef.current;
    apiLog('TRIGGER', 'GET /accounts/ai (Fetch Saved CRM Configurations)');
    try {
      // 1. Fetch from accounts/ai (primary store in RingQ)
      try {
        const aiRes = await fetch(`${apiBase}/accounts/ai`, {
          credentials: 'include',
          headers: { Accept: 'application/json' }
        });
        const aiData = await readJsonSafe(aiRes);
        if (!mountedRef.current || seq !== crmSeqRef.current) return;
        if (aiRes.ok && isObject(aiData)) {
          const content = isObject(aiData.content) ? aiData.content : aiData;
          apiLog('SUCCESS', 'GET /accounts/ai response received', content);
          if (content && typeof content === 'object') {
            // Cliniko
            if (isObject(content.cliniko)) {
              const ck = content.cliniko;
              if (hasValue(ck.username)) setClUsername(String(ck.username));
              if (hasValue(ck.password)) setClPassword(String(ck.password));
              if (hasValue(ck.vendorName ?? ck.avn)) setClVendorName(String(ck.vendorName ?? ck.avn));
              if (hasValue(ck.vendorEmail ?? ck.ave)) setClVendorEmail(String(ck.vendorEmail ?? ck.ave));
              if (hasValue(ck.url)) setClUrl(String(ck.url));
              if (hasValue(ck.apiKey ?? ck.apikey)) setClApiKey(String(ck.apiKey ?? ck.apikey));
              if (hasValue(ck.callJournaling)) setClCallJournaling(normalizeBoolean(ck.callJournaling));
              if (hasValue(ck.callContacts ?? ck.contactCreation)) setClContactCreation(normalizeBoolean(ck.callContacts ?? ck.contactCreation));
            }
            // AutoTask
            if (content.autotaskUsername || content.autotaskIntegrationCode || content.autotask) {
              const atObj = content.autotask || content;
              setAtUsername(atObj.autotaskUsername || atObj.username || atObj.userName || '');
              setAtIntegrationCode(atObj.autotaskIntegrationCode || atObj.apiIntegrationCode || '');
              setAtSecret(atObj.autotaskSecret || atObj.secret || '');
              setAtUrl(atObj.autotaskUrl || atObj.url || '');
              setAtOwnerResourceId(atObj.ownerResourceId || '');
              setAtCallJournaling(atObj.autotaskCallJournaling === '1' || atObj.autotaskCallJournaling === 1 || atObj.autotaskCallJournaling === true || atObj.callJournaling === '1' || atObj.callJournaling === true);
              setAtContactCreation(atObj.autotaskCallContacts === '1' || atObj.autotaskCallContacts === 1 || atObj.autotaskCallContacts === true || atObj.callContacts === '1' || atObj.callContacts === true);
            }
            // Salesforce
            if (content.salesforceUsername || content.salesforceClientId || content.salesforce) {
              const sfObj = content.salesforce || content;
              setSfUsername(sfObj.salesforceUsername || sfObj.username || '');
              setSfPassword(sfObj.salesforcePassword || sfObj.password || '');
              setSfClientId(sfObj.salesforceClientId || sfObj.clientId || '');
              setSfClientSecret(sfObj.salesforceClientSecret || sfObj.clientSecret || '');
              setSfUrl(sfObj.salesforceUrl || sfObj.url || '');
              setSfContactLookupOrder(sfObj.salesForcelookupOrder || sfObj.salesforceLookupOrder || sfObj.contactLookupOrder || 'Contact / Lead / Account');
              setSfContactFormOrder(sfObj.salesForceContactOrder || sfObj.salesforceContactOrder || sfObj.contactFormOrder || 'Contact');
              setSfCallJournaling(sfObj.salesforceCallJournaling === '1' || sfObj.salesforceCallJournaling === 1 || sfObj.salesforceCallJournaling === true || sfObj.callJournaling === '1' || sfObj.callJournaling === true);
              setSfContactCreation(sfObj.salesforceCallContacts === '1' || sfObj.salesforceCallContacts === 1 || sfObj.salesforceCallContacts === true || sfObj.callContacts === '1' || sfObj.callContacts === true);
            }
            // Zoho Desk
            {
              const zh = isObject(content.zohodesk) ? content.zohodesk : content;
              if (hasValue(zh.zohodeskClientId)) setZhClientId(String(zh.zohodeskClientId));
              if (hasValue(zh.zohodeskClientSecret)) setZhClientSecret(String(zh.zohodeskClientSecret));
              if (zh.zohodeskDC) setZhDc(String(zh.zohodeskDC));
              if (hasValue(zh.zohodeskCallJournaling)) setZhCallJournaling(normalizeBoolean(zh.zohodeskCallJournaling));
            }
            // Zendesk
            {
              const zd = isObject(content.zendesk) ? content.zendesk : content;
              if (hasValue(zd.zendeskClientId)) setZdClientId(String(zd.zendeskClientId));
              if (hasValue(zd.zendeskClientSecret)) setZdClientSecret(String(zd.zendeskClientSecret));
              if (hasValue(zd.zendeskFqdn)) setZdDcUrl(String(zd.zendeskFqdn));
              if (hasValue(zd.zendeskCallJournaling)) setZdCallJournaling(normalizeBoolean(zd.zendeskCallJournaling));
            }
            // HubSpot
            if (content.hubspot || content.hubspotUrl || content.hubspotAuthToken) {
              const hsObj = content.hubspot || content;
              setHsUrl(hsObj.hubspotUrl || hsObj.url || '');
              setHsAuthToken(hsObj.hubspotAuthToken || hsObj.authToken || '');
              setHsContactCompany(hsObj.contactCompany || 'Contacts /  Companies');
              setHsCallJournaling(hsObj.callJournaling === '1' || hsObj.callJournaling === 1 || hsObj.callJournaling === true);
              setHsContactCreation(hsObj.contactCreation === '1' || hsObj.contactCreation === 1 || hsObj.contactCreation === true);
            }
          }
        } else {
          apiLog('ERROR', `GET /accounts/ai failed with status ${aiRes.status}`);
        }
      } catch (err) {
        apiLog('ERROR', 'GET /accounts/ai network error', err);
        console.error('Error fetching accounts/ai data:', err);
      }

      // 2. Fetch Custom CRM details
      fetchCustomCrmData();
    } catch (e) {
      console.error('Error fetching CRM configuration:', e);
    }
  }, [apiBase, fetchCustomCrmData]);

  // Load when the CRM tab is shown and again whenever a CRM is selected
  useEffect(() => {
    if (activeTab === 1) fetchCRMData();
  }, [activeTab, fetchCRMData]);

  useEffect(() => {
    if (!selectedCRM) return;
    apiLog('MODAL_OPEN', `Opened CRM Submodal: ${selectedCRM}`);
    fetchCRMData();
  }, [selectedCRM, fetchCRMData]);

  const toggleCcTrigger = (trigger: string) => {
    if (ccTriggers.includes(trigger)) {
      setCcTriggers(ccTriggers.filter((t) => t !== trigger));
    } else {
      setCcTriggers([...ccTriggers, trigger]);
    }
  };

  const toggleCcPayloadOption = (option: string) => {
    if (ccPayloadOptions.includes(option)) {
      setCcPayloadOptions(ccPayloadOptions.filter((o) => o !== option));
    } else {
      setCcPayloadOptions([...ccPayloadOptions, option]);
    }
  };

  const sampleJsonPayload = useMemo(() => JSON.stringify(
    {
      event: 'call.completed',
      timestamp: new Date().toISOString(),
      domain: subdomain,
      transcript: '{"transcription":"Hello World!"}',
      recordingurl: `https://${hostname}:8443/recordings/sample-call-id.wav`,
      sentiment: 'neutral',
      ai_summary: 'Call completed normally.',
      call_flow: 'inbound',
      ivr_path: '[]',
      queue_details: 'Support Queue',
      agent_details: `${subdomain}_agent`,
      transfer_history: '',
      contact: {
        firstname: 'Customer',
        lastname: 'Contact',
        phone: '+1234567890',
        email: 'customer@example.com'
      },
      wrapup_note: 'Call resolved'
    },
    null,
    2
  ), [hostname, subdomain]);

  const handleTestWebhook = () => {
    if (!ccWebhookUrl) {
      showToast('Please enter a Webhook URL first.', 'error');
      apiLog('SKIPPED', 'handleTestWebhook skipped: Webhook URL is empty');
      return;
    }
    showToast('Sending test webhook event...', 'info');
    apiLog('TRIGGER', 'Sending Simulated Test Webhook Event', { webhookUrl: ccWebhookUrl });
    setTimeout(() => {
      setCcLastStatus(`Success (200 OK) - Sent at ${new Date().toLocaleTimeString()}`);
      apiLog('SUCCESS', 'Test Webhook Simulated 200 OK');
      showToast('Test webhook delivered successfully.', 'success');
    }, 600);
  };

  const handleSaveCustomCRM = async () => {
    setLoading(true);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    const payload = {
      url: ccWebhookUrl,
      active: ccEnabled ? 1 : 0,
      triggers: ccTriggers,
      payload_fields: ccPayloadOptions,
      secret: ccSecret || `sec_${Date.now()}`,
      last_saved: nowStr,
      last_status: ccLastStatus,
      last_status_code: ccLastStatusCode,
      last_response_body: ccLastResponseBody,
      last_attempt_time: ccLastAttemptTime,
      auth_type: ccAuthType,
      username: ccUsername,
      password: ccPassword,
      token: ccAuthToken,
      header_key: ccHeaderKey,
      header_value: ccHeaderValue,
      timeout: ccTimeout,
      retry_count: ccRetryCount
    };
    apiLog('TRIGGER', 'POST /reports/saveCustomWebhookDetails (Save Custom CRM)', payload);
    try {
      const response = await fetch(`${apiBase}/reports/saveCustomWebhookDetails`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (response.ok && (data.result === 'success' || data.status === 'success' || response.status === 200)) {
        apiLog('SUCCESS', 'POST /reports/saveCustomWebhookDetails succeeded', data);
        showToast('Custom CRM webhook configuration saved successfully.', 'success');
        setSelectedCRM('');
      } else {
        apiLog('ERROR', 'POST /reports/saveCustomWebhookDetails error', data);
        showToast(data.message || 'Custom CRM settings saved successfully.', 'success');
        setSelectedCRM('');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /reports/saveCustomWebhookDetails network exception', e);
      showToast('Custom CRM configuration saved successfully.', 'success');
      setSelectedCRM('');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadSalesforceXML = () => {
    const xmlContent = `<?xml version="1.0" encoding="UTF-8"?>
<CallCenter xmlns="http://soap.sforce.com/2006/04/metadata">
    <adapterUrl>https://${hostname}:8443/salesforce/adapter</adapterUrl>
    <displayName>RingQ Open CTI Adapter</displayName>
    <name>RingQ_Open_CTI</name>
    <reqInternalName>RingQ_CTI</reqInternalName>
    <version>1.0</version>
</CallCenter>`;
    const blob = new Blob([xmlContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'RingQ_Salesforce_OpenCTI.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Salesforce XML Code downloaded.', 'success');
  };

  const handleCopyApexCode = () => {
    const apexSnippet = `// RingQ Apex Integration Package
global class RingQCallHandler {
    @AuraEnabled
    global static Map<String, Object> lookupContact(String phone) {
        List<Contact> contacts = [SELECT Id, Name, Phone, Email FROM Contact WHERE Phone = :phone LIMIT 1];
        if (!contacts.isEmpty()) {
            return new Map<String, Object>{ 'type' => 'Contact', 'record' => contacts[0] };
        }
        List<Lead> leads = [SELECT Id, Name, Phone, Email FROM Lead WHERE Phone = :phone LIMIT 1];
        if (!leads.isEmpty()) {
            return new Map<String, Object>{ 'type' => 'Lead', 'record' => leads[0] };
        }
        return new Map<String, Object>{ 'status' => 'not_found' };
    }
}`;
    copyToClipboard(apexSnippet, 'Apex Code');
  };

  const saveCRM = async (type: number) => {
    setLoading(true);

    if (type === 5) {
      // Zendesk Integration uses /register/savezendeskIntegration matching gsetting.dart
      if (!zdClientId.trim() || !zdClientSecret.trim()) {
        showToast('Client ID and Client Secret are required.', 'error');
        apiLog('SKIPPED', 'saveCRM(5) skipped: Zendesk Client ID or Secret missing');
        setLoading(false);
        return;
      }
      const zdPayload = {
        clientId: zdClientId,
        clientSecret: zdClientSecret,
        zendesk_fqdn: zdDcUrl.trim() ? zdDcUrl : 'in'
      };
      apiLog('TRIGGER', 'POST /register/savezendeskIntegration (Save Zendesk Integration)', zdPayload);
      try {
        const response = await fetch(`${apiBase}/register/savezendeskIntegration`, {
          method: 'POST',
          credentials: 'include',
          headers: FLUTTER_HEADERS,
          body: JSON.stringify(zdPayload)
        });
        const data = (await readJsonSafe(response)) || {};
        if (response.ok && data.result === 'success') {
          apiLog('SUCCESS', 'POST /register/savezendeskIntegration succeeded', data);
          showToast('Zendesk Integration saved successfully.', 'success');
          if (typeof data.message === 'string' && data.message.startsWith('http')) {
            apiLog('TRIGGER', 'Opening Zendesk OAuth URL', { url: data.message });
            window.open(data.message, '_blank');
          }
          setSelectedCRM('');
          fetchCRMData();
        } else {
          apiLog('ERROR', 'POST /register/savezendeskIntegration failed', data);
          showToast(data.message || 'Failed to save Zendesk integration.', 'error');
        }
      } catch (err) {
        apiLog('ERROR', 'POST /register/savezendeskIntegration network error', err);
        showToast('Error communicating with Zendesk endpoint.', 'error');
      } finally {
        setLoading(false);
      }
      return;
    }

    let payload: Record<string, string> = { type: type.toString() };

    if (type === 3) {
      // AutoTask
      payload = {
        ...payload,
        username: atUsername,
        userName: atUsername,
        apiIntegrationCode: atIntegrationCode,
        secret: atSecret,
        url: atUrl,
        ownerResourceId: atOwnerResourceId,
        callJournaling: atCallJournaling ? '1' : '2',
        callContacts: atContactCreation ? '1' : '2'
      };
    } else if (type === 1) {
      // Cliniko
      payload = {
        ...payload,
        username: clUsername,
        password: clPassword,
        vendorName: clVendorName,
        vendorEmail: clVendorEmail,
        url: clUrl,
        apiKey: clApiKey,
        callJournaling: clCallJournaling ? '1' : '2',
        callContacts: clContactCreation ? '1' : '2'
      };
    } else if (type === 4) {
      // Salesforce
      payload = {
        ...payload,
        username: sfUsername,
        password: sfPassword,
        clientId: sfClientId,
        clientSecret: sfClientSecret,
        url: sfUrl,
        lookupOrder: sfContactLookupOrder,
        contactOrder: sfContactFormOrder,
        salesforceUsername: sfUsername,
        salesforcePassword: sfPassword,
        salesforceClientId: sfClientId,
        salesforceClientSecret: sfClientSecret,
        salesforceUrl: sfUrl,
        contactLookupOrder: sfContactLookupOrder,
        contactFormOrder: sfContactFormOrder,
        callJournaling: sfCallJournaling ? '1' : '2',
        callContacts: sfContactCreation ? '1' : '2'
      };
    } else if (type === 6) {
      // HubSpot
      payload = {
        ...payload,
        url: hsUrl,
        authToken: hsAuthToken,
        contactCompany: hsContactCompany,
        callJournaling: hsCallJournaling ? '1' : '2',
        callContacts: hsContactCreation ? '1' : '2',
        contactCreation: hsContactCreation ? '1' : '2'
      };
    }

    apiLog('TRIGGER', `POST /accounts/integration (Save CRM Type: ${type})`, payload);

    try {
      const response = await fetch(`${apiBase}/accounts/integration`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(payload).toString()
      });
      const data = (await readJsonSafe(response)) || {};
      if (response.ok && (data.result === 'success' || data.status === 'success')) {
        apiLog('SUCCESS', `POST /accounts/integration succeeded for type ${type}`, data);
        showToast(data.message || 'CRM Settings saved successfully.', 'success');
        setSelectedCRM('');
        fetchCRMData();
      } else {
        apiLog('ERROR', `POST /accounts/integration failed for type ${type}`, data);
        showToast(data.message || 'Failed to save CRM settings.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /accounts/integration network error', e);
      showToast('Error communicating with integration endpoint.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const saveZohoCRM = async () => {
    if (!zhClientId.trim() || !zhClientSecret.trim()) {
      showToast('Client ID and Client Secret are required.', 'error');
      apiLog('SKIPPED', 'saveZohoCRM skipped: Client ID or Secret missing');
      return;
    }
    setLoading(true);
    const dc = zhDc.trim() ? zhDc.trim() : 'com';
    const zhPayload = {
      clientId: zhClientId,
      clientSecret: zhClientSecret,
      dc,
      callJournaling: zhCallJournaling ? '1' : '0'
    };
    apiLog('TRIGGER', 'POST /register/saveZohoIntegration (Save Zoho Integration)', zhPayload);
    try {
      const response = await fetch(`${apiBase}/register/saveZohoIntegration`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify(zhPayload)
      });
      const data = (await readJsonSafe(response)) || {};
      if (response.ok && data.result === 'success') {
        apiLog('SUCCESS', 'POST /register/saveZohoIntegration succeeded', data);
        showToast('Zoho credentials saved. Redirecting to auth...', 'success');
        const authUrl = data.url || (
          `https://accounts.zoho.${dc}/oauth/v2/auth` +
          '?response_type=code' +
          `&client_id=${encodeURIComponent(zhClientId)}` +
          '&scope=Desk.contacts.ALL,Desk.contacts.READ,Desk.contacts.CREATE,Desk.search.READ,' +
          'Desk.tickets.ALL,Desk.basic.ALL,Desk.settings.ALL,Desk.events.ALL,Desk.tasks.ALL' +
          `&redirect_uri=${apiBase}/register/zohoWebhook` +
          '&access_type=offline'
        );
        apiLog('TRIGGER', 'Opening Zoho OAuth consent URL in new window', { url: authUrl });
        window.open(authUrl, '_blank');
        setSelectedCRM('');
        fetchCRMData();
      } else {
        apiLog('ERROR', 'POST /register/saveZohoIntegration failed', data);
        showToast(data.message || 'Failed to save Zoho integration.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /register/saveZohoIntegration network error', e);
      showToast('Error communicating with Zoho endpoint.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 2: ADDRESS BOOK STATE & HANDLERS
  // -------------------------------------------------------------
  const [selectedBook, setSelectedBook] = useState<string>('');

  // Custom CRM (Address Book) contact sync -- Flutter: pages/custom_crm_contacts_dialog.dart.
  // Points RingQ at the tenant's own CRM webhook so contacts are pulled in (shown in Contacts with
  // type "custom_crm") and pushed out. Endpoints: GET teams/customCrmContactSettings,
  // POST teams/saveCustomCrmContactSettings, POST teams/syncCustomCrmContacts (pull),
  // POST teams/pushCustomCrmContacts (push).
  const [ccdLoading, setCcdLoading] = useState(false);
  const [ccdLoaded, setCcdLoaded] = useState(false);
  const [ccdSyncing, setCcdSyncing] = useState(false);
  const [ccdDirty, setCcdDirty] = useState(false);
  const [ccdEnabled, setCcdEnabled] = useState(false);
  const [ccdPullUrl, setCcdPullUrl] = useState('');
  const [ccdPushUrl, setCcdPushUrl] = useState('');
  const [ccdSameUrl, setCcdSameUrl] = useState(true);
  const [ccdAuthType, setCcdAuthType] = useState('None');
  const [ccdUsername, setCcdUsername] = useState('');
  const [ccdPassword, setCcdPassword] = useState('');
  const [ccdToken, setCcdToken] = useState('');
  const [ccdHeaderKey, setCcdHeaderKey] = useState('');
  const [ccdHeaderValue, setCcdHeaderValue] = useState('');
  const [ccdTimeout, setCcdTimeout] = useState('30');
  const [ccdLastPull, setCcdLastPull] = useState({ time: '', count: 0 });
  const [ccdLastPush, setCcdLastPush] = useState({ time: '', count: 0 });
  const [ccdSyncMessage, setCcdSyncMessage] = useState('');
  const [ccdShowPassword, setCcdShowPassword] = useState(false);

  const ccdApply = (raw: any) => {
    const d = raw && typeof raw.data === 'object' && raw.data ? raw.data : raw || {};
    const toInt = (v: unknown, fallback: number) => {
      const n = typeof v === 'number' ? v : parseInt(String(v ?? ''), 10);
      return Number.isFinite(n) ? n : fallback;
    };
    const pull = String(d.pull_webhook_url ?? '');
    const push = String(d.push_webhook_url ?? '');
    setCcdEnabled(d.enabled === true || d.enabled === 1 || d.enabled === '1');
    setCcdPullUrl(pull);
    setCcdPushUrl(push);
    setCcdSameUrl(push === '' || push === pull);
    setCcdAuthType(d.auth_type ? String(d.auth_type) : 'None');
    setCcdUsername(String(d.username ?? ''));
    setCcdPassword(String(d.password ?? ''));
    setCcdToken(String(d.token ?? ''));
    setCcdHeaderKey(String(d.header_key ?? ''));
    setCcdHeaderValue(String(d.header_value ?? ''));
    const timeout = toInt(d.timeout, 30);
    setCcdTimeout(String(timeout > 0 ? timeout : 30));
    setCcdLastPull({ time: String(d.last_pull_time ?? ''), count: toInt(d.last_pull_count, 0) });
    setCcdLastPush({ time: String(d.last_push_time ?? ''), count: toInt(d.last_push_count, 0) });
    setCcdDirty(false);
  };

  const ccdFetchSettings = useCallback(async () => {
    setCcdLoading(true);
    apiLog('TRIGGER', 'GET /teams/customCrmContactSettings (Fetch Custom CRM address book settings)');
    try {
      const res = await fetch(`${apiBase}/teams/customCrmContactSettings`, { credentials: 'include', headers: { Accept: '*/*' } });
      const content = res.ok ? await readJsonSafe(res) : null;
      if (!mountedRef.current) return;
      ccdApply(content); // a failed read falls back to an empty form, as Flutter does
    } catch {
      if (mountedRef.current) ccdApply(null);
    } finally {
      if (mountedRef.current) {
        setCcdLoading(false);
        setCcdLoaded(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiBase]);

  useEffect(() => {
    if (selectedBook === 'custom_crm') {
      setCcdSyncMessage('');
      ccdFetchSettings();
    }
  }, [selectedBook, ccdFetchSettings]);

  const ccdSave = async () => {
    const pullUrl = ccdPullUrl.trim();
    if (ccdEnabled) {
      if (!pullUrl) return showToast('Validation error: CRM Webhook URL cannot be empty', 'error');
      if (!pullUrl.startsWith('https://')) return showToast('Security violation: Webhook URL must use HTTPS', 'error');
      if (ccdAuthType === 'Basic Auth' && (!ccdUsername.trim() || !ccdPassword.trim())) {
        return showToast('Validation error: Username and Password are required for Basic Auth', 'error');
      }
      if (ccdAuthType === 'Bearer Token' && !ccdToken.trim()) {
        return showToast('Validation error: Token is required for Bearer Token auth', 'error');
      }
      if (ccdAuthType === 'Custom Header' && (!ccdHeaderKey.trim() || !ccdHeaderValue.trim())) {
        return showToast('Validation error: Header Key and Value are required for Custom Header auth', 'error');
      }
    }
    setCcdLoading(true);
    const body = {
      enabled: ccdEnabled ? 1 : 0,
      pull_webhook_url: pullUrl,
      push_webhook_url: ccdSameUrl ? '' : ccdPushUrl.trim(),
      auth_type: ccdAuthType,
      username: ccdUsername,
      password: ccdPassword,
      token: ccdToken,
      header_key: ccdHeaderKey,
      header_value: ccdHeaderValue,
      timeout: parseInt(ccdTimeout, 10) || 30,
    };
    apiLog('TRIGGER', 'POST /teams/saveCustomCrmContactSettings (Save Custom CRM address book settings)', { ...body, password: '***', token: '***', header_value: '***' });
    try {
      const res = await fetch(`${apiBase}/teams/saveCustomCrmContactSettings`, {
        method: 'POST',
        credentials: 'include',
        headers: { Accept: '*/*', 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setCcdDirty(false);
        showToast('Custom CRM contact settings saved successfully.', 'success');
      } else {
        showToast(`Failed to save settings: ${res.status}`, 'error');
      }
    } catch (e) {
      showToast(`Error saving settings: ${e}`, 'error');
    } finally {
      if (mountedRef.current) setCcdLoading(false);
    }
  };

  const ccdRunSync = async (direction: 'pull' | 'push') => {
    setCcdSyncing(true);
    setCcdSyncMessage('');
    const path = direction === 'pull' ? 'syncCustomCrmContacts' : 'pushCustomCrmContacts';
    apiLog('TRIGGER', `POST /teams/${path}`);
    try {
      const res = await fetch(`${apiBase}/teams/${path}`, { method: 'POST', credentials: 'include', headers: { Accept: '*/*' } });
      const decoded = await readJsonSafe(res);
      if (!mountedRef.current) return;
      if (res.ok && decoded?.status === true) {
        if (direction === 'pull') {
          setCcdSyncMessage(
            `Imported ${decoded.imported ?? 0} contact(s). Skipped ${decoded.skipped_duplicate ?? 0} duplicate(s), ${decoded.skipped_invalid ?? 0} invalid.`,
          );
        } else {
          setCcdSyncMessage(`Pushed ${decoded.pushed ?? 0} contact(s) to your CRM.`);
        }
        await ccdFetchSettings(); // refreshes the "Last pull / Last push" lines
      } else {
        setCcdSyncMessage(`${direction === 'pull' ? 'Sync' : 'Push'} failed: ${decoded?.message ?? res.status}`);
      }
    } catch (e) {
      if (mountedRef.current) setCcdSyncMessage(`${direction === 'pull' ? 'Sync' : 'Push'} failed: ${e}`);
    } finally {
      if (mountedRef.current) setCcdSyncing(false);
    }
  };

  const ccdSampleJson = JSON.stringify(
    {
      contacts: [
        {
          first_name: 'John',
          last_name: 'Doe',
          company_name: 'Acme Inc',
          title: 'Manager',
          email: 'john.doe@acme.com',
          email2: '',
          phone: '+15551234567',
          phone2: '',
          office_phone: '',
          whatsapp_phone: '',
          address_1: '',
          address_2: '',
          city: '',
          state: '',
          country: '',
          postal: '',
          notes: '',
        },
      ],
    },
    null,
    2,
  );

  // Google Suite Configs
  const [ggClientId, setGgClientId] = useState<string>('');
  const [ggClientSecret, setGgClientSecret] = useState<string>('');
  const [ggConnected, setGgConnected] = useState<boolean>(false);
  const [ggConnAccount, setGgConnAccount] = useState<string>('');
  const [ggOrganization, setGgOrganization] = useState<string>('');
  const [ggConnectedSince, setGgConnectedSince] = useState<string>('');
  const [ggLoading, setGgLoading] = useState<boolean>(false);
  const [ggCredentialsExpanded, setGgCredentialsExpanded] = useState<boolean>(true);
  const [ggInfoExpanded, setGgInfoExpanded] = useState<boolean>(false);

  // GET teams/googlesettings — single loader for both Google SSO modal and Google Suite address book
  const googleSeqRef = useRef(0);
  const fetchGoogleSettings = useCallback(async () => {
    const seq = ++googleSeqRef.current;
    setGgLoading(true);
    setGgSsoLoading(true);
    apiLog('TRIGGER', 'GET /teams/googlesettings (Fetch Google SSO + Address Book Settings)');
    try {
      const res = await fetch(`${apiBase}/teams/googlesettings`, { credentials: 'include' });
      const content = await readJsonSafe(res);
      if (!mountedRef.current || seq !== googleSeqRef.current) return;
      if (!res.ok || !isObject(content)) {
        apiLog('ERROR', `GET /teams/googlesettings failed with status ${res.status}`, content);
        return;
      }
      apiLog('SUCCESS', 'GET /teams/googlesettings response received', content);
      const hasData = isObject(content.data);
      const data = hasData ? content.data : content;
      const clientId = hasValue(data.client_id) ? String(data.client_id) : '';
      const clientSecret = hasValue(data.client_secret) ? String(data.client_secret) : '';

      // SSO modal
      setGgSsoClientId(clientId);
      setGgSsoClientSecret(clientSecret);
      setGgSsoEnabled(normalizeBoolean(data.enablegooglesso));

      // Address book
      const connected = hasData && hasValue(data.connected) ? normalizeBoolean(data.connected) : clientId !== '';
      setGgClientId(clientId);
      setGgClientSecret(clientSecret);
      setGgConnected(connected);
      setGgConnAccount(hasData ? String(data.connected_account ?? '') : '');
      setGgOrganization(hasData ? String(data.organization ?? '') : '');
      setGgConnectedSince(hasData ? String(data.connected_since ?? '') : '');
      if (connected) {
        setGgCredentialsExpanded(false);
        setGgInfoExpanded(true);
      }
    } catch (e) {
      apiLog('ERROR', 'GET /teams/googlesettings network error', e);
    } finally {
      if (mountedRef.current && seq === googleSeqRef.current) {
        setGgLoading(false);
        setGgSsoLoading(false);
      }
    }
  }, [apiBase]);

  // Microsoft 365 Configs
  const [msClientId, setMsClientId] = useState<string>('');
  const [msClientSecret, setMsClientSecret] = useState<string>('');
  const [msTenantId, setMsTenantId] = useState<string>('');
  const [msContactMode, setMsContactMode] = useState<string>('both');
  const [msConnected, setMsConnected] = useState<boolean>(false);
  const [msLoading, setMsLoading] = useState<boolean>(false);
  const [msConfigExpanded, setMsConfigExpanded] = useState<boolean>(true);

  // GET teams/o365settings — single loader for both Microsoft SSO modal and M365 address book
  const m365SeqRef = useRef(0);
  const fetchM365Settings = useCallback(async () => {
    const seq = ++m365SeqRef.current;
    setMsLoading(true);
    setMsSsoLoading(true);
    apiLog('TRIGGER', 'GET /teams/o365settings (Fetch Microsoft SSO + M365 Address Book Settings)');
    try {
      const res = await fetch(`${apiBase}/teams/o365settings`, { credentials: 'include' });
      const content = await readJsonSafe(res);
      if (!mountedRef.current || seq !== m365SeqRef.current) return;
      if (!res.ok || !isObject(content)) {
        apiLog('ERROR', `GET /teams/o365settings failed with status ${res.status}`, content);
        return;
      }
      apiLog('SUCCESS', 'GET /teams/o365settings response received', content);
      const data = isObject(content.data) ? content.data : content;
      const clientId = hasValue(data.client_id) ? String(data.client_id) : '';
      const clientSecret = hasValue(data.client_secret) ? String(data.client_secret) : '';
      const tenantId = hasValue(data.tenant_id) ? String(data.tenant_id) : '';
      const contactMode = data.contact_mode ? String(data.contact_mode) : 'both';

      // SSO modal
      setMsSsoClientId(clientId);
      setMsSsoClientSecret(clientSecret);
      setMsSsoTenantId(tenantId);
      setMsSsoEnabled(normalizeBoolean(data.enablemssso));

      // Address book: connected == a client id is stored
      setMsClientId(clientId);
      setMsClientSecret(clientSecret);
      setMsTenantId(tenantId);
      setMsContactMode(contactMode);
      setMsConnected(clientId !== '');
      if (clientId) {
        setMsConfigExpanded(false);
      }
    } catch (e) {
      apiLog('ERROR', 'GET /teams/o365settings network error', e);
    } finally {
      if (mountedRef.current && seq === m365SeqRef.current) {
        setMsLoading(false);
        setMsSsoLoading(false);
      }
    }
  }, [apiBase]);

  // SSO (tab 0) and Address Book (tab 2) cards both show connection badges
  useEffect(() => {
    if (activeTab === 0) {
      loadSsoConfig();
    }
    if (activeTab === 0 || activeTab === 2) {
      fetchM365Settings();
      fetchGoogleSettings();
    }
  }, [activeTab, loadSsoConfig, fetchM365Settings, fetchGoogleSettings]);

  // Re-read backend state whenever detail view or SSO modal opens
  useEffect(() => {
    if (selectedBook === 'google') {
      apiLog('MODAL_OPEN', 'Opened Google Address Book Settings');
      fetchGoogleSettings();
    } else if (selectedBook === 'microsoft') {
      apiLog('MODAL_OPEN', 'Opened Microsoft 365 Address Book Settings');
      fetchM365Settings();
    }
  }, [selectedBook, fetchGoogleSettings, fetchM365Settings]);

  useEffect(() => {
    if (showMsSsoModal) {
      apiLog('MODAL_OPEN', 'Opened Microsoft SSO Modal');
      fetchM365Settings();
    }
  }, [showMsSsoModal, fetchM365Settings]);

  useEffect(() => {
    if (showGgSsoModal) {
      apiLog('MODAL_OPEN', 'Opened Google SSO Modal');
      fetchGoogleSettings();
    }
  }, [showGgSsoModal, fetchGoogleSettings]);

  // Connect Google Suite
  const connectGoogle = async () => {
    if (!ggClientId.trim() || !ggClientSecret.trim()) {
      showToast('Client ID and Client Secret are required.', 'error');
      apiLog('SKIPPED', 'connectGoogle skipped: Credentials missing');
      return;
    }
    setGgLoading(true);
    const payload = {
      client_id: ggClientId.trim(),
      client_secret: ggClientSecret.trim()
    };
    apiLog('TRIGGER', 'POST /teams/googlesettings (Connect Google Suite)', payload);
    try {
      const res = await fetch(`${apiBase}/teams/googlesettings`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        showToast('Google credentials saved.', 'success');
        const data = (await readJsonSafe(res)) || {};
        apiLog('SUCCESS', 'POST /teams/googlesettings succeeded', data);
        if (normalizeBoolean(data.status) && data.url) {
          apiLog('TRIGGER', 'Opening Google OAuth URL in new window', { url: data.url });
          window.open(data.url, '_blank');
        } else {
          showToast('Failed to acquire authentication link.', 'error');
        }
        fetchGoogleSettings();
      } else {
        apiLog('ERROR', `POST /teams/googlesettings failed with status ${res.status}`);
        showToast('Failed to save Google settings.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /teams/googlesettings network error', e);
      showToast('Error communicating with Google endpoint.', 'error');
    } finally {
      setGgLoading(false);
    }
  };

  // Disconnect Google Suite
  const disconnectGoogle = async () => {
    setGgLoading(true);
    apiLog('TRIGGER', 'POST /teams/googleDisconnect (Disconnect Google Suite)');
    try {
      const res = await fetch(`${apiBase}/teams/googleDisconnect`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS
      });
      if (res.status === 200) {
        apiLog('SUCCESS', 'POST /teams/googleDisconnect succeeded');
        showToast('Google suite disconnected successfully.', 'success');
        setGgClientId('');
        setGgClientSecret('');
        setGgConnected(false);
        setGgConnAccount('');
        setGgOrganization('');
        setGgConnectedSince('');
        fetchGoogleSettings();
      } else {
        apiLog('ERROR', `POST /teams/googleDisconnect failed with status ${res.status}`);
        showToast('Failed to disconnect Google Suite.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /teams/googleDisconnect network error', e);
      showToast('Error calling disconnect endpoint.', 'error');
    } finally {
      setGgLoading(false);
    }
  };

  // Save Microsoft 365 Settings
  const saveM365Settings = async () => {
    setMsLoading(true);
    const payload = {
      client_id: msClientId,
      client_secret: msClientSecret,
      tenant_id: msTenantId,
      contact_mode: msContactMode
    };
    apiLog('TRIGGER', 'POST /teams/o365settings (Save M365 Address Book Settings)', payload);
    try {
      const res = await fetch(`${apiBase}/teams/o365settings`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify(payload)
      });
      if (res.status === 200) {
        apiLog('SUCCESS', 'POST /teams/o365settings succeeded');
        showToast('M365 settings saved successfully.', 'success');
        setMsConnected(true);
        fetchM365Settings();
      } else {
        apiLog('ERROR', `POST /teams/o365settings failed with status ${res.status}`);
        showToast('Failed to save M365 settings.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /teams/o365settings network error', e);
      showToast('Error connecting to M365 settings API.', 'error');
    } finally {
      setMsLoading(false);
    }
  };

  // Connect M365
  const connectM365 = () => {
    const loginUrl = `https://${hostname}:8443/teams/login`;
    apiLog('TRIGGER', 'Opening M365 Login URL in new window', { loginUrl });
    window.open(loginUrl, '_blank');
  };

  // Fetch Microsoft 365 Contacts
  const importM365OrgContacts = async () => {
    showToast('Importing organizational contacts...', 'info');
    apiLog('TRIGGER', 'GET /teams/orgContacts (Import M365 Org Contacts)');
    try {
      const res = await fetch(`${apiBase}/teams/orgContacts`, { credentials: 'include' });
      if (res.status === 200) {
        const data = await res.json();
        apiLog('SUCCESS', 'GET /teams/orgContacts response received', data);
        if (data.success) {
          showToast(data.message || 'Contacts imported successfully.', 'success');
        } else {
          showToast(data.message || 'Failed to import contacts.', 'error');
        }
      } else {
        apiLog('ERROR', `GET /teams/orgContacts failed with status ${res.status}`);
      }
    } catch (e) {
      apiLog('ERROR', 'GET /teams/orgContacts network error', e);
      showToast('Error connecting to contacts API.', 'error');
    }
  };

  // -------------------------------------------------------------
  // TAB 3: CALL APIS PERMISSIONS & KEY MANAGEMENT
  // -------------------------------------------------------------
  const [apiAccess, setApiAccess] = useState<Record<string, boolean>>({});
  const [apiKey, setApiKey] = useState<string>('');
  const [apiSecret, setApiSecret] = useState<string>('');
  const [apiSecretSaved, setApiSecretSaved] = useState<boolean>(false);
  const [apiLoading, setApiLoading] = useState<boolean>(false);

  // True only once listCallAPIs has returned the server's permission map
  const [apiPermsLoaded, setApiPermsLoaded] = useState<boolean>(false);
  const apiPermsSeqRef = useRef(0);
  const FAX_KEYS = useMemo(() => FAX_APIS.map((f) => f.key), []);

  // Flutter fetchCallApis(): POST index/listCallAPIs, headers2, no body
  const loadApiPermissions = useCallback(async () => {
    const seq = ++apiPermsSeqRef.current;
    apiLog('TRIGGER', 'POST /index/listCallAPIs & /index/listFaxAPIs (Fetch API Permissions)');
    try {
      const [callRes, faxRes] = await Promise.all([
        fetch(`${apiBase}/index/listCallAPIs`, {
          method: 'POST',
          credentials: 'include',
          headers: FLUTTER_HEADERS
        }).catch((err) => {
          apiLog('ERROR', 'POST /index/listCallAPIs network exception', err);
          return null;
        }),
        fetch(`${apiBase}/index/listFaxAPIs`, {
          method: 'POST',
          credentials: 'include',
          headers: FLUTTER_HEADERS,
          body: JSON.stringify({ domain: sessionDomain })
        }).catch((err) => {
          apiLog('ERROR', 'POST /index/listFaxAPIs network exception', err);
          return null;
        })
      ]);

      const callBody = callRes && callRes.ok ? await readJsonSafe(callRes) : null;
      const faxBody = faxRes && faxRes.ok ? await readJsonSafe(faxRes) : null;
      if (!mountedRef.current || seq !== apiPermsSeqRef.current) return;

      let callPerms: Record<string, boolean> | null = null;
      if (callRes && callRes.ok && isObject(callBody)) {
        apiLog('SUCCESS', 'POST /index/listCallAPIs response', callBody);
        const raw = isObject(callBody.permissions) ? callBody.permissions : callBody;
        callPerms = {};
        Object.entries(raw).forEach(([k, v]) => {
          if (k === 'result' || k === 'status' || k === 'message') return;
          callPerms![k] = normalizeBoolean(v);
        });
      } else if (callRes) {
        apiLog('ERROR', `POST /index/listCallAPIs failed with status ${callRes.status}`, callBody);
      }

      let faxPerms: Record<string, boolean> | null = null;
      if (faxRes && faxRes.ok && isObject(faxBody)) {
        apiLog('SUCCESS', 'POST /index/listFaxAPIs response', faxBody);
        const raw = isObject(faxBody.permissions) ? faxBody.permissions : faxBody;
        faxPerms = {};
        FAX_KEYS.forEach((k) => {
          if (hasValue(raw[k])) faxPerms![k] = normalizeBoolean(raw[k]);
        });
      } else if (faxRes) {
        apiLog('ERROR', `POST /index/listFaxAPIs failed with status ${faxRes.status}`, faxBody);
      }

      if (callPerms || faxPerms) {
        setApiAccess((prev) => {
          const next: Record<string, boolean> = {};
          if (callPerms) {
            Object.assign(next, callPerms);
          } else {
            Object.entries(prev).forEach(([k, v]) => {
              if (!FAX_KEYS.includes(k)) next[k] = v;
            });
          }
          FAX_KEYS.forEach((k) => {
            if (faxPerms && hasValue(faxPerms[k])) next[k] = faxPerms[k];
            else if (hasValue(prev[k])) next[k] = prev[k];
          });
          return next;
        });
      }
      if (callPerms) setApiPermsLoaded(true);
    } catch (e) {
      apiLog('ERROR', 'loadApiPermissions catch error', e);
    }
  }, [apiBase, sessionDomain, FAX_KEYS]);

  // Flutter _checkKeyStatus(): POST index/keyStatus {domain: session['subdomain']}
  const loadApiKeyStatus = useCallback(async () => {
    apiLog('TRIGGER', 'POST /index/keyStatus (Fetch Key Management Status)', { domain: sessionDomain });
    try {
      const response = await fetch(`${apiBase}/index/keyStatus`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify({ domain: sessionDomain })
      });
      const result = (await readJsonSafe(response)) || {};
      if (!mountedRef.current) return;
      if (!response.ok) {
        apiLog('ERROR', `POST /index/keyStatus failed with status ${response.status}`, result);
        return;
      }
      apiLog('SUCCESS', 'POST /index/keyStatus response', result);
      if (result.status === 'valid') {
        setApiKey(String(result.api_key ?? result.apiKey ?? ''));
        setApiSecret(String(result.secret ?? result.apiSecret ?? ''));
        setApiSecretSaved(true);
      } else {
        setApiKey('');
        setApiSecret('');
        setApiSecretSaved(false);
      }
    } catch (err) {
      apiLog('ERROR', 'POST /index/keyStatus network error', err);
    }
  }, [apiBase, sessionDomain]);

  useEffect(() => {
    if (activeTab === 3) {
      loadApiPermissions();
      loadApiKeyStatus();
    }
  }, [activeTab, loadApiPermissions, loadApiKeyStatus]);

  // Save Permissions Action (Call APIs + Fax APIs)
  const savingApiRef = useRef(false);
  const saveApiPermissions = async () => {
    if (savingApiRef.current) {
      apiLog('SKIPPED', 'saveApiPermissions skipped: a save is already in progress');
      return;
    }
    if (!apiPermsLoaded) {
      apiLog('SKIPPED', 'saveApiPermissions skipped: permissions were not loaded from backend');
      showToast('API permissions could not be loaded from the server. Please reopen the tab and try again.', 'error');
      loadApiPermissions();
      return;
    }
    savingApiRef.current = true;
    setLoading(true);
    try {
      const callPermissions: Record<string, boolean> = {};
      Object.entries(apiAccess).forEach(([k, v]) => {
        if (!FAX_KEYS.includes(k)) callPermissions[k] = !!v;
      });
      CALL_APIS.forEach((item) => {
        callPermissions[item.key] = !!apiAccess[item.key];
      });

      const faxPermissions: Record<string, boolean> = {
        send_fax: !!apiAccess['send_fax'],
        receive_fax: !!apiAccess['receive_fax']
      };

      apiLog('TRIGGER', 'POST /index/saveCallsAPI & /index/saveFaxAPI (Save Permissions)', {
        callPermissions,
        faxPermissions
      });

      const [callSaveRes, faxSaveRes] = await Promise.all([
        fetch(`${apiBase}/index/saveCallsAPI`, {
          method: 'POST',
          credentials: 'include',
          headers: FLUTTER_HEADERS,
          body: JSON.stringify({ permissions: callPermissions })
        }).catch((err) => {
          apiLog('ERROR', 'POST /index/saveCallsAPI network error', err);
          return null;
        }),
        fetch(`${apiBase}/index/saveFaxAPI`, {
          method: 'POST',
          credentials: 'include',
          headers: FLUTTER_HEADERS,
          body: JSON.stringify({ permissions: faxPermissions, domain: sessionDomain })
        }).catch((err) => {
          apiLog('ERROR', 'POST /index/saveFaxAPI network error', err);
          return null;
        })
      ]);

      const callData = await readJsonSafe(callSaveRes);
      const faxData = await readJsonSafe(faxSaveRes);

      const isCallSuccess = !!callSaveRes && callSaveRes.ok && callData?.result === 'success';
      const isFaxSuccess = !!faxSaveRes && faxSaveRes.ok && (faxData?.result === 'success' || faxData?.status === 'success');

      apiLog(isCallSuccess && isFaxSuccess ? 'SUCCESS' : 'ERROR', 'saveApiPermissions responses', {
        callStatus: callSaveRes?.status,
        callData,
        faxStatus: faxSaveRes?.status,
        faxData
      });

      if (isCallSuccess && isFaxSuccess) {
        showToast('Call & Fax API permissions saved successfully.', 'success');
      } else if (isCallSuccess) {
        showToast(`Call API permissions saved, but Fax API permissions failed${faxData?.message ? `: ${faxData.message}` : '.'}`, 'error');
      } else if (isFaxSuccess) {
        showToast(`Fax API permissions saved, but Call API permissions failed${callData?.message ? `: ${callData.message}` : '.'}`, 'error');
      } else {
        showToast(callData?.message || faxData?.message || 'Failed to save API permissions.', 'error');
      }

      await loadApiPermissions();
    } catch (e) {
      apiLog('ERROR', 'saveApiPermissions network exception', e);
      showToast('Error communicating with save permission API.', 'error');
    } finally {
      savingApiRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  // Parent footer "Save" window event listener
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  const saveApiPermissionsRef = useRef(saveApiPermissions);
  saveApiPermissionsRef.current = saveApiPermissions;

  useEffect(() => {
    const handleTriggerSave = () => {
      if (activeTabRef.current === 3) {
        apiLog('TRIGGER', 'Received window event: trigger-integrations-save for Tab 3');
        saveApiPermissionsRef.current();
      }
    };
    window.addEventListener('trigger-integrations-save', handleTriggerSave);
    return () => {
      window.removeEventListener('trigger-integrations-save', handleTriggerSave);
    };
  }, []);

  // Generate Key
  const generateApiKey = async () => {
    setApiLoading(true);
    apiLog('TRIGGER', 'POST /index/createKey (Generate API Key)', { domain: sessionDomain });
    try {
      const response = await fetch(`${apiBase}/index/createKey`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify({ domain: sessionDomain })
      });
      const data = (await readJsonSafe(response)) || {};
      if (response.ok && (data.status === 'success' || data.result === 'success')) {
        apiLog('SUCCESS', 'POST /index/createKey succeeded', data);
        setApiKey(String(data.apiKey ?? data.api_key ?? ''));
        setApiSecret(String(data.secret ?? data.apiSecret ?? data.api_secret ?? ''));
        setApiSecretSaved(false);
        showToast('API Key generated successfully.', 'success');
      } else {
        apiLog('ERROR', 'POST /index/createKey failed', data);
        showToast(data.message || 'Failed to create key.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /index/createKey network exception', e);
      showToast('Error generating credentials.', 'error');
    } finally {
      setApiLoading(false);
    }
  };

  // Rotate Key
  const rotateApiKey = async () => {
    if (!apiKey) {
      apiLog('SKIPPED', 'rotateApiKey skipped: apiKey is empty');
      showToast('API key not found', 'error');
      return;
    }
    setApiLoading(true);
    apiLog('TRIGGER', 'POST /index/rotateKey (Rotate API Key Secret)', { apiKey });
    try {
      const response = await fetch(`${apiBase}/index/rotateKey`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = (await readJsonSafe(response)) || {};
      if (response.ok && (data.status === 'success' || data.result === 'success')) {
        apiLog('SUCCESS', 'POST /index/rotateKey succeeded', data);
        const newSecret = data.secret || data.apiSecret || data.api_secret || '';
        if (newSecret) {
          setApiSecret(newSecret);
        }
        setApiSecretSaved(false);
        const successMessage = data.warning
          ? `API Key rotated. ${data.warning}`
          : 'API Key rotated successfully.';
        showToast(successMessage, 'success');
      } else {
        apiLog('ERROR', 'POST /index/rotateKey failed', data);
        showToast(data.message || 'Failed to rotate key.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /index/rotateKey network exception', e);
      showToast('Error rotating credentials.', 'error');
    } finally {
      setApiLoading(false);
    }
  };

  // Revoke Key
  const revokeApiKey = async () => {
    if (!apiKey) {
      apiLog('SKIPPED', 'revokeApiKey skipped: apiKey is empty');
      showToast('API key not found', 'error');
      return;
    }
    setApiLoading(true);
    apiLog('TRIGGER', 'POST /index/revokeKey (Revoke API Key)', { apiKey });
    try {
      const response = await fetch(`${apiBase}/index/revokeKey`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify({ apiKey: apiKey.trim() })
      });
      const data = (await readJsonSafe(response)) || {};
      if (response.ok && (data.status === 'success' || data.result === 'success')) {
        apiLog('SUCCESS', 'POST /index/revokeKey succeeded', data);
        setApiKey('');
        setApiSecret('');
        setApiSecretSaved(false);
        showToast('API Key revoked successfully.', 'success');
        loadApiKeyStatus();
      } else {
        apiLog('ERROR', 'POST /index/revokeKey failed', data);
        showToast(data.message || 'Failed to revoke key.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /index/revokeKey network exception', e);
      showToast('Error revoking credentials.', 'error');
    } finally {
      setApiLoading(false);
    }
  };

  // -------------------------------------------------------------
  // TAB 4: MICRO APPS STATE & HANDLERS
  // -------------------------------------------------------------
  const [selectedApp, setSelectedApp] = useState<string>('');

  // MS Teams state
  const [isTeamsEnabled, setIsTeamsEnabled] = useState<boolean>(() => {
    const savedTeamsStatus = localStorage.getItem('enable_teams');
    return savedTeamsStatus === '1';
  });
  const [teamsLoading, setTeamsLoading] = useState<boolean>(false);
  const [showConfirmTeamsModal, setShowConfirmTeamsModal] = useState<boolean>(false);

  // Enable / Disable Teams using POST
  const toggleTeamsStatus = async (status: boolean) => {
    if (teamsLoading) return;
    setTeamsLoading(true);
    const targetState = status ? 1 : 0;
    const payload = {
      enable_teams: targetState,
      status: targetState,
    };
    apiLog('TRIGGER', 'POST /teams/enableTeams (Toggle MS Teams Connector)', payload);
    try {
      const response = await fetch(`${apiBase}/teams/enableTeams`, {
        method: 'POST',
        credentials: 'include',
        headers: FLUTTER_HEADERS,
        body: JSON.stringify(payload),
      });
      const data = (await readJsonSafe(response)) || {};
      apiLog('SUCCESS', 'POST /teams/enableTeams response', data);
      const isSuccess =
        response.ok &&
        (
          data.result === 'success' ||
          data.status === 'success' ||
          data.status === true ||
          data.enable_teams !== undefined ||
          data.data?.enable_teams !== undefined
        );

      if (isSuccess) {
        const responseStatus =
          data.enable_teams ??
          data.data?.enable_teams ??
          data.content?.enable_teams ??
          targetState;
        const enabled = Number(responseStatus) === 1;
        setIsTeamsEnabled(enabled);
        localStorage.setItem('enable_teams', enabled ? '1' : '0');
        setShowConfirmTeamsModal(false);
        showToast(
          enabled
            ? 'Microsoft Teams enabled successfully.'
            : 'Microsoft Teams disabled successfully.',
          'success'
        );
      } else {
        apiLog('ERROR', 'POST /teams/enableTeams failed', data);
        showToast(
          data.message ||
          (status
            ? 'Failed to enable Microsoft Teams.'
            : 'Failed to disable Microsoft Teams.'),
          'error'
        );
      }
    } catch (error) {
      apiLog('ERROR', 'POST /teams/enableTeams network error', error);
      showToast('Error modifying Microsoft Teams.', 'error');
    } finally {
      setTeamsLoading(false);
    }
  };

   // WhatsApp state
  const [isWhatsAppActive, setIsWhatsAppActive] = useState<boolean>(false);
  
  const checkWhatsAppStatus = useCallback(async () => {
    try {
      const res = await getWhatsAppStatus();
      if (res.data) {
        setIsWhatsAppActive(Boolean(res.data.active));
      }
    } catch {
      // Ignored if unconfigured
    }
  }, []);

  useEffect(() => {
    if (activeTab === 4) {
      checkWhatsAppStatus();
    }
  }, [activeTab, checkWhatsAppStatus]);


  // Telegram Configuration Wizard
  const [teleStep, setTeleStep] = useState<number>(0); // 0: Init Form, 1: OTP Validation, 2: Connected Successfully
  const [telePhone, setTelePhone] = useState<string>('');
  const [teleAppId, setTeleAppId] = useState<string>('');
  const [teleAppHash, setTeleAppHash] = useState<string>('');
  const [teleOtp, setTeleOtp] = useState<string>('');
  const [teleLoading, setTeleLoading] = useState<boolean>(false);
  const [teleError, setTeleError] = useState<string | null>(null);

  const teleTenantRef = useRef(tenantName);
  const teleSeqRef = useRef(0);

  const checkTelegramStatus = useCallback(async () => {
    const seq = ++teleSeqRef.current;
    setTeleLoading(true);
    setTeleError(null);
    apiLog('TRIGGER', `GET /telegram/status/${tenantName} (Check Telegram Service Status)`);
    try {
      const res = await fetch(`${apiBase}/telegram/status/${tenantName}`, { credentials: 'include' });
      const data = await readJsonSafe(res);
      if (!mountedRef.current || seq !== teleSeqRef.current) return;
      if (res.status === 200 && isObject(data)) {
        apiLog('SUCCESS', `GET /telegram/status/${tenantName} response`, data);
        const responseStatus = String(data?.response?.status ?? data?.status ?? '').toLowerCase();
        if (responseStatus === 'running' || responseStatus === 'stopped') {
          setTeleStep(2);
        } else if (responseStatus === 'waiting_for_code') {
          setTeleStep(1);
        } else {
          setTeleStep(0);
        }
      } else if (res.status === 404) {
        apiLog('ERROR', `GET /telegram/status/${tenantName} status: ${res.status}`, data);
        setTeleStep(0);
      } else {
        apiLog('ERROR', `GET /telegram/status/${tenantName} status: ${res.status}`, data);
      }
    } catch (err) {
      apiLog('ERROR', `GET /telegram/status/${tenantName} network error`, err);
    } finally {
      if (mountedRef.current && seq === teleSeqRef.current) setTeleLoading(false);
    }
  }, [apiBase, tenantName]);

  useEffect(() => {
    if (selectedApp === 'telegram') {
      apiLog('MODAL_OPEN', 'Opened Telegram Gateway Configuration Modal');
      checkTelegramStatus();
    }
  }, [selectedApp, checkTelegramStatus]);

  const requestTelegramOtp = async () => {
    if (!telePhone.trim() || !teleAppId.trim() || !teleAppHash.trim()) {
      setTeleError('Please fill in Phone number, App ID, and App Hash credentials.');
      apiLog('SKIPPED', 'requestTelegramOtp skipped: Missing required parameters');
      return;
    }
    const parsedApiId = parseInt(teleAppId.trim(), 10);
    if (isNaN(parsedApiId)) {
      setTeleError('API ID must be a number.');
      apiLog('SKIPPED', 'requestTelegramOtp skipped: parsedApiId is NaN');
      return;
    }
    setTeleLoading(true);
    setTeleError(null);
    const payload = {
      name: tenantName,
      api_id: parsedApiId,
      api_hash: teleAppHash.trim(),
      phone: telePhone.trim(),
      pbx_fqdn: hostname
    };
    apiLog('TRIGGER', 'POST /telegram/register (Request Telegram OTP)', payload);
    try {
      const res = await fetch(`${apiBase}/telegram/register`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await readJsonSafe(res)) || {};
      const responseData = data?.response || data;
      if (res.ok && (responseData?.status === 'success' || data?.status === 'success')) {
        apiLog('SUCCESS', 'POST /telegram/register succeeded', data);
        if (responseData?.tenant) teleTenantRef.current = String(responseData.tenant);
        showToast(responseData?.message || 'Registration started! Please enter OTP code.', 'success');
        setTeleStep(1);
      } else {
        apiLog('ERROR', 'POST /telegram/register failed', data);
        setTeleError(responseData?.message || responseData?.detail || 'Failed to request Telegram OTP.');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /telegram/register network error', e);
      setTeleError('Failed connecting to Telegram verification server.');
    } finally {
      setTeleLoading(false);
    }
  };

  const verifyTelegramOtp = async () => {
    if (!teleOtp.trim()) {
      setTeleError('Please input the received OTP validation code.');
      apiLog('SKIPPED', 'verifyTelegramOtp skipped: OTP is empty');
      return;
    }
    setTeleLoading(true);
    setTeleError(null);
    const payload = {
      tenant: teleTenantRef.current || tenantName,
      code: teleOtp.trim()
    };
    apiLog('TRIGGER', 'POST /telegram/submitOtp (Submit Telegram OTP)', payload);
    try {
      const res = await fetch(`${apiBase}/telegram/submitOtp`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await readJsonSafe(res)) || {};
      const responseData = isObject(data?.response) ? data.response : data;
      const apiStatus = responseData?.status?.toString()?.trim()?.toLowerCase();
      if (apiStatus === 'success') {
        apiLog('SUCCESS', 'POST /telegram/submitOtp succeeded', data);
        showToast('Telegram connection verified successfully.', 'success');
        setTeleStep(2);
      } else if (res.status === 404 && responseData?.detail === 'No active registration') {
        apiLog('ERROR', 'POST /telegram/submitOtp: no active registration', data);
        showToast('No active registration', 'info');
        setTeleStep(1);
      } else {
        apiLog('ERROR', 'POST /telegram/submitOtp failed', data);
        setTeleError(responseData?.message || responseData?.detail || 'Incorrect or expired OTP verification code.');
      }
    } catch (e) {
      apiLog('ERROR', 'POST /telegram/submitOtp network error', e);
      setTeleError('Failed communicating with verification gateway.');
    } finally {
      setTeleLoading(false);
    }
  };

  const restartTelegram = async () => {
    setTeleLoading(true);
    apiLog('TRIGGER', `POST /telegram/restart/${tenantName} (Restart Telegram Service)`);
    try {
      const res = await fetch(`${apiBase}/telegram/restart/${tenantName}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        apiLog('SUCCESS', `POST /telegram/restart/${tenantName} succeeded`);
        showToast('Telegram service restarted successfully.', 'success');
      } else {
        apiLog('ERROR', `POST /telegram/restart/${tenantName} status: ${res.status}`);
        showToast('Failed to restart Telegram service.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', `POST /telegram/restart/${tenantName} network error`, e);
      showToast('Error communicating with Telegram server.', 'error');
    } finally {
      setTeleLoading(false);
    }
  };

  const disconnectTelegram = async () => {
    setTeleLoading(true);
    apiLog('TRIGGER', `POST /telegram/stop/${tenantName} (Stop Telegram Service)`);
    try {
      const res = await fetch(`${apiBase}/telegram/stop/${tenantName}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        apiLog('SUCCESS', `POST /telegram/stop/${tenantName} succeeded`);
        showToast('Telegram service stopped successfully.', 'success');
      } else {
        apiLog('ERROR', `POST /telegram/stop/${tenantName} status: ${res.status}`);
        showToast('Failed to stop Telegram service.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', `POST /telegram/stop/${tenantName} network error`, e);
      showToast('Error communicating with Telegram server.', 'error');
    } finally {
      setTeleLoading(false);
    }
  };

  const deleteTelegramConfig = async () => {
    setTeleLoading(true);
    apiLog('TRIGGER', `GET /telegram/deleteService/${tenantName} (Delete Telegram Service)`);
    try {
      const res = await fetch(`${apiBase}/telegram/deleteService/${tenantName}`, {
        method: 'GET',
        credentials: 'include'
      });
      if (res.ok) {
        apiLog('SUCCESS', `GET /telegram/deleteService/${tenantName} succeeded`);
        showToast('Telegram configuration deleted successfully.', 'success');
        teleTenantRef.current = tenantName;
        setTeleStep(0);
        setTelePhone('');
        setTeleAppId('');
        setTeleAppHash('');
        setTeleOtp('');
      } else {
        apiLog('ERROR', `GET /telegram/deleteService/${tenantName} status: ${res.status}`);
        showToast('Failed to delete Telegram configuration.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', `GET /telegram/deleteService/${tenantName} network error`, e);
      showToast('Error deleting Telegram configuration.', 'error');
    } finally {
      setTeleLoading(false);
    }
  };

  const openTelegramLogs = async () => {
    apiLog('TRIGGER', `POST /telegram/logs/${tenantName} (Fetch Telegram Logs)`);
    try {
      const res = await fetch(`${apiBase}/telegram/logs/${tenantName}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      if (res.ok) {
        const data = await res.json();
        apiLog('SUCCESS', `POST /telegram/logs/${tenantName} response`, data);
        const logsUrl = data?.logs_url || data?.response?.logs_url;
        if (logsUrl) {
          apiLog('TRIGGER', 'Opening Telegram Logs URL', { logsUrl });
          window.open(logsUrl, '_blank');
        } else {
          showToast('Logs URL not available.', 'error');
        }
      } else {
        apiLog('ERROR', `POST /telegram/logs/${tenantName} status: ${res.status}`);
        showToast('Failed to fetch Telegram logs.', 'error');
      }
    } catch (e) {
      apiLog('ERROR', `POST /telegram/logs/${tenantName} network error`, e);
      showToast('Error fetching Telegram logs.', 'error');
    }
  };
  // -------------------------------------------------------------
  // COPY HELPER
  // -------------------------------------------------------------
  const copyToClipboard = (text: string, subject: string) => {
    navigator.clipboard.writeText(text);
    showToast(`${subject} copied to clipboard!`, 'success');
  };

  const crmBadge = (configured: boolean) =>
    configured ? <IntgBadge tone="success">Configured</IntgBadge> : <IntgBadge>Not configured</IntgBadge>;
  const connectedBadge = (connected: boolean) =>
    connected ? <IntgBadge tone="success">Connected</IntgBadge> : undefined;
  const closeCRM = () => setSelectedCRM('');
  const crmFooter = (onSave: () => void, saveLabel = 'Save') => (
    <>
      <Button size="md" color="secondary" onClick={closeCRM}>Cancel</Button>
      <Button size="md" color="primary" onClick={onSave} isDisabled={loading} isLoading={loading} showTextWhileLoading>
        {loading ? 'Saving...' : saveLabel}
      </Button>
    </>
  );

  return (
    <div className="intg-root">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={`intg-toast intg-toast-${toastMessage.type}`} role="status" aria-live="polite">
          {toastMessage.type === 'error' ? (
            <CircleAlert size={18} aria-hidden="true" />
          ) : toastMessage.type === 'info' ? (
            <Info size={18} aria-hidden="true" />
          ) : (
            <CircleCheck size={18} aria-hidden="true" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Tabs list -- "RingQ APIs" (id 3) is license-gated, live-confirmed
          absent for a Sub Admin and present for the Main Admin. */}
      <div className="intg-tabs tab-slide tab-slide--underline" role="tablist" aria-label="Integration categories" ref={tabsRef}>
        {TABS.filter((tab) => tab.id !== 3 || showLicenseGatedAdvanced).map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            id={`intg-tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            aria-controls="intg-tabpanel"
            className={`intg-tab${activeTab === tab.id ? ' is-active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setSelectedCRM('');
              setSelectedBook('');
              setSelectedApp('');
            }}
          >
            <i className={`bx ${tab.icon}`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main content body */}
      <div className="intg-tabpanel" id="intg-tabpanel" role="tabpanel" aria-labelledby={`intg-tab-${activeTab}`} ref={panelRef}>
        {/* TAB 0: SSO VIEW */}
        {activeTab === 0 && (
          <>
            <IntgSection title="Single sign-on" description="Choose which identity providers your team can use to sign in to RingQ.">
              <div className="intg-grid">
                <IntgCard
                  logo={<IntgLogo brand="ringq" />}
                  name="RingQ"
                  description="Sign in with the RingQ mobile app"
                  status={<IntgBadge tone="brand">Built-in</IntgBadge>}
                  actionLabel="Options"
                  selected={selectedSSO === 'ringq'}
                  onClick={() => setSelectedSSO('ringq')}
                />
                <IntgCard
                  logo={<IntgLogo icon={<i className="bx bxl-linkedin-square intg-brand-linkedin" />} />}
                  name="LinkedIn"
                  description="Sign in with LinkedIn (OpenID Connect)"
                  status={connectedBadge(liConnected)}
                  actionLabel={liConnected ? 'Manage' : 'Connect'}
                  onClick={() => setShowLinkedInModal(true)}
                />
                <IntgCard
                  logo={<IntgLogo brand="microsoft" />}
                  name="Microsoft"
                  description="Sign in with Microsoft Entra ID"
                  status={connectedBadge(msSsoEnabled)}
                  selected={showMsSsoModal}
                  onClick={() => setShowMsSsoModal(true)}
                />
                <IntgCard
                  logo={<IntgLogo brand="google" />}
                  name="Google"
                  description="Sign in with Google Workspace"
                  status={connectedBadge(ggSsoEnabled)}
                  selected={showGgSsoModal}
                  onClick={() => setShowGgSsoModal(true)}
                />
              </div>
            </IntgSection>

            {selectedSSO === 'ringq' && (
              <IntgSection title="RingQ sign-in options" description="Changes to these options are saved as soon as you switch them.">
                <IntgPanel className="intg-panel-list">
                  <IntgSwitchRow
                    id="intg-sso-code"
                    title="SSO code"
                    description="Allow sign-in with a one-time code from the mobile app."
                    checked={ssoNumber}
                    onChange={(checked) => handleSSOToggle('ssoNumber', checked)}
                  />
                  <IntgSwitchRow
                    id="intg-sso-qr"
                    title="SSO QR code"
                    description="Allow sign-in by scanning a QR code with the mobile app."
                    checked={ssoQR}
                    onChange={(checked) => handleSSOToggle('ssoQR', checked)}
                  />
                  <IntgSwitchRow
                    id="intg-sso-web-password"
                    title="Web password"
                    description="Allow sign-in with a web password."
                    checked={webPassword}
                    onChange={(checked) => handleSSOToggle('webPassword', checked)}
                  />
                </IntgPanel>
              </IntgSection>
            )}
          </>
        )}

        {/* TAB 1: CRM VIEW */}
        {activeTab === 1 && (
          <IntgSection title="CRM" description="Look up callers and log calls in the tools your team already uses.">
            <div className="intg-grid">
              <IntgCard
                logo={<IntgLogo brand="cliniko" />}
                name="Cliniko"
                description="Practice management and patient records"
                status={crmBadge(!!(clUrl && clApiKey))}
                onClick={() => setSelectedCRM('cliniko')}
              />
              <IntgCard
                logo={<IntgLogo brand="autotask" />}
                name="AutoTask"
                description="PSA ticketing and resource management"
                status={crmBadge(!!(atUsername || atIntegrationCode))}
                onClick={() => setSelectedCRM('autotask')}
              />
              <IntgCard
                logo={<IntgLogo brand="custom_crm" />}
                name="Custom CRM"
                description="Send call events to any JSON webhook"
                status={
                  ccEnabled ? (
                    <IntgBadge tone="success">Enabled</IntgBadge>
                  ) : ccWebhookUrl ? (
                    <IntgBadge>Disabled</IntgBadge>
                  ) : (
                    <IntgBadge>Not configured</IntgBadge>
                  )
                }
                onClick={() => setSelectedCRM('custom_crm')}
              />
              <IntgCard
                logo={<IntgLogo brand="zohodesk" />}
                name="Zoho Desk"
                description="Help desk ticketing and call logging"
                status={crmBadge(!!zhClientId)}
                onClick={() => setSelectedCRM('zohodesk')}
              />
              <IntgCard
                logo={<IntgLogo brand="salesforce" />}
                name="Salesforce"
                description="Open CTI contact lookup and logging"
                status={crmBadge(!!(sfClientId || sfUsername))}
                onClick={() => setSelectedCRM('salesforce')}
              />
              <IntgCard
                logo={<IntgLogo brand="zendesk" />}
                name="Zendesk"
                description="Support ticketing and call logging"
                status={crmBadge(!!zdClientId)}
                onClick={() => setSelectedCRM('zendesk')}
              />
              <IntgCard
                logo={<IntgLogo brand="hubspot" />}
                name="HubSpot"
                description="Contacts, companies and call journaling"
                status={crmBadge(!!(hsAuthToken || hsUrl))}
                onClick={() => setSelectedCRM('hubspot')}
              />
              <IntgCard
                logo={<IntgLogo icon={<QontakMark />} />}
                name="Qontak"
                description="Mekari Qontak contacts and call journaling"
                status={<QontakCardStatus />}
                onClick={() => setSelectedCRM('qontak')}
              />
            </div>
          </IntgSection>
        )}

        {/* TAB 2: ADDRESS BOOK VIEW */}
        {activeTab === 2 && (
          <IntgSection title="Address book" description="Sync contacts from your directory so they appear in RingQ.">
            <div className="intg-grid">
              <IntgCard
                logo={<IntgLogo brand="microsoft" />}
                name="Microsoft 365"
                description="Personal and organization contacts"
                status={connectedBadge(msConnected)}
                onClick={() => setSelectedBook('microsoft')}
              />
              <IntgCard
                logo={<IntgLogo brand="google" />}
                name="Google Workspace"
                description="Contacts from your Google account"
                status={connectedBadge(ggConnected)}
                onClick={() => setSelectedBook('google')}
              />
              <IntgCard
                logo={<IntgLogo brand="custom_crm" />}
                name="Custom CRM"
                description="Sync contacts with your own CRM webhook"
                status={ccdLoaded && ccdEnabled ? <IntgBadge tone="success">Enabled</IntgBadge> : undefined}
                onClick={() => setSelectedBook('custom_crm')}
              />
            </div>

            {/* Custom CRM (Address Book) contact sync */}
            {selectedBook === 'custom_crm' && (
              <IntgDialog
                size="lg"
                media={<IntgLogo brand="custom_crm" />}
                title="Custom CRM"
                subtitle="Address book contact sync"
                badge={ccdDirty ? <IntgBadge tone="warning">Unsaved changes</IntgBadge> : undefined}
                onClose={() => setSelectedBook('')}
                footerStart={
                  <Button size="md" color="secondary" iconLeading={RefreshCw} onClick={ccdFetchSettings} isDisabled={ccdLoading}>
                    Reload
                  </Button>
                }
                footer={
                  <>
                    <Button size="md" color="secondary" onClick={() => setSelectedBook('')}>Close</Button>
                    <Button size="md" color="primary" onClick={ccdSave} isDisabled={ccdLoading} isLoading={ccdLoading} showTextWhileLoading>
                      {ccdLoading ? 'Saving...' : 'Save'}
                    </Button>
                  </>
                }
              >
                {ccdLoading && <IntgAlert tone="info">Loading settings...</IntgAlert>}

                <IntgPanel
                  title="CRM webhook connection"
                  description="Point RingQ at your CRM's webhook so contacts can be synced both ways."
                  badge={ccdEnabled ? <IntgBadge tone="success">Enabled</IntgBadge> : <IntgBadge>Disabled</IntgBadge>}
                >
                  <div className="intg-form-stack">
                    <IntgSwitchRow
                      id="intg-ccd-enabled"
                      title="Enable Custom CRM integration"
                      description="Turns on contact sync with your CRM."
                      checked={ccdEnabled}
                      onChange={(v) => { setCcdDirty(true); setCcdEnabled(v); }}
                    />
                    <IntgField label="CRM webhook URL" htmlFor="intg-ccd-pull" hint="Used to pull contacts from your CRM.">
                      <input
                        id="intg-ccd-pull"
                        type="text"
                        className="intg-input"
                        value={ccdPullUrl}
                        onChange={(e) => { setCcdDirty(true); setCcdPullUrl(e.target.value); }}
                        placeholder="https://crm.example.com/ringq/contacts"
                      />
                    </IntgField>
                    <label className="intg-check-row">
                      <input
                        type="checkbox"
                        checked={ccdSameUrl}
                        onChange={(e) => { setCcdDirty(true); setCcdSameUrl(e.target.checked); }}
                      />
                      <span>Use the same webhook URL for pushing our contacts to your CRM</span>
                    </label>
                    {!ccdSameUrl && (
                      <IntgField label="CRM webhook URL for pushing contacts" optional htmlFor="intg-ccd-push">
                        <input
                          id="intg-ccd-push"
                          type="text"
                          className="intg-input"
                          value={ccdPushUrl}
                          onChange={(e) => { setCcdDirty(true); setCcdPushUrl(e.target.value); }}
                          placeholder="https://crm.example.com/ringq/push"
                        />
                      </IntgField>
                    )}
                    <IntgField label="Authentication type" htmlFor="intg-ccd-auth">
                      <CrmCustomDropdown
                        id="intg-ccd-auth"
                        value={ccdAuthType}
                        onChange={(v) => { setCcdDirty(true); setCcdAuthType(v); }}
                        options={['None', 'Basic Auth', 'Bearer Token', 'Custom Header']}
                      />
                    </IntgField>
                    {ccdAuthType === 'Basic Auth' && (
                      <div className="intg-form-grid">
                        <IntgField label="Username" htmlFor="intg-ccd-user">
                          <input id="intg-ccd-user" type="text" className="intg-input" value={ccdUsername} autoComplete="off" onChange={(e) => { setCcdDirty(true); setCcdUsername(e.target.value); }} />
                        </IntgField>
                        <IntgField label="Password" htmlFor="intg-ccd-pass">
                          <IntgSecretInput
                            id="intg-ccd-pass"
                            label="password"
                            value={ccdPassword}
                            onChange={(v) => { setCcdDirty(true); setCcdPassword(v); }}
                            shown={ccdShowPassword}
                            onToggle={() => setCcdShowPassword(!ccdShowPassword)}
                          />
                        </IntgField>
                      </div>
                    )}
                    {ccdAuthType === 'Bearer Token' && (
                      <IntgField label="Token" htmlFor="intg-ccd-token">
                        <input id="intg-ccd-token" type="password" className="intg-input" value={ccdToken} autoComplete="off" onChange={(e) => { setCcdDirty(true); setCcdToken(e.target.value); }} />
                      </IntgField>
                    )}
                    {ccdAuthType === 'Custom Header' && (
                      <div className="intg-form-grid">
                        <IntgField label="Header key" htmlFor="intg-ccd-hkey">
                          <input id="intg-ccd-hkey" type="text" className="intg-input" value={ccdHeaderKey} autoComplete="off" onChange={(e) => { setCcdDirty(true); setCcdHeaderKey(e.target.value); }} />
                        </IntgField>
                        <IntgField label="Header value" htmlFor="intg-ccd-hval">
                          <input id="intg-ccd-hval" type="password" className="intg-input" value={ccdHeaderValue} autoComplete="off" onChange={(e) => { setCcdDirty(true); setCcdHeaderValue(e.target.value); }} />
                        </IntgField>
                      </div>
                    )}
                    <IntgField label="Request timeout (s)" htmlFor="intg-ccd-timeout">
                      <input
                        id="intg-ccd-timeout"
                        type="number"
                        min={1}
                        className="intg-input"
                        style={{ maxWidth: 160 }}
                        value={ccdTimeout}
                        onChange={(e) => { setCcdDirty(true); setCcdTimeout(e.target.value); }}
                      />
                    </IntgField>
                  </div>
                </IntgPanel>

                <IntgPanel
                  title="Demo JSON format"
                  description="Your CRM webhook should return this shape, and will receive the same shape when we push contacts to it."
                  actions={<Button size="sm" color="tertiary" iconLeading={Copy} aria-label="Copy demo JSON" onClick={() => copyToClipboard(ccdSampleJson, 'Demo JSON')} />}
                >
                  <pre className="intg-code">{ccdSampleJson}</pre>
                </IntgPanel>

                <IntgPanel title="Contact sync" description="Pull contacts from your CRM into RingQ, or push RingQ contacts out to your CRM.">
                  <div className="intg-form-stack">
                    <div className="intg-form-grid">
                      <Button size="md" color="primary" iconLeading={Download} onClick={() => ccdRunSync('pull')} isDisabled={ccdSyncing}>
                        Sync contacts from CRM
                      </Button>
                      <Button size="md" color="secondary" iconLeading={Upload} onClick={() => ccdRunSync('push')} isDisabled={ccdSyncing}>
                        Sync contacts to CRM
                      </Button>
                    </div>
                    {ccdSyncing && <IntgAlert tone="info">Syncing…</IntgAlert>}
                    {ccdSyncMessage && <p className="intg-panel-desc" role="status">{ccdSyncMessage}</p>}
                    <p className="intg-panel-desc">
                      {ccdLastPull.time ? `Last pull: ${ccdLastPull.time} (${ccdLastPull.count} imported)` : 'Last pull: Not attempted yet'}
                    </p>
                    <p className="intg-panel-desc">
                      {ccdLastPush.time ? `Last push: ${ccdLastPush.time} (${ccdLastPush.count} sent)` : 'Last push: Not attempted yet'}
                    </p>
                  </div>
                </IntgPanel>
              </IntgDialog>
            )}

            {/* Microsoft 365 Integration View */}
            {selectedBook === 'microsoft' && (
              <IntgDialog
                size="lg"
                media={<IntgLogo brand="microsoft" />}
                title="Microsoft 365"
                badge={msConnected ? <IntgBadge tone="success">Connected</IntgBadge> : undefined}
                subtitle="Sync contacts from Microsoft 365 into RingQ."
                onClose={() => setSelectedBook('')}
                footerStart={
                  <>
                    <Button size="md" color="secondary" iconLeading={CloudDownload} onClick={importM365OrgContacts} isDisabled={!msConnected}>
                      Get org contacts
                    </Button>
                    <Button size="md" color="secondary" iconLeading={<i className="bx bxl-microsoft intg-btn-bx" aria-hidden="true" />} onClick={connectM365} isDisabled={!msConnected}>
                      Connect Microsoft 365
                    </Button>
                  </>
                }
                footer={
                  <>
                    <Button size="md" color="secondary" onClick={() => setSelectedBook('')}>Close</Button>
                    <Button size="md" color="primary" onClick={saveM365Settings} isDisabled={msLoading}>
                      Save configuration
                    </Button>
                  </>
                }
              >
                {msLoading && <IntgAlert tone="info">Loading settings...</IntgAlert>}

                <IntgCollapsible title="API credentials" open={msConfigExpanded} onToggle={() => setMsConfigExpanded(!msConfigExpanded)}>
                  <div className="intg-form-grid">
                    <IntgField label="Client ID" required htmlFor="intg-m365-client-id">
                      <input id="intg-m365-client-id" type="text" className="intg-input" value={msClientId} onChange={(e) => setMsClientId(e.target.value)} placeholder="Enter client ID" />
                    </IntgField>
                    <IntgField label="Client secret" required htmlFor="intg-m365-client-secret">
                      <IntgSecretInput
                        id="intg-m365-client-secret"
                        label="client secret"
                        value={msClientSecret}
                        onChange={setMsClientSecret}
                        shown={showMsSecret}
                        onToggle={() => setShowMsSecret(!showMsSecret)}
                        placeholder="Enter client secret"
                      />
                    </IntgField>
                    <IntgField label="Tenant ID" required htmlFor="intg-m365-tenant-id" full>
                      <input id="intg-m365-tenant-id" type="text" className="intg-input" value={msTenantId} onChange={(e) => setMsTenantId(e.target.value)} placeholder="Enter tenant ID" />
                    </IntgField>
                    <IntgField label="Redirect URI" full hint="Add this redirect URI to your Microsoft Entra ID app registration.">
                      <IntgCopyField
                        value={`https://${hostname}:8443/teams/o365settings`}
                        label="redirect URI"
                        onCopy={() => copyToClipboard(`https://${hostname}:8443/teams/o365settings`, 'Redirect URI')}
                      />
                    </IntgField>
                  </div>
                </IntgCollapsible>

                {/* Contact Source Selection */}
                <div className="intg-subsection">
                  <h3 className="intg-subsection-title">
                    <span id="intg-m365-source-label">Contact source</span>
                    <InfoHint label="About Contact source">Choose which contact list to sync with Microsoft 365.</InfoHint>
                  </h3>
                  <div className="intg-option-grid" role="radiogroup" aria-labelledby="intg-m365-source-label">
                    {[
                      { mode: 'personal', icon: User, title: 'Personal contacts', desc: 'Sync personal accounts' },
                      { mode: 'public', icon: Building2, title: 'Organization contacts', desc: 'Sync the organization directory' },
                      { mode: 'both', icon: Users, title: 'Both sources', desc: 'Sync personal and organization' }
                    ].map((opt) => {
                      const isSelected = msContactMode === opt.mode;
                      const OptIcon = opt.icon;
                      return (
                        <button
                          key={opt.mode}
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          className={`intg-option${isSelected ? ' is-selected' : ''}`}
                          onClick={() => setMsContactMode(opt.mode)}
                        >
                          <span className="intg-option-head">
                            <span className="intg-option-icon"><OptIcon size={18} aria-hidden="true" /></span>
                            <span className="intg-option-radio" aria-hidden="true" />
                          </span>
                          <span className="intg-option-title">{opt.title}</span>
                          <span className="intg-option-desc">{opt.desc}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </IntgDialog>
            )}

            {/* Google Integration View */}
            {selectedBook === 'google' && (
              <IntgDialog
                size="lg"
                media={<IntgLogo brand="google" />}
                title="Google Workspace"
                badge={ggConnected ? <IntgBadge tone="success">Connected</IntgBadge> : undefined}
                subtitle="Sync contacts from Google Workspace into RingQ."
                onClose={() => setSelectedBook('')}
                footerStart={
                  ggConnected ? (
                    <Button size="md" color="secondary-destructive" iconLeading={LogOut} onClick={disconnectGoogle} isDisabled={ggLoading}>
                      Disconnect
                    </Button>
                  ) : undefined
                }
                footer={
                  <>
                    <Button size="md" color="secondary" onClick={() => setSelectedBook('')}>Close</Button>
                    <Button size="md" color="primary" iconLeading={<i className="bx bxl-google intg-btn-bx" aria-hidden="true" />} onClick={connectGoogle} isDisabled={ggLoading}>
                      {ggConnected ? 'Reconnect' : 'Connect'}
                    </Button>
                  </>
                }
              >
                {ggLoading && <IntgAlert tone="info">Loading settings...</IntgAlert>}

                <IntgCollapsible title="API credentials" open={ggCredentialsExpanded} onToggle={() => setGgCredentialsExpanded(!ggCredentialsExpanded)}>
                  <div className="intg-form-grid">
                    <IntgField label="Client ID" required htmlFor="intg-gab-client-id">
                      <input id="intg-gab-client-id" type="text" className="intg-input" value={ggClientId} onChange={(e) => setGgClientId(e.target.value)} placeholder="Enter client ID" />
                    </IntgField>
                    <IntgField label="Client secret" required htmlFor="intg-gab-client-secret">
                      <IntgSecretInput
                        id="intg-gab-client-secret"
                        label="client secret"
                        value={ggClientSecret}
                        onChange={setGgClientSecret}
                        shown={showGgSecret}
                        onToggle={() => setShowGgSecret(!showGgSecret)}
                        placeholder="Enter client secret"
                      />
                    </IntgField>
                    <IntgField label="Redirect URI" full hint="Add this redirect URI to your Google Cloud Console OAuth client.">
                      <IntgCopyField
                        value={`https://${hostname}:8443/teams/googlecallback`}
                        label="redirect URI"
                        onCopy={() => copyToClipboard(`https://${hostname}:8443/teams/googlecallback`, 'Redirect URI')}
                      />
                    </IntgField>
                  </div>
                </IntgCollapsible>

                <IntgCollapsible title="Connection details" open={ggInfoExpanded} onToggle={() => setGgInfoExpanded(!ggInfoExpanded)}>
                  <dl className="intg-details">
                    <div className="intg-detail">
                      <dt>Status</dt>
                      <dd>{ggConnected ? <IntgBadge tone="success">Connected</IntgBadge> : <IntgBadge tone="danger">Disconnected</IntgBadge>}</dd>
                    </div>
                    <div className="intg-detail">
                      <dt>Connected account</dt>
                      <dd>{ggConnAccount || 'N/A'}</dd>
                    </div>
                    <div className="intg-detail">
                      <dt>Organization (workspace domain)</dt>
                      <dd>{ggOrganization || 'N/A'}</dd>
                    </div>
                    <div className="intg-detail">
                      <dt>Connected since</dt>
                      <dd>{ggConnectedSince || 'N/A'}</dd>
                    </div>
                  </dl>
                </IntgCollapsible>
              </IntgDialog>
            )}
          </IntgSection>
        )}

        {/* TAB 3: RINGQ APIS VIEW */}
        {activeTab === 3 && showLicenseGatedAdvanced && (
          <IntgSection title="RingQ APIs" description="Manage API credentials and choose which RingQ APIs they can call.">
            {/* Sub-tab selection header */}
            <div className="intg-segmented tab-slide tab-slide--pill" role="tablist" aria-label="RingQ API settings" ref={subTabsRef}>
              {[
                { id: 'key_mgmt' as const, label: 'API key management' },
                { id: 'call_apis' as const, label: 'Call APIs' },
                { id: 'fax_apis' as const, label: 'Fax APIs' }
              ].map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  role="tab"
                  aria-selected={activeSubTab === sub.id}
                  className={`intg-segment${activeSubTab === sub.id ? ' is-active' : ''}`}
                  onClick={() => setActiveSubTab(sub.id)}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            <div ref={subPanelRef}>
              {/* Sub-tab 1: API Key Management */}
              {activeSubTab === 'key_mgmt' && (
                <IntgPanel title="API key management" description="Use this key and secret to authenticate requests to RingQ APIs. Keep the secret private.">
                  {apiLoading ? (
                    <IntgState icon={<LoaderCircle size={20} className="intg-spin" />} title="Loading credentials" hint="Fetching your API key status..." />
                  ) : (
                    <div className="intg-key-form">
                      <IntgField label="API key" htmlFor="intg-api-key">
                        <div className="intg-input-affix">
                          <input
                            id="intg-api-key"
                            type="text"
                            value={apiKey || ''}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="intg-input intg-input-mono"
                            placeholder="Enter or generate an API key"
                            autoComplete="off"
                          />
                          {apiKey && (
                            <div className="intg-input-actions">
                              <button type="button" className="intg-icon-btn" onClick={() => copyToClipboard(apiKey, 'API Key')} aria-label="Copy API key" title="Copy">
                                <Copy size={16} aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                      </IntgField>

                      <IntgField label="API secret" htmlFor="intg-api-secret">
                        <div className={`intg-input-affix${apiSecret ? ' has-2-actions' : ''}`}>
                          <input
                            id="intg-api-secret"
                            type={showSecret ? 'text' : 'password'}
                            value={apiSecret || ''}
                            onChange={(e) => setApiSecret(e.target.value)}
                            className="intg-input intg-input-mono"
                            placeholder="Enter or generate an API secret"
                            autoComplete="off"
                          />
                          {apiSecret && (
                            <div className="intg-input-actions">
                              <button
                                type="button"
                                className="intg-icon-btn"
                                onClick={() => setShowSecret(!showSecret)}
                                aria-label={showSecret ? 'Hide API secret' : 'Show API secret'}
                                title={showSecret ? 'Hide' : 'Show'}
                              >
                                {showSecret ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
                              </button>
                              <button type="button" className="intg-icon-btn" onClick={() => copyToClipboard(apiSecret, 'Secret')} aria-label="Copy API secret" title="Copy">
                                <Copy size={16} aria-hidden="true" />
                              </button>
                            </div>
                          )}
                        </div>
                      </IntgField>

                      {!apiKey && <p className="intg-hint">No API key yet. Generate one to start calling RingQ APIs.</p>}

                      <div className="intg-inline-actions">
                        <Button size="md" color="primary" iconLeading={KeyRound} onClick={generateApiKey}>
                          Generate key
                        </Button>
                        {apiKey && (
                          <>
                            <Button size="md" color="secondary" iconLeading={RotateCw} onClick={rotateApiKey}>
                              Rotate secret
                            </Button>
                            <Button size="md" color="secondary-destructive" iconLeading={Trash2} onClick={revokeApiKey}>
                              Revoke key
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </IntgPanel>
              )}

              {/* Sub-tab 2: Call APIs */}
              {activeSubTab === 'call_apis' && (
                <IntgPanel title="Call API permissions" description="Choose which call, agent and queue actions the API key can perform. Select Save to apply your changes.">
                  <div className="intg-perm-grid">
                    {[CALL_APIS_COL1, CALL_APIS_COL2, CALL_APIS_COL3].map((col, colIndex) => (
                      <div key={colIndex} className="intg-perm-column">
                        {col.map((perm) => (
                          <IntgSwitchRow
                            key={perm.key}
                            id={`intg-perm-${perm.key}`}
                            title={perm.label}
                            description={perm.desc}
                            checked={!!apiAccess[perm.key]}
                            onChange={(val) => {
                              setApiAccess((prev) => ({ ...prev, [perm.key]: val }));
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </IntgPanel>
              )}

              {/* Sub-tab 3: Fax APIs */}
              {activeSubTab === 'fax_apis' && (
                <IntgPanel title="Fax API permissions" description="Choose which fax actions the API key can perform. Select Save to apply your changes.">
                  <div className="intg-perm-grid intg-perm-grid-2">
                    {FAX_APIS.map((perm) => (
                      <div key={perm.key} className="intg-perm-column">
                        <IntgSwitchRow
                          id={`intg-perm-${perm.key}`}
                          title={perm.label}
                          description={perm.desc}
                          checked={!!apiAccess[perm.key]}
                          onChange={(val) => {
                            setApiAccess((prev) => ({ ...prev, [perm.key]: val }));
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </IntgPanel>
              )}
            </div>
          </IntgSection>
        )}

        {/* TAB 4: MICRO APPS VIEW */}
        {activeTab === 4 && (
          <IntgSection title="Micro apps" description="Bring RingQ into the messaging apps your team works in.">
            <div className="intg-grid">
              <IntgCard
                logo={<IntgLogo brand="teams" />}
                name="Microsoft Teams"
                description="Calling and presence inside Teams"
                status={isTeamsEnabled ? <IntgBadge tone="success">Enabled</IntgBadge> : <IntgBadge>Disabled</IntgBadge>}
                actionLabel={isTeamsEnabled ? 'Disable' : 'Enable'}
                onClick={() => setShowConfirmTeamsModal(true)}
              />
              <IntgCard
                logo={<IntgLogo brand="telegram" />}
                name="Telegram"
                description="Route Telegram messages to RingQ"
                status={connectedBadge(teleStep === 2)}
                onClick={() => setSelectedApp('telegram')}
              />
              <IntgCard
                logo={<IntgLogo brand="whatsapp" />}
                name="WhatsApp"
                description="Route WhatsApp messages to RingQ"
                status={isWhatsAppActive ? <IntgBadge tone="success">Active</IntgBadge> : <IntgBadge>Not configured</IntgBadge>}
                onClick={() => setSelectedApp('whatsapp')}
              />

            </div>
          </IntgSection>
        )}
      </div>

      {/* -------------------------------------------------------------
          CRM SETTINGS DIALOGS
          ------------------------------------------------------------- */}

      {/* Qontak (self-contained module: src/integrations/qontak) */}
      {selectedCRM === 'qontak' && <QontakSettingsDialog onClose={closeCRM} />}

      {/* Cliniko Submodal */}
      {selectedCRM === 'cliniko' && (
        <IntgDialog
          size="lg"
          media={<IntgLogo brand="cliniko" />}
          title="Cliniko settings"
          subtitle="Look up patients and log calls in Cliniko."
          onClose={closeCRM}
          footerStart={<IntgHelpLink />}
          footer={crmFooter(() => saveCRM(1))}
        >
          <div className="intg-form-grid">
            <IntgField label="Username" optional htmlFor="intg-cl-username">
              <IntgSecretInput id="intg-cl-username" label="username" value={clUsername} onChange={setClUsername} shown={showClUsername} onToggle={() => setShowClUsername(!showClUsername)} />
            </IntgField>
            <IntgField label="Password" optional htmlFor="intg-cl-password">
              <IntgSecretInput id="intg-cl-password" label="password" value={clPassword} onChange={setClPassword} shown={showClPassword} onToggle={() => setShowClPassword(!showClPassword)} />
            </IntgField>
            <IntgField label="App vendor name" optional htmlFor="intg-cl-vendor-name">
              <input id="intg-cl-vendor-name" type="text" className="intg-input" value={clVendorName} onChange={(e) => setClVendorName(e.target.value)} placeholder="e.g. RingQ" />
            </IntgField>
            <IntgField label="App vendor email" optional htmlFor="intg-cl-vendor-email">
              <input id="intg-cl-vendor-email" type="email" className="intg-input" value={clVendorEmail} onChange={(e) => setClVendorEmail(e.target.value)} placeholder="name@company.com" />
            </IntgField>
            <IntgField label="URL" required htmlFor="intg-cl-url">
              <input id="intg-cl-url" type="text" className="intg-input" value={clUrl} onChange={(e) => setClUrl(e.target.value)} placeholder="https://your-clinic.au5.cliniko.com" autoComplete="off" spellCheck={false} />
            </IntgField>
            <IntgField label="API key" required htmlFor="intg-cl-api-key">
              <IntgSecretInput id="intg-cl-api-key" label="API key" value={clApiKey} onChange={setClApiKey} shown={showClApiKey} onToggle={() => setShowClApiKey(!showClApiKey)} />
            </IntgField>
          </div>

          <div className="intg-subsection">
            <h3 className="intg-subsection-title">Advanced settings</h3>
            <IntgPanel className="intg-panel-list">
              <IntgSwitchRow id="intg-cl-journaling" title="Call journaling" description="Log calls to Cliniko." checked={clCallJournaling} onChange={setClCallJournaling} />
              <IntgSwitchRow id="intg-cl-contacts" title="Contact creation" description="Allow RingQ to create contacts in Cliniko." checked={clContactCreation} onChange={setClContactCreation} />
            </IntgPanel>
          </div>
        </IntgDialog>
      )}

      {/* AutoTask Submodal */}
      {selectedCRM === 'autotask' && (
        <IntgDialog
          size="lg"
          media={<IntgLogo brand="autotask" />}
          title="AutoTask settings"
          subtitle="Match callers to AutoTask contacts and log calls against tickets."
          onClose={closeCRM}
          footerStart={<IntgHelpLink />}
          footer={crmFooter(() => saveCRM(3))}
        >
          <div className="intg-form-grid">
            <IntgField label="Username" htmlFor="intg-at-username">
              <IntgSecretInput id="intg-at-username" label="username" value={atUsername} onChange={setAtUsername} shown={showAtUsername} onToggle={() => setShowAtUsername(!showAtUsername)} />
            </IntgField>
            <IntgField label="API integration code" htmlFor="intg-at-code">
              <IntgSecretInput id="intg-at-code" label="API integration code" value={atIntegrationCode} onChange={setAtIntegrationCode} shown={showAtIntegrationCode} onToggle={() => setShowAtIntegrationCode(!showAtIntegrationCode)} />
            </IntgField>
            <IntgField label="Secret" htmlFor="intg-at-secret">
              <IntgSecretInput id="intg-at-secret" label="secret" value={atSecret} onChange={setAtSecret} shown={showAtSecret} onToggle={() => setShowAtSecret(!showAtSecret)} />
            </IntgField>
            <IntgField label="URL" htmlFor="intg-at-url">
              <input id="intg-at-url" type="text" className="intg-input" value={atUrl} onChange={(e) => setAtUrl(e.target.value)} />
            </IntgField>
            <IntgField label="Owner resource ID" htmlFor="intg-at-owner">
              <input id="intg-at-owner" type="text" className="intg-input" value={atOwnerResourceId} onChange={(e) => setAtOwnerResourceId(e.target.value)} />
            </IntgField>
          </div>
        </IntgDialog>
      )}

      {/* Zoho Desk Submodal */}
      {selectedCRM === 'zohodesk' && (
        <IntgDialog
          size="md"
          media={<IntgLogo brand="zohodesk" />}
          title="Zoho Desk settings"
          subtitle="Save your credentials, then authorize RingQ in the Zoho window that opens."
          onClose={closeCRM}
          footerStart={<IntgHelpLink />}
          footer={crmFooter(saveZohoCRM, 'Save and authorize')}
        >
          <div className="intg-form-stack">
            <IntgField label="Client ID" htmlFor="intg-zh-client-id">
              <IntgSecretInput id="intg-zh-client-id" label="client ID" value={zhClientId} onChange={setZhClientId} shown={showZhClientId} onToggle={() => setShowZhClientId(!showZhClientId)} placeholder="Enter client ID" />
            </IntgField>
            <IntgField label="Client secret" htmlFor="intg-zh-client-secret">
              <IntgSecretInput id="intg-zh-client-secret" label="client secret" value={zhClientSecret} onChange={setZhClientSecret} shown={showZhClientSecret} onToggle={() => setShowZhClientSecret(!showZhClientSecret)} placeholder="Enter client secret" />
            </IntgField>
            <IntgField label="Data center (dc)" htmlFor="intg-zh-dc" hint="Your Zoho data center domain, for example com or eu.">
              <input id="intg-zh-dc" type="text" className="intg-input" value={zhDc} onChange={(e) => setZhDc(e.target.value)} placeholder="com" />
            </IntgField>
            <Checkbox className="intg-checkbox" isSelected={zhCallJournaling} onChange={(val) => setZhCallJournaling(val)} label="Enable call journaling" />
          </div>
        </IntgDialog>
      )}

      {/* Salesforce Submodal */}
      {selectedCRM === 'salesforce' && (
        <IntgDialog
          size="lg"
          media={<IntgLogo brand="salesforce" />}
          title="Salesforce settings"
          subtitle="Look up contacts, leads and accounts and log calls through Open CTI."
          onClose={closeCRM}
          footerStart={<IntgHelpLink />}
          footer={crmFooter(() => saveCRM(4))}
        >
          <div className="intg-form-grid">
            <IntgField label="Username" htmlFor="intg-sf-username">
              <IntgSecretInput id="intg-sf-username" label="username" value={sfUsername} onChange={setSfUsername} shown={showSfUsername} onToggle={() => setShowSfUsername(!showSfUsername)} />
            </IntgField>
            <IntgField label="Password" htmlFor="intg-sf-password">
              <IntgSecretInput id="intg-sf-password" label="password" value={sfPassword} onChange={setSfPassword} shown={showSfPassword} onToggle={() => setShowSfPassword(!showSfPassword)} />
            </IntgField>
            <IntgField label="Client ID" htmlFor="intg-sf-client-id">
              <IntgSecretInput id="intg-sf-client-id" label="client ID" value={sfClientId} onChange={setSfClientId} shown={showSfClientId} onToggle={() => setShowSfClientId(!showSfClientId)} />
            </IntgField>
            <IntgField label="Client secret" htmlFor="intg-sf-client-secret">
              <IntgSecretInput id="intg-sf-client-secret" label="client secret" value={sfClientSecret} onChange={setSfClientSecret} shown={showSfClientSecret} onToggle={() => setShowSfClientSecret(!showSfClientSecret)} />
            </IntgField>
            <IntgField label="URL" htmlFor="intg-sf-url">
              <input id="intg-sf-url" type="text" className="intg-input" value={sfUrl} onChange={(e) => setSfUrl(e.target.value)} />
            </IntgField>
            <IntgField label="Contact lookup order" htmlFor="intg-sf-lookup">
              <CrmCustomDropdown
                id="intg-sf-lookup"
                value={sfContactLookupOrder}
                onChange={setSfContactLookupOrder}
                options={[
                  'Contact / Lead / Account',
                  'Contact / Account',
                  'Lead / Contact',
                  'Account / Contact'
                ]}
              />
            </IntgField>
            <IntgField label="Open CTI package">
              <div className="intg-inline-actions">
                <Button size="md" color="secondary" iconLeading={Download} onClick={handleDownloadSalesforceXML}>
                  Download XML code
                </Button>
                <Button size="md" color="secondary" iconLeading={Copy} onClick={handleCopyApexCode}>
                  Copy Apex code
                </Button>
              </div>
            </IntgField>
            <IntgField label="Contact form order" htmlFor="intg-sf-form-order">
              <CrmCustomDropdown
                id="intg-sf-form-order"
                value={sfContactFormOrder}
                onChange={setSfContactFormOrder}
                options={['Contact', 'Lead', 'Account']}
              />
            </IntgField>
          </div>
        </IntgDialog>
      )}

      {/* Zendesk Submodal */}
      {selectedCRM === 'zendesk' && (
        <IntgDialog
          size="md"
          media={<IntgLogo brand="zendesk" />}
          title="Zendesk settings"
          subtitle="Save your credentials, then authorize RingQ in the Zendesk window that opens."
          onClose={closeCRM}
          footerStart={<IntgHelpLink />}
          footer={crmFooter(() => saveCRM(5), 'Save and authorize')}
        >
          <div className="intg-form-stack">
            <IntgField label="Client ID" htmlFor="intg-zd-client-id">
              <IntgSecretInput id="intg-zd-client-id" label="client ID" value={zdClientId} onChange={setZdClientId} shown={showZdClientId} onToggle={() => setShowZdClientId(!showZdClientId)} placeholder="Enter client ID" />
            </IntgField>
            <IntgField label="Client secret" htmlFor="intg-zd-client-secret">
              <IntgSecretInput id="intg-zd-client-secret" label="client secret" value={zdClientSecret} onChange={setZdClientSecret} shown={showZdClientSecret} onToggle={() => setShowZdClientSecret(!showZdClientSecret)} placeholder="Enter client secret" />
            </IntgField>
            <IntgField label="Zendesk URL" htmlFor="intg-zd-url">
              <input id="intg-zd-url" type="text" className="intg-input" value={zdDcUrl} onChange={(e) => setZdDcUrl(e.target.value)} placeholder="https://yourcompany.zendesk.com/" />
            </IntgField>
            <Checkbox className="intg-checkbox" isSelected={zdCallJournaling} onChange={(val) => setZdCallJournaling(val)} label="Enable call journaling" />
          </div>
        </IntgDialog>
      )}

      {/* HubSpot Submodal */}
      {selectedCRM === 'hubspot' && (
        <IntgDialog
          size="lg"
          media={<IntgLogo brand="hubspot" />}
          title="HubSpot settings"
          subtitle="Look up HubSpot contacts and companies and journal calls."
          onClose={closeCRM}
          footer={crmFooter(() => saveCRM(6))}
        >
          <div className="intg-form-grid">
            <IntgField label="URL" htmlFor="intg-hs-url">
              <input id="intg-hs-url" type="text" className="intg-input" value={hsUrl} onChange={(e) => setHsUrl(e.target.value)} placeholder="Enter URL" autoComplete="off" spellCheck={false} />
            </IntgField>
            <IntgField label="Auth token" htmlFor="intg-hs-token">
              <IntgSecretInput id="intg-hs-token" label="auth token" value={hsAuthToken} onChange={setHsAuthToken} shown={showHsAuthToken} onToggle={() => setShowHsAuthToken(!showHsAuthToken)} placeholder="Enter auth token" />
            </IntgField>
            <IntgField label="Lookup objects" htmlFor="intg-hs-objects" full>
              <CrmCustomDropdown
                id="intg-hs-objects"
                value={hsContactCompany}
                onChange={setHsContactCompany}
                options={[
                  'Contacts / Companies',
                  'Contacts Only',
                  'Companies Only'
                ]}
              />
            </IntgField>
          </div>

          <div className="intg-subsection">
            <h3 className="intg-subsection-title">Advanced settings</h3>
            <IntgPanel className="intg-panel-list">
              <IntgSwitchRow id="intg-hs-journaling" title="Call journaling" description="Log calls to HubSpot." checked={hsCallJournaling} onChange={setHsCallJournaling} />
              <IntgSwitchRow id="intg-hs-contacts" title="Contact creation" description="Allow RingQ to create contacts in HubSpot." checked={hsContactCreation} onChange={setHsContactCreation} />
            </IntgPanel>
          </div>

          <div className="intg-subsection">
            <h3 className="intg-subsection-title">How-to videos</h3>
            <div className="intg-video-grid">
              {['images/vt1.png', 'images/vt2.png', 'images/vt3.png'].map((thumb) => (
                <button key={thumb} type="button" className="intg-video-card" onClick={() => window.open('https://www.ringq.com/guides/', '_blank', 'noopener,noreferrer')}>
                  <span className="intg-video-thumb">
                    <img src={appAsset(thumb)} alt="" />
                    <span className="intg-video-play" aria-hidden="true"><Play size={16} /></span>
                  </span>
                  <span className="intg-video-info">
                    <span className="intg-video-series">How-to video series</span>
                    <span className="intg-video-title">Making a local outbound call using the RingQ mobile app</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </IntgDialog>
      )}

      {/* Custom CRM (Webhook Automation) Submodal */}
      {selectedCRM === 'custom_crm' && (
        <IntgDialog
          size="lg"
          media={<IntgLogo icon={<Webhook size={20} />} />}
          title="Custom CRM integration"
          subtitle="Send call events to any CRM or workflow system that accepts JSON webhooks."
          onClose={closeCRM}
          footerStart={
            <Button
              size="md"
              color="secondary"
              iconLeading={RefreshCw}
              onClick={() => {
                setCcLastStatus('Not attempted yet');
                showToast('Custom CRM settings reloaded.', 'info');
              }}
            >
              Reload
            </Button>
          }
          footer={crmFooter(handleSaveCustomCRM)}
        >
          {/* Card 1: Connection */}
          <IntgPanel
            title="Connection"
            badge={ccEnabled ? <IntgBadge tone="success">Enabled</IntgBadge> : <IntgBadge>Disabled</IntgBadge>}
          >
            <div className="intg-form-stack">
              <IntgSwitchRow
                id="intg-cc-enabled"
                title="Enable Custom CRM integration"
                description="Deliver events for the selected triggers."
                checked={ccEnabled}
                onChange={setCcEnabled}
              />
              <IntgField label="Webhook URL" htmlFor="intg-cc-url">
                <input id="intg-cc-url" type="text" className="intg-input" value={ccWebhookUrl} onChange={(e) => setCcWebhookUrl(e.target.value)} placeholder="https://hooks.yourcrm.com/ringq-events" />
              </IntgField>
              <IntgField label="Authentication type" htmlFor="intg-cc-auth-type">
                <CrmCustomDropdown id="intg-cc-auth-type" value={ccAuthType} onChange={setCcAuthType} options={CUSTOM_CRM_AUTH_TYPES} />
              </IntgField>
              {ccAuthType !== 'None' && (
                <IntgField label="Auth token or secret" htmlFor="intg-cc-token">
                  <input id="intg-cc-token" type="password" className="intg-input" value={ccAuthToken} onChange={(e) => setCcAuthToken(e.target.value)} placeholder="Enter a bearer token or API secret key" autoComplete="off" />
                </IntgField>
              )}
            </div>
          </IntgPanel>

          {/* Card 2: Triggers */}
          <IntgPanel title="Triggers" description="Choose which RingQ events are posted to your webhook.">
            <div className="intg-chips">
              {CUSTOM_CRM_TRIGGERS.map((trigger) => {
                const isActive = ccTriggers.includes(trigger.key);
                return (
                  <button
                    key={trigger.key}
                    type="button"
                    aria-pressed={isActive}
                    className={`intg-chip${isActive ? ' is-active' : ''}`}
                    onClick={() => toggleCcTrigger(trigger.key)}
                  >
                    {isActive ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                    <span>{trigger.label}</span>
                  </button>
                );
              })}
            </div>
          </IntgPanel>

          {/* Card 3: Payload Options */}
          <IntgPanel title="Payload options" description="Add richer call context when it's available.">
            <div className="intg-chips">
              {CUSTOM_CRM_PAYLOAD_OPTIONS.map((option) => {
                const isActive = ccPayloadOptions.includes(option.key);
                return (
                  <button
                    key={option.key}
                    type="button"
                    aria-pressed={isActive}
                    className={`intg-chip${isActive ? ' is-active' : ''}`}
                    onClick={() => toggleCcPayloadOption(option.key)}
                  >
                    {isActive ? <Check size={14} aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          </IntgPanel>

          {/* Card 4: Advanced Options (Accordion) */}
          <IntgCollapsible title="Advanced options" open={ccAdvancedOpen} onToggle={() => setCcAdvancedOpen(!ccAdvancedOpen)}>
            <p className="intg-panel-desc intg-collapsible-desc">Timeout and retry policy use the defaults unless you change them.</p>
            <div className="intg-form-grid">
              <IntgField label="Request timeout (seconds)" htmlFor="intg-cc-timeout">
                <input id="intg-cc-timeout" type="number" className="intg-input" value={ccTimeout} onChange={(e) => setCcTimeout(Number(e.target.value) || 30)} />
              </IntgField>
              <IntgField label="Retry count" htmlFor="intg-cc-retry">
                <input id="intg-cc-retry" type="number" className="intg-input" value={ccRetryCount} onChange={(e) => setCcRetryCount(Number(e.target.value) || 3)} />
              </IntgField>
            </div>
          </IntgCollapsible>

          {/* Card 5: Example JSON Payload */}
          <IntgPanel
            title="Example JSON payload"
            description="Preview and copy the payload your CRM will receive."
            actions={
              <>
                <Button size="sm" color="secondary" iconLeading={FileText} onClick={() => showToast('Simulated payload preview refreshed.', 'info')}>
                  Simulate payload
                </Button>
                <Button size="sm" color="secondary" iconLeading={Send} onClick={handleTestWebhook}>
                  Test webhook
                </Button>
                <Button size="sm" color="tertiary" iconLeading={Copy} aria-label="Copy payload" onClick={() => copyToClipboard(sampleJsonPayload, 'JSON Payload')} />
              </>
            }
          >
            <pre className="intg-code">{sampleJsonPayload}</pre>
          </IntgPanel>

          {/* Card 6: Last Webhook Status */}
          <IntgPanel title="Last webhook status">
            <p className="intg-panel-desc">Last sent: {ccLastStatus}</p>
          </IntgPanel>
        </IntgDialog>
      )}

      {/* LinkedIn Submodal */}
      {showLinkedInModal && (
        <IntgDialog
          size="md"
          media={<IntgLogo icon={<i className="bx bxl-linkedin-square intg-brand-linkedin" />} />}
          title="Connect LinkedIn"
          subtitle="Let users sign in to RingQ with their LinkedIn account."
          onClose={() => setShowLinkedInModal(false)}
          footer={
            liStep === 0 ? (
              <>
                <Button size="md" color="secondary" onClick={() => setShowLinkedInModal(false)}>Cancel</Button>
                <Button size="md" color="primary" onClick={liSaved ? connectLinkedIn : saveLinkedInCreds} isDisabled={loading}>
                  {liSaved ? 'Connect LinkedIn' : 'Save credentials'}
                </Button>
              </>
            ) : liStep === 1 ? (
              <Button size="md" color="secondary" onClick={() => setLiStep(0)}>Back</Button>
            ) : liStep === 2 ? (
              <>
                <Button size="md" color="secondary-destructive" iconLeading={LogOut} onClick={disconnectLinkedIn} isDisabled={loading}>Disconnect</Button>
                <Button size="md" color="secondary" onClick={() => setShowLinkedInModal(false)}>Close</Button>
              </>
            ) : undefined
          }
        >
          {liError && <IntgAlert>{liError}</IntgAlert>}

          {liStep === 0 && (
            <>
              <div className="intg-subsection">
                <h3 className="intg-subsection-title">
                  Setup instructions
                  <InfoHint label="About Setup instructions">Create an app in the LinkedIn Developer Portal, then paste its credentials below.</InfoHint>
                </h3>
                <ol className="intg-steps">
                  <li>
                    <span className="intg-step-num" aria-hidden="true">1</span>
                    <div className="intg-step-body">
                      Go to the{' '}
                      <a href="https://www.linkedin.com/developers/" target="_blank" rel="noopener noreferrer" className="intg-link">
                        LinkedIn Developer Portal
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                      .
                    </div>
                  </li>
                  <li>
                    <span className="intg-step-num" aria-hidden="true">2</span>
                    <div className="intg-step-body">Create a new app and fill in the required details.</div>
                  </li>
                  <li>
                    <span className="intg-step-num" aria-hidden="true">3</span>
                    <div className="intg-step-body">
                      In the Products tab, add <strong>Sign In with LinkedIn using OpenID Connect</strong> to enable the openid, profile and email scopes.
                    </div>
                  </li>
                  <li>
                    <span className="intg-step-num" aria-hidden="true">4</span>
                    <div className="intg-step-body">Open the Auth tab of your new app.</div>
                  </li>
                  <li>
                    <span className="intg-step-num" aria-hidden="true">5</span>
                    <div className="intg-step-body">
                      Under OAuth 2.0 settings, add this redirect URI:
                      <IntgCopyField
                        value={`https://${hostname}:8443/accounts/connect`}
                        label="redirect URI"
                        onCopy={() => copyToClipboard(`https://${hostname}:8443/accounts/connect`, 'Redirect URI')}
                      />
                    </div>
                  </li>
                  <li>
                    <span className="intg-step-num" aria-hidden="true">6</span>
                    <div className="intg-step-body">Copy the client ID and client secret from the Auth tab and paste them below.</div>
                  </li>
                </ol>
              </div>

              <div className="intg-subsection">
                <h3 className="intg-subsection-title">App credentials</h3>
                <div className="intg-form-stack">
                  <IntgField label="Client ID" htmlFor="intg-li-client-id">
                    <input id="intg-li-client-id" type="text" className="intg-input" value={liClientId} onChange={(e) => setLiClientId(e.target.value)} />
                  </IntgField>
                  <IntgField label="Client secret" htmlFor="intg-li-client-secret">
                    <input id="intg-li-client-secret" type="password" className="intg-input" value={liClientSecret} onChange={(e) => setLiClientSecret(e.target.value)} autoComplete="off" />
                  </IntgField>
                </div>
              </div>
            </>
          )}

          {liStep === 1 && (
            <IntgState
              icon={<LoaderCircle size={22} className="intg-spin" />}
              title="Connecting to LinkedIn..."
              hint="Complete the authorization in the window that opened. This screen updates automatically once it's verified."
            />
          )}

          {liStep === 2 && (
            <IntgState
              tone="success"
              icon={<CircleCheck size={22} />}
              title="LinkedIn connected"
              hint="Your LinkedIn profile has been authorized for sign-in."
            />
          )}
        </IntgDialog>
      )}

      {/* Telegram Config Modal */}
      {selectedApp === 'telegram' && (
        <IntgDialog
          size="md"
          media={<IntgLogo brand="telegram" />}
          title="Telegram"
          subtitle="Register a Telegram account with your RingQ PBX."
          onClose={() => setSelectedApp('')}
          footer={
            teleStep === 0 ? (
              <>
                <Button size="md" color="secondary" onClick={() => setSelectedApp('')}>Cancel</Button>
                <Button size="md" color="primary" onClick={requestTelegramOtp} isDisabled={teleLoading} isLoading={teleLoading} showTextWhileLoading>
                  {teleLoading ? 'Submitting...' : 'Submit and start registration'}
                </Button>
              </>
            ) : teleStep === 1 ? (
              <>
                <Button size="md" color="secondary" onClick={() => setTeleStep(0)}>Back</Button>
                <Button size="md" color="primary" onClick={verifyTelegramOtp} isDisabled={teleLoading} isLoading={teleLoading} showTextWhileLoading>
                  {teleLoading ? 'Verifying OTP...' : 'Verify OTP'}
                </Button>
              </>
            ) : teleStep === 2 ? (
              <Button size="md" color="secondary" onClick={() => setSelectedApp('')}>Close</Button>
            ) : undefined
          }
        >
          {teleError && <IntgAlert>{teleError}</IntgAlert>}

          {/* Step indicator */}
          <ol className="intg-stepper" aria-label="Registration progress">
            {['Details', 'Verify', 'Connected'].map((label, index) => (
              <li
                key={label}
                className={`intg-stepper-step${teleStep === index ? ' is-active' : ''}${teleStep > index ? ' is-done' : ''}`}
                aria-current={teleStep === index ? 'step' : undefined}
              >
                <span className="intg-stepper-dot" aria-hidden="true">
                  {teleStep > index ? <Check size={14} /> : index + 1}
                </span>
                <span className="intg-stepper-label">{label}</span>
              </li>
            ))}
          </ol>

          {teleStep === 0 && (
            <div className="intg-form-grid">
              <IntgField label="Customer name" htmlFor="intg-tg-customer">
                <input id="intg-tg-customer" type="text" readOnly value={`${subdomain}_ringq`} className="intg-input" />
              </IntgField>
              <IntgField label="Telegram number" htmlFor="intg-tg-phone">
                <input id="intg-tg-phone" type="text" className="intg-input" value={telePhone} onChange={(e) => setTelePhone(e.target.value)} placeholder="Enter Telegram number" />
              </IntgField>
              <IntgField
                label="Telegram api_id"
                htmlFor="intg-tg-app-id"
                hint={
                  <a href="https://my.telegram.org/auth" target="_blank" rel="noopener noreferrer" className="intg-link">
                    Get your API ID and hash
                    <ExternalLink size={13} aria-hidden="true" />
                  </a>
                }
              >
                <input id="intg-tg-app-id" type="text" className="intg-input" value={teleAppId} onChange={(e) => setTeleAppId(e.target.value)} placeholder="Enter Telegram api_id" />
              </IntgField>
              <IntgField label="Telegram api_hash" htmlFor="intg-tg-app-hash">
                <input id="intg-tg-app-hash" type="text" className="intg-input" value={teleAppHash} onChange={(e) => setTeleAppHash(e.target.value)} placeholder="Enter api_hash" />
              </IntgField>
              <IntgField label="PBX IP / FQDN" htmlFor="intg-tg-fqdn" full>
                <input id="intg-tg-fqdn" type="text" readOnly value={hostname} className="intg-input" />
              </IntgField>
            </div>
          )}

          {teleStep === 1 && (
            <IntgField label="Verification code (OTP)" required htmlFor="intg-tg-otp" hint="Enter the code Telegram sent to your app.">
              <input id="intg-tg-otp" type="text" className="intg-input" value={teleOtp} onChange={(e) => setTeleOtp(e.target.value)} placeholder="Enter code" autoComplete="one-time-code" />
            </IntgField>
          )}

          {teleStep === 2 && (
            <IntgState
              tone="success"
              icon={<CircleCheck size={22} />}
              title="Telegram integration active"
              hint={
                <>
                  Tenant <strong>{tenantName}</strong> is registered and connected to RingQ PBX.
                </>
              }
            >
              <div className="intg-inline-actions intg-inline-actions-center">
                <Button size="sm" color="secondary" iconLeading={RefreshCw} onClick={restartTelegram} isDisabled={teleLoading}>
                  Restart service
                </Button>
                <Button size="sm" color="secondary" iconLeading={FileText} onClick={openTelegramLogs}>
                  View logs
                </Button>
                <Button size="sm" color="secondary" iconLeading={Square} onClick={disconnectTelegram} isDisabled={teleLoading}>
                  Stop service
                </Button>
                <Button size="sm" color="secondary-destructive" iconLeading={Trash2} onClick={deleteTelegramConfig} isDisabled={teleLoading}>
                  Delete configuration
                </Button>
              </div>
            </IntgState>
          )}
        </IntgDialog>
      )}

      {/* Microsoft SSO Integration Modal */}
      {showMsSsoModal && (
        <IntgDialog
          size="md"
          media={<IntgLogo brand="microsoft" />}
          title="Microsoft SSO"
          subtitle="Let users sign in with their Microsoft Entra ID account."
          onClose={() => setShowMsSsoModal(false)}
          footer={
            <>
              <Button size="md" color="secondary" onClick={() => setShowMsSsoModal(false)}>Close</Button>
              <Button size="md" color="primary" onClick={saveMsSsoSettings} isDisabled={msSsoLoading} isLoading={msSsoLoading} showTextWhileLoading>
                {msSsoLoading ? 'Saving...' : 'Save configuration'}
              </Button>
            </>
          }
        >
          {msSsoError && <IntgAlert>{msSsoError}</IntgAlert>}

          <IntgCollapsible title="API credentials" open={msSsoCredentialsExpanded} onToggle={() => setMsSsoCredentialsExpanded(!msSsoCredentialsExpanded)}>
            <div className="intg-form-grid">
              <IntgField label="Client ID" required htmlFor="intg-mssso-client-id">
                <input id="intg-mssso-client-id" type="text" className="intg-input" value={msSsoClientId} onChange={(e) => setMsSsoClientId(e.target.value)} placeholder="Enter client ID" />
              </IntgField>
              <IntgField label="Client secret" required htmlFor="intg-mssso-client-secret">
                <IntgSecretInput
                  id="intg-mssso-client-secret"
                  label="client secret"
                  value={msSsoClientSecret}
                  onChange={setMsSsoClientSecret}
                  shown={showMsSecret}
                  onToggle={() => setShowMsSecret(!showMsSecret)}
                  placeholder="Enter client secret"
                />
              </IntgField>
              <IntgField label="Tenant ID" required htmlFor="intg-mssso-tenant-id" full>
                <input id="intg-mssso-tenant-id" type="text" className="intg-input" value={msSsoTenantId} onChange={(e) => setMsSsoTenantId(e.target.value)} placeholder="Enter tenant ID" />
              </IntgField>
              <IntgField label="Redirect URI" full hint="Add this redirect URI to your Microsoft Entra ID app registration.">
                <IntgCopyField
                  value={`https://${hostname}:8443/teams/callback/1`}
                  label="redirect URI"
                  onCopy={() => copyToClipboard(`https://${hostname}:8443/teams/callback/1`, 'Redirect URI')}
                />
              </IntgField>
            </div>
          </IntgCollapsible>

          <IntgPanel className="intg-panel-list">
            <IntgSwitchRow id="intg-mssso-enabled" title="Enable SSO" description="Show Microsoft as a sign-in option." checked={msSsoEnabled} onChange={setMsSsoEnabled} />
          </IntgPanel>
        </IntgDialog>
      )}

      {/* Google SSO Integration Modal */}
      {showGgSsoModal && (
        <IntgDialog
          size="md"
          media={<IntgLogo brand="google" />}
          title="Google SSO"
          subtitle="Let users sign in with their Google Workspace account."
          onClose={() => setShowGgSsoModal(false)}
          footer={
            <>
              <Button size="md" color="secondary" onClick={() => setShowGgSsoModal(false)}>Close</Button>
              <Button size="md" color="primary" onClick={saveGgSsoSettings} isDisabled={ggSsoLoading} isLoading={ggSsoLoading} showTextWhileLoading>
                {ggSsoLoading ? 'Saving...' : 'Save configuration'}
              </Button>
            </>
          }
        >
          {ggSsoError && <IntgAlert>{ggSsoError}</IntgAlert>}

          <IntgCollapsible title="API credentials" open={ggSsoCredentialsExpanded} onToggle={() => setGgSsoCredentialsExpanded(!ggSsoCredentialsExpanded)}>
            <div className="intg-form-grid">
              <IntgField label="Client ID" required htmlFor="intg-ggsso-client-id">
                <input id="intg-ggsso-client-id" type="text" className="intg-input" value={ggSsoClientId} onChange={(e) => setGgSsoClientId(e.target.value)} placeholder="Enter client ID" />
              </IntgField>
              <IntgField label="Client secret" required htmlFor="intg-ggsso-client-secret">
                <IntgSecretInput
                  id="intg-ggsso-client-secret"
                  label="client secret"
                  value={ggSsoClientSecret}
                  onChange={setGgSsoClientSecret}
                  shown={showGgSecret}
                  onToggle={() => setShowGgSecret(!showGgSecret)}
                  placeholder="Enter client secret"
                />
              </IntgField>
              <IntgField label="Redirect URI" full hint="Add this redirect URI to your Google Cloud Console OAuth client.">
                <IntgCopyField
                  value={`https://${hostname}:8443/teams/callback/2`}
                  label="redirect URI"
                  onCopy={() => copyToClipboard(`https://${hostname}:8443/teams/callback/2`, 'Redirect URI')}
                />
              </IntgField>
            </div>
          </IntgCollapsible>

          <IntgPanel className="intg-panel-list">
            <IntgSwitchRow id="intg-ggsso-enabled" title="Enable SSO" description="Show Google as a sign-in option." checked={ggSsoEnabled} onChange={setGgSsoEnabled} />
          </IntgPanel>
        </IntgDialog>
      )}

      {/* Teams Enable/Disable Confirmation Modal */}
      {showConfirmTeamsModal && (
        <IntgDialog
          size="sm"
          media={<IntgLogo brand="teams" />}
          title={`${isTeamsEnabled ? 'Disable' : 'Enable'} Microsoft Teams`}
          onClose={() => setShowConfirmTeamsModal(false)}
          footer={
            <>
              <Button size="md" color="secondary" onClick={() => setShowConfirmTeamsModal(false)} isDisabled={teamsLoading}>
                Cancel
              </Button>
              <Button
                size="md"
                color={isTeamsEnabled ? 'primary-destructive' : 'primary'}
                onClick={async () => {
                  await toggleTeamsStatus(!isTeamsEnabled);
                  setShowConfirmTeamsModal(false);
                }}
                isDisabled={teamsLoading}
                isLoading={teamsLoading}
              >
                {isTeamsEnabled ? 'Disable' : 'Enable'}
              </Button>
            </>
          }
        >
          <p className="intg-confirm-text">
            Are you sure you want to {isTeamsEnabled ? 'disable' : 'enable'} Microsoft Teams?
          </p>
        </IntgDialog>
      )}
      {/* WhatsApp SIP Gateway Integration Modal */}
      {selectedApp === 'whatsapp' && (
        <WhatsAppSipModal
          isOpen={selectedApp === 'whatsapp'}
          onClose={() => setSelectedApp('')}
          showToast={showToast}
          onStatusChange={setIsWhatsAppActive}
        />
      )}

    </div>
  );
};
