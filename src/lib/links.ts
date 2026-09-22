/**
 * Web addresses the student saves under "Ressourcen".
 *
 * Only http(s) is ever stored or rendered as a link – checked when it is typed in AND when synced
 * data is read (state.ts): the sync store is publicly writable, and a "javascript:" address would
 * otherwise be one tap away from running code inside the app.
 */

/**
 * The check applied to synced data. Deliberately a plain pattern instead of the URL parser: every
 * browser must keep exactly the same records, or two devices would keep dropping each other's links.
 */
export const isWebUrl = (s: string): boolean => /^https?:\/\/[^\s/?#]+\S*$/i.test(s);

/**
 * What was typed or pasted → a clean address, or null if it is not a web address.
 * "moodle-app2.let.ethz.ch/course/view.php?id=1" simply gets its missing "https://".
 */
export function normalizeUrl(input: string): string | null {
  let s = input.trim().replace(/^<(.*)>$/, '$1');
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) {
    // Any other scheme (javascript:, mailto:, file: …) is refused – "localhost:5173" is a host and a port.
    if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(s)) return null;
    s = `https://${s.replace(/^\/+/, '')}`;
  }
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null;
  return u.href;
}

export const hostOf = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/** Services a student at ETH links to all the time – named the way people say them. */
const KNOWN: [RegExp, string][] = [
  [/(^|\.)moodle[\w-]*\./, 'Moodle'],
  [/^video\.ethz\.ch$/, 'Aufzeichnungen'],
  [/^expert\.ethz\.ch$/, 'CodeExpert'],
  [/^polybox\.ethz\.ch$/, 'Polybox'],
  [/^mystudies\.ethz\.ch$/, 'myStudies'],
  [/^vvz\.ethz\.ch$/, 'Vorlesungsverzeichnis'],
  [/(^|\.)youtube\.com$|^youtu\.be$/, 'YouTube'],
  [/(^|\.)github\.com$/, 'GitHub'],
  [/(^|\.)overleaf\.com$/, 'Overleaf'],
  [/^docs\.google\.com$/, 'Google Docs'],
  [/^drive\.google\.com$/, 'Google Drive'],
  [/(^|\.)notion\.(so|site)$/, 'Notion'],
  [/(^|\.)zoom\.us$/, 'Zoom'],
  [/(^|\.)edstem\.org$/, 'Ed Discussion'],
  [/(^|\.)wolframalpha\.com$/, 'WolframAlpha'],
];

/** A name for a link nobody named: a PDF by its file name, known services by host, else the host. */
export function suggestLabel(url: string): string {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }
  let file = u.pathname.split('/').pop() ?? '';
  try {
    file = decodeURIComponent(file);
  } catch {
    /* keep it encoded */
  }
  if (/\.pdf$/i.test(file)) return file.replace(/\.pdf$/i, '').replace(/[_+]+/g, ' ').trim() || 'PDF';
  const host = hostOf(url);
  return KNOWN.find(([re]) => re.test(host))?.[1] ?? host;
}

/** "Skript https://…/x.pdf" pasted in one go → the address, and the words around it as a name. */
export function splitPasted(text: string): { url: string; rest: string } | null {
  const m = text.match(/https?:\/\/\S+/i);
  if (!m) return null;
  const rest = text.replace(m[0], ' ').replace(/\s+/g, ' ').replace(/^[\s:,;–-]+|[\s:,;–-]+$/g, '').trim();
  return { url: m[0], rest };
}
