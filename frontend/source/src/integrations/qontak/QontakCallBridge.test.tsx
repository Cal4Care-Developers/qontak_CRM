import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';

vi.mock('../../services/apiConfig', () => ({ getApiBaseUrl: () => 'https://pbx.test:8443' }));

type Listener = (reg: any, info: any) => void;
const listeners = new Set<Listener>();
vi.mock('../../services/sipService', () => ({
  sipService: {
    subscribe: (l: Listener) => { listeners.add(l); l('REGISTERED', { state: 'IDLE', direction: null, remoteNumber: '', duration: 0 }); return () => listeners.delete(l); },
  },
}));

import QontakCallBridge from './QontakCallBridge';

const config = {
  enabled: true, environment: 'production', client_id: 'x', client_secret_set: true, crm_user_sso_id: '',
  popup_incoming: true, popup_outgoing: true, call_journaling: true, contact_creation: false, task_category_name: 'Call',
  ai_transcription: false, ai_summary: false, ai_sentiment: false, connection_status: 'connected',
  last_tested_at: null, last_sync_at: null, last_error: null, can_manage: true,
};
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const emit = (info: any) => act(() => { listeners.forEach((l) => l('REGISTERED', { duration: 0, ...info })); });

afterEach(() => { cleanup(); listeners.clear(); vi.unstubAllGlobals(); });

const stubFetch = () => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
  if (url.includes('/qontak/config')) return json({ result: 'success', content: config });
  if (url.includes('/qontak/contactsSearch')) return json({ result: 'success', content: { contacts: [{ id: 7, full_name: 'Test Caller', telephone: '916381179578', email: 't@x.co' }] } });
  return json({ result: 'success', content: { journal: null } });
}));

const fakeWindow = () => {
  const doc = document.implementation.createHTMLDocument('popup');
  return { document: doc, closed: false, focus: vi.fn(), close: vi.fn(), addEventListener: vi.fn(), location: { href: '' } } as any;
};

describe('QontakCallBridge call window (screen pop)', () => {
  const cfg = { ...config, popup_incoming: false, popup_outgoing: false, screenpop_incoming: true, screenpop_outgoing: false,
    screenpop_url: 'https://app.qontak.com/crm/contacts/{contact_id}', screenpop_unknown_url: '', screenpop_target: 'window' };
  const stub = () => vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (url.includes('/qontak/config')) return json({ result: 'success', content: cfg });
    if (url.includes('/qontak/contactsSearch')) return json({ result: 'success', content: { contacts: [{ id: 7, full_name: 'Test Caller', telephone: '916381179578' }] } });
    return json({ result: 'success', content: { journal: null } });
  }));

  it('opens one reusable call window with live call details on an incoming call', async () => {
    stub();
    const win = fakeWindow();
    const open = vi.fn((..._args: unknown[]) => win);
    vi.stubGlobal('open', open);
    render(<QontakCallBridge />);
    await vi.waitFor(() => expect(listeners.size).toBe(1));
    emit({ state: 'RINGING', direction: 'INCOMING', remoteNumber: '916381179578' });
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(open.mock.calls[0][0]).toBe('');
    expect(open.mock.calls[0][1]).toBe('qontak-call-window');
    await vi.waitFor(() => expect(win.document.body.textContent).toContain('Test Caller'));
    expect(win.document.body.textContent).toContain('Incoming call');
    const link = win.document.querySelector('a.qk-link') as HTMLAnchorElement;
    expect(link.href).toBe('https://app.qontak.com/crm/contacts/7');
    // in-app popup is off in this config: nothing floats over the RingQ app
    expect(screen.queryByRole('complementary', { name: 'Qontak contact' })).toBeNull();
    emit({ state: 'ACTIVE', direction: 'INCOMING', remoteNumber: '916381179578' });
    await vi.waitFor(() => expect(win.document.body.textContent).toContain('In call'));
    expect(open).toHaveBeenCalledTimes(1);
  });

  it('does not open the window for outgoing calls when only incoming is enabled', async () => {
    stub();
    const open = vi.fn(() => fakeWindow());
    vi.stubGlobal('open', open);
    render(<QontakCallBridge />);
    await vi.waitFor(() => expect(listeners.size).toBe(1));
    emit({ state: 'DIALING', direction: 'OUTGOING', remoteNumber: '1004' });
    await new Promise((r) => setTimeout(r, 50));
    expect(open).not.toHaveBeenCalled();
  });
});

describe('QontakCallBridge Qontak tab (screen pop)', () => {
  it('opens the caller Qontak page (by slug) in one reused tab', async () => {
    const cfg = { ...config, popup_incoming: true, screenpop_incoming: true, screenpop_outgoing: true, screenpop_target: 'qontak_tab',
      screenpop_url: 'https://app.qontak.com/crm/contacts/{slug}', screenpop_unknown_url: '' };
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/qontak/config')) return json({ result: 'success', content: cfg });
      if (url.includes('/qontak/contactsSearch')) return json({ result: 'success', content: { contacts: [{ id: 7, slug: 'be44ef97-9b2a-4192-a4d7-8994b1f81ed8', full_name: 'Test Caller' }] } });
      return json({ result: 'success', content: { journal: null } });
    }));
    const open = vi.fn((..._args: unknown[]) => ({ opener: {} }) as any);
    vi.stubGlobal('open', open);
    render(<QontakCallBridge />);
    await vi.waitFor(() => expect(listeners.size).toBe(1));
    emit({ state: 'RINGING', direction: 'INCOMING', remoteNumber: '916381179578' });
    await vi.waitFor(() => expect(open).toHaveBeenCalledWith('https://app.qontak.com/crm/contacts/be44ef97-9b2a-4192-a4d7-8994b1f81ed8', 'qontak-crm'));
    emit({ state: 'ACTIVE', direction: 'INCOMING', remoteNumber: '916381179578' });
    expect(open).toHaveBeenCalledTimes(1);
  });
});

describe('QontakCallBridge Customer 360 screen pop', () => {
  const cfg = { ...config, popup_incoming: true, popup_outgoing: true, screenpop_incoming: true, screenpop_outgoing: true, screenpop_target: 'qontak_tab',
    screenpop_url: 'https://chat.qontak.com/customers/{customer_id}', screenpop_unknown_url: 'https://chat.qontak.com/customers/all-customers' };
  const run = async (contact: Record<string, unknown>) => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/qontak/config')) return json({ result: 'success', content: cfg });
      if (url.includes('/qontak/contactsSearch')) return json({ result: 'success', content: { contacts: [contact] } });
      return json({ result: 'success', content: { journal: null } });
    }));
    const open = vi.fn((..._args: unknown[]) => ({ opener: {} }) as any);
    vi.stubGlobal('open', open);
    render(<QontakCallBridge />);
    await vi.waitFor(() => expect(listeners.size).toBe(1));
    emit({ state: 'DIALING', direction: 'OUTGOING', remoteNumber: '1004' });
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    return open.mock.calls[0];
  };
  it('opens the caller Customer 360 page on an outgoing call', async () => {
    expect(await run({ id: 222592751, full_name: 'paramesh waran', customer_id: '6ad0483590357cb4a1a597e1' }))
      .toEqual(['https://chat.qontak.com/customers/6ad0483590357cb4a1a597e1', 'qontak-crm']);
  });
  it('falls back to All customers when the contact has no Customer 360 id yet', async () => {
    expect(await run({ id: 5, full_name: 'New person', customer_id: '' }))
      .toEqual(['https://chat.qontak.com/customers/all-customers', 'qontak-crm']);
  });
});

describe('QontakCallBridge task screen pop', () => {
  it('waits for the start-of-call task, then opens Qontak tasks filtered to this call', async () => {
    const cfg = { ...config, popup_outgoing: true, screenpop_incoming: true, screenpop_outgoing: true, screenpop_target: 'qontak_task',
      screenpop_url: 'https://chat.qontak.com/customers/{customer_id}', screenpop_unknown_url: 'https://chat.qontak.com/customers/all-customers' };
    const fetchMock = vi.fn(async (url: string, init?: any) => {
      if (url.includes('/qontak/config')) return json({ result: 'success', content: cfg });
      if (url.includes('/qontak/contactsSearch')) return json({ result: 'success', content: { contacts: [{ id: 222592751, full_name: 'paramesh waran', customer_id: '6ad0483590357cb4a1a597e1' }] } });
      if (url.includes('/qontak/callEvents')) {
        const body = JSON.parse(init.body);
        return json({ result: 'success', content: { journal: { local_call_id: body.local_call_id, qontak_task_id: '14600000' } } });
      }
      return json({ result: 'success', content: { journal: null } });
    });
    vi.stubGlobal('fetch', fetchMock);
    const open = vi.fn((..._args: unknown[]) => ({ opener: {} }) as any);
    vi.stubGlobal('open', open);
    vi.stubGlobal('crypto', { randomUUID: () => '1a2b3c4d-0000-4000-8000-000000000000' });
    render(<QontakCallBridge />);
    await vi.waitFor(() => expect(listeners.size).toBe(1));
    emit({ state: 'DIALING', direction: 'OUTGOING', remoteNumber: '1004' });
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(1));
    expect(open.mock.calls[0]).toEqual(['https://app.qontak.com/crm/tasks?task_name=RQ1a2b3c4d', 'qontak-crm']);
    // the started event was sent exactly once (no duplicate from the normal sender)
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/qontak/callEvents')).length).toBe(1);
  });
});

describe('QontakCallBridge popup', () => {
  it('shows the contact popup for an outgoing call', async () => {
    stubFetch();
    render(<QontakCallBridge />);
    await vi.waitFor(() => expect(listeners.size).toBe(1));
    emit({ state: 'DIALING', direction: 'OUTGOING', remoteNumber: '916381179578' });
    expect(await screen.findByRole('complementary', { name: 'Qontak contact' })).toBeTruthy();
    expect((await screen.findAllByText('Test Caller')).length).toBeGreaterThan(0);
  });

  it('shows the contact popup for an incoming call', async () => {
    stubFetch();
    render(<QontakCallBridge />);
    await vi.waitFor(() => expect(listeners.size).toBe(1));
    emit({ state: 'RINGING', direction: 'INCOMING', remoteNumber: '916381179578' });
    expect(await screen.findByText(/Incoming call/)).toBeTruthy();
  });
});
