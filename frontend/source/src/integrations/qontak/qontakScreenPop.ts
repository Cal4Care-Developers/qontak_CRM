// CRM screen pop.
//
// 1. Call-details window: a separate small browser window (like RingQ's other
//    CRM call-landing pops) that floats above the CRM tab. The bridge renders
//    the live call panel into it with a React portal, so it updates as the
//    call progresses. One named window is reused for every call.
// 2. URL templates (settings) build the "Open in Qontak" link; they may contain
//    {contact_id} and {phone}. Only https:// URLs are ever used.

export const SCREEN_POP_WINDOW = 'qontak-call-window';
const ROOT_ID = 'qontak-call-root';

export function buildScreenPopUrl(
  template: string | undefined | null,
  contactId: string | number | null | undefined,
  phone: string,
  slug?: string | null,
  customerId?: string | null,
): string | null {
  const t = String(template || '').trim();
  if (!t) return null;
  if (t.includes('{contact_id}') && (contactId === null || contactId === undefined || contactId === '')) return null;
  if (t.includes('{slug}') && !slug) return null;
  if (t.includes('{customer_id}') && !customerId) return null;
  const url = t
    .split('{contact_id}').join(encodeURIComponent(String(contactId ?? '')))
    .split('{slug}').join(encodeURIComponent(String(slug ?? '')))
    .split('{customer_id}').join(encodeURIComponent(String(customerId ?? '')))
    .split('{phone}').join(encodeURIComponent(phone || ''));
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

export const QONTAK_TAB = 'qontak-crm';

/** Same reference the backend puts in the task name (QontakService::callRef). */
export const callRef = (localCallId: string): string =>
  'RQ' + localCallId.toLowerCase().replace(/[^0-9a-f]/g, '').slice(0, 8);

/** Qontak's task list filtered to exactly this call's task (task pages have no API-visible id). */
export const qontakTaskSearchUrl = (localCallId: string): string =>
  `https://app.qontak.com/crm/tasks?task_name=${encodeURIComponent(callRef(localCallId))}`;

/** Opens (or reuses) one browser tab for the Qontak page. False when pop-ups are blocked. */
export function openQontakTab(url: string): boolean {
  const win = window.open(url, QONTAK_TAB);
  if (!win) return false;
  try { win.opener = null; } catch { /* cross-origin: already isolated */ }
  return true;
}

/** Copies the app's stylesheets into the popup so the panel looks the same. */
function copyStyles(target: Document) {
  document.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
    if (node instanceof HTMLLinkElement) {
      const link = target.createElement('link');
      link.rel = 'stylesheet';
      link.href = node.href; // absolute: the blank popup has no base URL of its own
      target.head.appendChild(link);
    } else {
      const style = target.createElement('style');
      style.textContent = node.textContent;
      target.head.appendChild(style);
    }
  });
}

export interface CallWindow {
  win: Window;
  root: HTMLElement;
}

/**
 * Opens (or reuses) the call-details window. Returns null when the browser
 * blocked the pop-up (calls start without a click, so the site must be
 * allowed to open pop-ups).
 */
export function openCallWindow(title: string): CallWindow | null {
  const width = 420;
  const height = 640;
  const left = Math.max(0, (window.screenX || 0) + (window.outerWidth || 1200) - width - 40);
  const top = Math.max(0, (window.screenY || 0) + 80);
  const win = window.open('', SCREEN_POP_WINDOW, `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
  if (!win) return null;

  let root: HTMLElement | null = null;
  try {
    root = win.document.getElementById(ROOT_ID);
  } catch {
    // The named window is currently on another site (cross-origin): reset it.
    try { win.location.href = 'about:blank'; } catch { /* ignore */ }
    return null;
  }
  if (!root) {
    const doc = win.document;
    doc.open();
    doc.write('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="qk-window-body"></body></html>');
    doc.close();
    copyStyles(doc);
    root = doc.createElement('div');
    root.id = ROOT_ID;
    doc.body.appendChild(root);
  }
  win.document.title = title;
  win.document.body.classList.toggle('light-mode', document.body.classList.contains('light-mode'));
  win.document.body.classList.add('qk-window-body');
  try { win.focus(); } catch { /* ignore */ }
  return { win, root };
}
