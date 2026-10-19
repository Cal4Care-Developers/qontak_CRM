import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sipService } from '../../services/sipService';
import { qontakApi, ok, QONTAK_CONFIG_CHANGED } from './qontakApi';
import type { CallEventInput, QontakConfig, QontakContact } from './qontakApi';
import { initialTrackerState, stepTracker } from './qontakCallTracker';
import type { TrackedCall } from './qontakCallTracker';
import { toast } from 'react-toastify';
import { buildScreenPopUrl, openCallWindow, openQontakTab, qontakTaskSearchUrl } from './qontakScreenPop';
import type { CallWindow } from './qontakScreenPop';
import { QontakContactPopup } from './QontakContactPopup';
import type { LookupState } from './QontakContactPopup';
import './qontak.css';

// Mounted once in App.jsx. It is a passive listener on sipService: it never
// calls answer/reject/hangup and never awaits anything on the call path, so
// the dialer behaves exactly the same whether Qontak is enabled, disabled,
// slow or offline. When the integration is disabled (or the config can't be
// read) it doesn't subscribe at all and renders nothing.

const EVENT_RETRY_DELAYS = [2000, 8000, 30000];

const sendEvent = async (input: CallEventInput, attempt = 0): Promise<void> => {
  try {
    const data = await qontakApi.callEvent(input);
    if (ok(data)) return;
    // 4xx-style answers (validation, disabled) are final; only retry transport/5xx errors.
    if (data?.message && !/timeout|unavailable|temporar|try again/i.test(data.message)) return;
  } catch {
    // network error -> retry below
  }
  if (attempt < EVENT_RETRY_DELAYS.length) {
    window.setTimeout(() => { void sendEvent(input, attempt + 1); }, EVENT_RETRY_DELAYS[attempt]);
  }
};

export interface PopupCall extends TrackedCall {
  status: 'ringing' | 'active' | 'ended';
  finalStatus?: string;
}

const QontakCallBridge: React.FC = () => {
  const [config, setConfig] = useState<QontakConfig | null>(null);
  // The active call shown in the in-app popup and/or the call-details window.
  const [popupCall, setPopupCall] = useState<PopupCall | null>(null);
  const [inAppVisible, setInAppVisible] = useState(false);
  const [callWindow, setCallWindow] = useState<CallWindow | null>(null);
  const [lookup, setLookup] = useState<LookupState>({ kind: 'idle' });
  const [selectedContact, setSelectedContact] = useState<QontakContact | null>(null);
  const selectedContactRef = useRef<QontakContact | null>(null);
  const lookupAbortRef = useRef<AbortController | null>(null);
  const trackerRef = useRef(initialTrackerState());
  const configRef = useRef<QontakConfig | null>(null);
  const callRef = useRef<{ localCallId: string; direction: 'inbound' | 'outbound'; phone: string } | null>(null);
  const poppedRef = useRef<string | null>(null);

  useEffect(() => { configRef.current = config; }, [config]);

  // Contact card "Open in Qontak" link (a click is never pop-up blocked).
  const withUrl = useCallback((c: QontakContact): QontakContact => {
    const url = buildScreenPopUrl(configRef.current?.screenpop_url, c.id, callRef.current?.phone || c.telephone || '', c.slug, c.customer_id);
    return url ? { ...c, url } : c;
  }, []);

  const blockedToast = () => toast.error('Your browser blocked the Qontak pop-up. Allow pop-ups for this site, then it will open on the next call.', {
    containerId: 'call-landing',
    toastId: 'qontak-popup-blocked',
    autoClose: 10000,
  });

  // Screen pop in "Qontak contact page" mode: once the caller is known, open
  // their Qontak page in one reused tab (or the unknown-caller page).
  const qontakTabPoppedRef = useRef<string | null>(null);
  const maybeOpenQontakTab = useCallback((contact: QontakContact | null, fallback = false) => {
    const cfg = configRef.current;
    const call = callRef.current;
    if (!cfg || !call || cfg.screenpop_target === 'window' || qontakTabPoppedRef.current === call.localCallId) return;
    // In task mode the pop is opened by sendStartedThenPop; customer page only as its fallback.
    if (cfg.screenpop_target === 'qontak_task' && !fallback) return;
    const wanted = call.direction === 'inbound' ? cfg.screenpop_incoming : cfg.screenpop_outgoing;
    // Diagnostics only (no secrets): explains in the browser console why a pop did or didn't open.
    const trace = (outcome: string, extra: Record<string, unknown> = {}) => console.info('[Qontak screen pop]', outcome, {
      direction: call.direction, enabledForDirection: wanted, target: cfg.screenpop_target, template: contact ? cfg.screenpop_url : cfg.screenpop_unknown_url,
      contactId: contact?.id ?? null, hasSlug: !!contact?.slug, ...extra,
    });
    if (!wanted) { trace('skipped: screen pop is off for this call direction'); return; }
    // Known contact without a Customer 360 id yet (no call task so far): fall
    // back to the unknown-caller page (default: All customers).
    const url = (contact && buildScreenPopUrl(cfg.screenpop_url, contact.id, call.phone, contact.slug, contact.customer_id))
      || buildScreenPopUrl(cfg.screenpop_unknown_url, null, call.phone);
    if (!url) {
      trace(contact ? 'skipped: could not build the Qontak page address' : 'skipped: no Qontak contact and no Unknown caller URL');
      if (contact) {
        toast.error('Qontak screen pop: the contact page address could not be built. Check "Qontak contact page URL" in Qontak settings.', {
          containerId: 'call-landing', toastId: 'qontak-popup-url', autoClose: 10000,
        });
      }
      return;
    }
    qontakTabPoppedRef.current = call.localCallId;
    const opened = openQontakTab(url);
    trace(opened ? 'opened' : 'blocked by the browser pop-up blocker', { url });
    if (!opened) blockedToast();
  }, []);

  // Task mode: send 'started' and wait for the backend to create this call's
  // Qontak task, then open Qontak's task list filtered to exactly that task.
  const sendStartedThenPop = useCallback(async (ev: CallEventInput) => {
    let taskId: string | null = null;
    try {
      const data = await qontakApi.callEvent(ev);
      taskId = ok(data) ? (data.content?.journal?.qontak_task_id ?? null) : null;
      if (!ok(data)) void sendEvent(ev, 1);
    } catch {
      void sendEvent(ev, 1);
    }
    const call = callRef.current;
    if (!call || call.localCallId !== ev.local_call_id || qontakTabPoppedRef.current === call.localCallId) return;
    if (!taskId) {
      console.info('[Qontak screen pop]', 'no task yet: opening the customer page instead', { local_call_id: ev.local_call_id });
      maybeOpenQontakTab(selectedContactRef.current, true);
      return;
    }
    qontakTabPoppedRef.current = call.localCallId;
    const url = qontakTaskSearchUrl(ev.local_call_id);
    const opened = openQontakTab(url);
    console.info('[Qontak screen pop]', opened ? 'opened task' : 'blocked by the browser pop-up blocker', { url });
    if (!opened) blockedToast();
  }, [maybeOpenQontakTab]);

  // CRM screen pop: once per call, open (or reuse) the call-details window.
  // Calls start without a click, so the browser must allow pop-ups for this site.
  const openScreenPopWindow = useCallback((remoteNumber: string) => {
    const call = callRef.current;
    if (!call || poppedRef.current === call.localCallId) return;
    poppedRef.current = call.localCallId;
    const cw = openCallWindow(`Qontak · ${call.direction === 'inbound' ? 'Incoming' : 'Outgoing'} call ${remoteNumber}`);
    if (!cw) {
      blockedToast();
      return;
    }
    cw.win.addEventListener('pagehide', () => setCallWindow(null), { once: true });
    setCallWindow(cw);
  }, []);

  const loadConfig = useCallback(async () => {
    try {
      const data = await qontakApi.getConfig();
      setConfig(ok(data) && data.content ? (data.content as QontakConfig) : null);
    } catch {
      setConfig(null);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    const onChanged = () => { void loadConfig(); };
    window.addEventListener(QONTAK_CONFIG_CHANGED, onChanged);
    return () => window.removeEventListener(QONTAK_CONFIG_CHANGED, onChanged);
  }, [loadConfig]);

  const runLookup = useCallback(async (phone: string) => {
    lookupAbortRef.current?.abort();
    if (!phone) { setLookup({ kind: 'none' }); return; }
    const controller = new AbortController();
    lookupAbortRef.current = controller;
    setLookup({ kind: 'loading' });
    try {
      const data = await qontakApi.searchContacts(phone, controller.signal);
      if (controller.signal.aborted) return;
      if (!ok(data)) { setLookup({ kind: 'error', message: data?.message || 'Qontak lookup failed.' }); return; }
      const contacts: QontakContact[] = (Array.isArray(data.content?.contacts) ? data.content.contacts : []).map(withUrl);
      if (contacts.length === 1) {
        selectedContactRef.current = contacts[0];
        setSelectedContact(contacts[0]);
        maybeOpenQontakTab(contacts[0]);
      } else if (contacts.length === 0) {
        maybeOpenQontakTab(null);
      }
      // Several matches: the Qontak tab waits until the agent picks one.
      setLookup(contacts.length === 0 ? { kind: 'none' } : { kind: 'found', contacts });
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      setLookup({ kind: 'error', message: 'Qontak is unreachable. The call is not affected.' });
    }
  }, [withUrl, maybeOpenQontakTab]);

  const enabled = !!config?.enabled && config.connection_status !== 'disconnected';

  useEffect(() => {
    if (!enabled || !config) return undefined;
    trackerRef.current = initialTrackerState();

    const unsubscribe = sipService.subscribe((_reg, info) => {
      const { state, events } = stepTracker(trackerRef.current, info);
      trackerRef.current = state;

      for (const ev of events) {
        if (ev.event === 'started') {
          selectedContactRef.current = null;
          setSelectedContact(null);
          callRef.current = { localCallId: ev.local_call_id, direction: ev.direction, phone: ev.remote_number };
          const inbound = ev.direction === 'inbound';
          const wantsPopup = inbound ? config.popup_incoming : config.popup_outgoing;
          const wantsScreenPop = inbound ? config.screenpop_incoming : config.screenpop_outgoing;
          setInAppVisible(wantsPopup);
          setPopupCall(wantsPopup || wantsScreenPop ? { ...(state.call as TrackedCall), status: 'ringing' } : null);
          if (wantsScreenPop && config.screenpop_target === 'window') openScreenPopWindow(ev.remote_number);
          if (wantsPopup || wantsScreenPop) void runLookup(ev.remote_number);
        } else if (ev.event === 'answered') {
          setPopupCall((prev) => (prev && prev.localCallId === ev.local_call_id ? { ...prev, status: 'active', answeredAt: ev.answered_at ?? null } : prev));
        } else if (ev.event === 'ended') {
          ev.qontak_contact_id = selectedContactRef.current?.id ?? null;
          setPopupCall((prev) => (prev && prev.localCallId === ev.local_call_id ? { ...prev, status: 'ended', finalStatus: ev.status } : prev));
        }
        // Journaling is server-side and asynchronous; the 'started' event is
        // what lets the backend create the journal row even if the tab dies.
        if (!config.call_journaling) continue;
        const taskPop = ev.event === 'started' && config.screenpop_target === 'qontak_task'
          && (ev.direction === 'inbound' ? config.screenpop_incoming : config.screenpop_outgoing);
        if (taskPop) void sendStartedThenPop(ev);
        else void sendEvent(ev);
      }
    });

    return () => {
      unsubscribe();
      lookupAbortRef.current?.abort();
    };
  }, [enabled, config, runLookup, openScreenPopWindow, sendStartedThenPop]);

  const selectContact = useCallback((contact: QontakContact) => {
    const c = withUrl(contact);
    selectedContactRef.current = c;
    setSelectedContact(c);
    maybeOpenQontakTab(c);
  }, [withUrl, maybeOpenQontakTab]);

  const onContactCreated = useCallback((contact: QontakContact) => {
    selectContact(contact);
    setLookup({ kind: 'found', contacts: [contact] });
  }, [selectContact]);

  if (!enabled || !popupCall) return null;

  const panelProps = {
    call: popupCall,
    lookup,
    selectedContact,
    canCreateContact: !!config?.contact_creation,
    journaling: !!config?.call_journaling,
    onSelectContact: selectContact,
    onContactCreated,
    onRetryLookup: () => void runLookup(popupCall.remoteNumber),
  };

  return (
    <>
      {inAppVisible && <QontakContactPopup {...panelProps} onClose={() => setInAppVisible(false)} />}
      {callWindow && !callWindow.win.closed && createPortal(
        <QontakContactPopup {...panelProps} inline onClose={() => { try { callWindow.win.close(); } catch { /* ignore */ } setCallWindow(null); }} />,
        callWindow.root,
      )}
    </>
  );
};

export default QontakCallBridge;
