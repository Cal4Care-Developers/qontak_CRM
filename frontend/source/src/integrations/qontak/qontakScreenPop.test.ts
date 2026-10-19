import { describe, expect, it } from 'vitest';
import { buildScreenPopUrl } from './qontakScreenPop';

describe('buildScreenPopUrl', () => {
  it('fills {contact_id} and {phone}', () => {
    expect(buildScreenPopUrl('https://app.qontak.com/crm/contacts/{contact_id}', 222592751, '1004'))
      .toBe('https://app.qontak.com/crm/contacts/222592751');
    expect(buildScreenPopUrl('https://app.qontak.com/crm/contacts?search={phone}', null, '+62 812'))
      .toBe('https://app.qontak.com/crm/contacts?search=%2B62%20812');
  });
  it('refuses non-https and missing contact id', () => {
    expect(buildScreenPopUrl('javascript:alert(1)', 1, '1')).toBeNull();
    expect(buildScreenPopUrl('http://example.com/{contact_id}', 1, '1')).toBeNull();
    expect(buildScreenPopUrl('https://app.qontak.com/crm/contacts/{contact_id}', null, '1')).toBeNull();
    expect(buildScreenPopUrl('', 1, '1')).toBeNull();
  });
});

describe('buildScreenPopUrl: Qontak Customer 360', () => {
  const tpl = 'https://chat.qontak.com/customers/{customer_id}';
  it('builds the verified Customer 360 address', () => {
    expect(buildScreenPopUrl(tpl, 222592751, '1004', null, '6ad0483590357cb4a1a597e1'))
      .toBe('https://chat.qontak.com/customers/6ad0483590357cb4a1a597e1');
  });
  it('returns null without a customer id so the caller falls back to All customers', () => {
    expect(buildScreenPopUrl(tpl, 222592751, '1004', null, '')).toBeNull();
  });
});

describe('call reference (must match QontakService::callRef)', () => {
  it('uses the first 8 hex characters of the local call id', async () => {
    const { callRef, qontakTaskSearchUrl } = await import('./qontakScreenPop');
    expect(callRef('1A2B3C4D-aaaa-4bbb-8ccc-000000000000')).toBe('RQ1a2b3c4d');
    expect(qontakTaskSearchUrl('1a2b3c4d-aaaa')).toBe('https://app.qontak.com/crm/tasks?task_name=RQ1a2b3c4d');
  });
});
