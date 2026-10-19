import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import source from './QontakSettingsDialog.tsx?raw';
import apiSource from './qontakApi.ts?raw';

vi.mock('../../services/apiConfig', () => ({ getApiBaseUrl: () => 'https://pbx.test:8443' }));

import QontakSettingsDialog from './QontakSettingsDialog';

const config = {
  enabled: true, environment: 'production', client_id: 'abc12345', client_secret_set: true, crm_user_sso_id: '',
  popup_incoming: true, popup_outgoing: true, call_journaling: true, contact_creation: false, task_category_name: 'Call',
  ai_transcription: false, ai_summary: false, ai_sentiment: false, connection_status: 'connected',
  last_tested_at: null, last_sync_at: null, last_error: null, can_manage: true,
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('QontakSettingsDialog', () => {
  it('never stores credentials in browser storage', () => {
    for (const src of [source, apiSource]) {
      expect(src).not.toMatch(/localStorage|sessionStorage/);
      expect(src).not.toMatch(/console\.(log|info|debug)/);
    }
  });

  it('masks the stored secret and does not resend it when left blank', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ result: 'success', content: config }))
      .mockResolvedValueOnce(json({ result: 'success', message: 'Qontak settings saved.', content: config }));
    vi.stubGlobal('fetch', fetchMock);

    render(<QontakSettingsDialog onClose={() => {}} />);
    const secret = await screen.findByLabelText(/^Client Secret/) as HTMLInputElement;
    expect(secret.type).toBe('password');
    expect(secret.value).toBe('');
    expect(secret.placeholder).toMatch(/stored/);

    fireEvent.click(screen.getByRole('button', { name: /Save configuration/i }));
    await screen.findAllByText('Qontak settings saved.');
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe('https://pbx.test:8443/qontak/config');
    // Live page (:443) -> API (:8443): must be a CORS "simple" request, no preflight.
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
    expect(JSON.parse(init.body).client_secret).toBe('');
  });

  it('requires a secret for a first-time setup and shows the server error on failed test', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ result: 'success', content: { ...config, client_secret_set: false, connection_status: 'not_configured', client_id: '' } }))
      .mockResolvedValueOnce(json({ result: 'error', message: 'Qontak rejected the credentials (HTTP 401).' }, 200));
    vi.stubGlobal('fetch', fetchMock);

    render(<QontakSettingsDialog onClose={() => {}} />);
    await screen.findByLabelText(/^Client Secret/);
    fireEvent.click(screen.getByRole('button', { name: /Test connection/i }));
    expect(await screen.findByText('Client Secret is required.')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByLabelText(/^Client ID/), { target: { value: 'abc12345' } });
    fireEvent.change(screen.getByLabelText(/^Client Secret/), { target: { value: 's3cret' } });
    fireEvent.click(screen.getByRole('button', { name: /Test connection/i }));
    expect((await screen.findAllByText('Qontak rejected the credentials (HTTP 401).')).length).toBeGreaterThan(0);
  });

  it('still shows the credential form when the settings fail to load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ result: 'error', message: 'Qontak database tables are missing.' }, 500)));
    render(<QontakSettingsDialog onClose={() => {}} />);
    expect(await screen.findByText(/Qontak database tables are missing/)).toBeTruthy();
    expect(screen.getByLabelText(/^Client ID/)).toBeTruthy();
    expect(screen.getByLabelText(/^Client Secret/)).toBeTruthy();
    expect((screen.getByRole('button', { name: /Save configuration/i }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('saves with the standard Customer 360 address when the URL box is emptied', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json({ result: 'success', content: config }))
      .mockResolvedValueOnce(json({ result: 'success', message: 'Qontak settings saved.', content: config }));
    vi.stubGlobal('fetch', fetchMock);
    render(<QontakSettingsDialog onClose={() => {}} />);
    const url = await screen.findByLabelText(/^Qontak contact page URL/) as HTMLInputElement;
    fireEvent.change(url, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /Save configuration/i }));
    await screen.findAllByText('Qontak settings saved.');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body).screenpop_url).toBe('https://chat.qontak.com/customers/{customer_id}');
  });

  it('explains why it did not save instead of doing nothing', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ result: 'success', content: config }));
    vi.stubGlobal('fetch', fetchMock);
    render(<QontakSettingsDialog onClose={() => {}} />);
    const url = await screen.findByLabelText(/^Qontak contact page URL/) as HTMLInputElement;
    fireEvent.change(url, { target: { value: 'not a url' } });
    fireEvent.click(screen.getByRole('button', { name: /Save configuration/i }));
    expect((await screen.findAllByText(/Not saved. Please fix/)).length).toBeGreaterThan(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('read-only for non-admins', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({ result: 'success', content: { ...config, can_manage: false } })));
    render(<QontakSettingsDialog onClose={() => {}} />);
    await screen.findByText(/Only administrators/);
    await waitFor(() => expect((screen.getByRole('button', { name: /Save configuration/i }) as HTMLButtonElement).disabled).toBe(true));
  });
});
