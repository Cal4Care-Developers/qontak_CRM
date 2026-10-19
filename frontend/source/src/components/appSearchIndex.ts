// Search index for AppSearch: keywords/synonyms per page and per Global
// Settings card (so "firewall" finds Security, "backup" finds Time Machine),
// and a small typo-tolerant scorer.

// Sidebar pages, keyed by routePath.
export const PAGE_KEYWORDS: Record<string, string> = {
  '0': 'home overview stats system health cpu memory disk license trunks',
  '24': 'people colleagues staff phonebook presence directory coworkers',
  '1': 'people colleagues staff phonebook presence directory coworkers',
  '3': 'users accounts sip phones devices provisioning extensions groups teams',
  '31': 'hotel rooms guests check in check out wake up pms',
  '2': 'registrations devices online ip registered sip endpoints',
  '23': 'permissions owner manager access roles admin rights',
  '4': 'voicemail messages inbox recordings',
  '5': 'address book phonebook customers crm contacts',
  '6': 'queue stats agents live monitoring supervisor dashboard',
  '22': 'messages whatsapp facebook telegram line webchat conversations inbox chat',
  '30': 'fax send fax inbox pdf efax',
  '9': 'text message bulk sms texting',
  '7': 'call status active calls live calls',
  '13': 'reports statistics analytics',
  '20': 'branding theme white label colors logo appearance',
  '12': 'ivr routing queues dids numbers gateways trunks auto attendant menu inbound call routing',
  '19': 'settings configuration admin system preferences',
  '28': 'help guides docs tutorials support',
  '29': 'apps integrations marketplace downloads mobile app',
  '16': 'my profile account password avatar photo personal',
};

// Global Settings cards, keyed by card title.
export const SETTING_KEYWORDS: Record<string, string> = {
  'Outbound Rules': 'dial plan outbound routes prefix calling rules trunk routing outgoing',
  'Emergency Rules': '911 999 112 000 emergency calling e911',
  'Language and Office Hours': 'timezone time zone business hours holidays schedule opening hours language working hours',
  'Music On Hold': 'moh hold music audio waiting',
  'Security': 'firewall block ip blacklist whitelist allow countries anti hacking sip guard fail2ban pin auto logout',
  'Service Restart': 'restart reboot services ringq call services freeswitch troubleshoot phones ringing chat meetings transfers queues',
  'Updates': 'upgrade version build release update',
  'Time Machine': 'backup restore snapshot backups',
  'Aux Codes': 'break codes pause status agent away',
  'Wrap Up Codes': 'disposition after call wrapup',
  'A.I. Transcribe': 'transcription transcribe speech to text ai',
  'A.I. Agent': 'bot voice assistant ai agent virtual receptionist',
  'Email Notification': 'smtp alerts email mail notifications',
  'Chat Settings': 'whatsapp facebook telegram line webchat twilio telnyx channels chat',
  'Network': 'ip address public ip codec nat interface network',
  'Parameters': 'phone templates provisioning yealink devices desk phones',
  'SIP Profile': 'sip tls transport codecs profile',
  'SMS Playground': 'api test sms endpoints chat api',
  'Integrations': 'crm sso microsoft teams hubspot zoho salesforce qontak mekari api single sign on',
  'Migration': 'import csv zip bulk upload',
  'Port Scanner': 'ports firewall open ports connectivity',
  'Call Debug': 'logs debug troubleshooting trace',
  'Capture': 'pcap packet capture sip trace wireshark',
  'Audit Logs': 'history activity who changed log audit',
  'Call Flow': 'call flow toggle',
  'Call Landing': 'popup screen pop incoming call url',
  'Reports': 'call logs cdr statistics analytics export ratings',
  'SSL': 'certificate https tls renew letsencrypt cert',
  'Storage': 'disk space cleanup recordings retention storage',
  'Secure Tunnel': 'vpn tunnel remote access',
  'Support Access': 'support remote diagnostics mcp grant engineer troubleshoot consent help',
};

// ---------- Scoring ----------

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();

const words = (s: string): string[] => (s ? normalize(s).split(' ').filter(Boolean) : []);

// Optimal string alignment distance (Levenshtein + adjacent swaps), capped.
const editDistance = (a: string, b: string, cap: number): number => {
  if (Math.abs(a.length - b.length) > cap) return cap + 1;
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    let rowMin = Infinity;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
      rowMin = Math.min(rowMin, d[i][j]);
    }
    if (rowMin > cap) return cap + 1;
  }
  return d[a.length][b.length];
};

// How well one query word matches one field's words. 0 = no match.
const tokenScore = (q: string, fieldWords: string[]): number => {
  let best = 0;
  const allowed = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0;
  for (const w of fieldWords) {
    if (w === q) return 4;
    if (w.startsWith(q)) best = Math.max(best, 3);
    else if (q.length >= 3 && w.includes(q)) best = Math.max(best, 2);
    // Typos keep the first letter in practice -- requiring it stops "extention"
    // from also matching "retention".
    else if (allowed > 0 && w.length >= 3 && w[0] === q[0]) {
      // Typos: compare with the whole word and with its same-length prefix
      // (so "secur" / "secru" still find "security").
      const dist = Math.min(editDistance(q, w, allowed), editDistance(q, w.slice(0, q.length), allowed));
      if (dist <= allowed) best = Math.max(best, 1.6 - dist * 0.3);
    }
  }
  return best;
};

export interface SearchField {
  text?: string;
  weight: number;
}

/** Score a candidate against the query; -1 when some query word matches nothing. */
export const scoreFields = (query: string, fields: SearchField[]): number => {
  const qWords = words(query);
  if (qWords.length === 0) return 0;
  const prepared = fields.map((f) => ({ w: words(f.text || ''), weight: f.weight }));
  let total = 0;
  for (const qw of qWords) {
    let best = 0;
    for (const f of prepared) best = Math.max(best, tokenScore(qw, f.w) * f.weight);
    if (best === 0) return -1;
    total += best;
  }
  // Whole-phrase bonus: the primary field starts with what was typed.
  const primary = normalize(fields[0]?.text || '');
  const phrase = normalize(query);
  if (primary.startsWith(phrase)) total += 3;
  else if (primary.includes(phrase)) total += 1;
  return total;
};
