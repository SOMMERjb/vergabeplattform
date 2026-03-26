/**
 * Fetcher for the "Datenservice Öffentlicher Einkauf" (DÖE)
 * Official German public procurement data service run by Beschaffungsamt (BeschA).
 * Portal: https://www.oeffentlichevergabe.de
 * Open Data API docs: https://oeffentlichevergabe.de/documentation/swagger-ui/opendata/index.html
 *
 * The API is public and requires no authentication.
 */

import { Tender } from '../types';

const BASE = 'https://oeffentlichevergabe.de/opendata';

// eForms-DE notice shape (simplified – only fields we care about)
interface DoeNotice {
  id?: string;
  noticeId?: string;
  publicationId?: string;
  title?: string | Record<string, string>;
  description?: string | Record<string, string>;
  buyerName?: string | Record<string, string>;
  contractingAuthorityName?: string;
  publishDate?: string;
  publicationDate?: string;
  submissionDeadline?: string;
  deadlineDate?: string;
  estimatedValue?: number | { amount?: number; currency?: string } | null;
  currency?: string;
  cpvCode?: string | { code?: string; description?: string };
  cpvCodes?: Array<string | { code?: string; description?: string }>;
  nutsCode?: string | string[];
  nutsCodes?: string | string[];
  noticeType?: string;
  procedureType?: string;
  url?: string;
  noticeUrl?: string;
  // Spring Page wrapper
  content?: DoeNotice[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function txt(f: unknown): string {
  if (!f) return '';
  if (typeof f === 'string') return f;
  if (typeof f === 'object') {
    const o = f as Record<string, string>;
    return o['de'] ?? o['DE'] ?? o['DEU'] ?? o['deu'] ?? Object.values(o).find((v) => typeof v === 'string') ?? '';
  }
  return String(f);
}

function num(f: unknown): number | null {
  if (f === null || f === undefined) return null;
  if (typeof f === 'number') return f;
  if (typeof f === 'object') {
    const o = f as Record<string, unknown>;
    const v = o['amount'] ?? o['value'] ?? o['netValue'];
    return v !== undefined ? num(v) : null;
  }
  const p = parseFloat(String(f).replace(/[^0-9.]/g, ''));
  return isNaN(p) ? null : p;
}

const NUTS_BL: Record<string, string> = {
  DE1: 'Baden-Württemberg', DE2: 'Bayern', DE3: 'Berlin',
  DE4: 'Brandenburg', DE5: 'Bremen', DE6: 'Hamburg',
  DE7: 'Hessen', DE8: 'Mecklenburg-Vorpommern', DE9: 'Niedersachsen',
  DEA: 'Nordrhein-Westfalen', DEB: 'Rheinland-Pfalz', DEC: 'Saarland',
  DED: 'Sachsen', DEE: 'Sachsen-Anhalt', DEF: 'Schleswig-Holstein',
  DEG: 'Thüringen',
};

function bundesland(notice: DoeNotice): { region: string; bundesland: string | null } {
  const raw = notice.nutsCode ?? notice.nutsCodes ?? null;
  if (!raw) return { region: 'Deutschland', bundesland: null };
  const codes = Array.isArray(raw) ? raw : [raw];
  const bl = NUTS_BL[String(codes[0]).substring(0, 3).toUpperCase()] ?? null;
  return { region: bl ?? 'Deutschland', bundesland: bl };
}

function cpv(notice: DoeNotice): { codes: string[]; descs: string[] } {
  const raw = notice.cpvCodes ?? (notice.cpvCode ? [notice.cpvCode] : []);
  const codes: string[] = [];
  const descs: string[] = [];
  for (const item of raw) {
    if (typeof item === 'string') { codes.push(item); }
    else if (typeof item === 'object') {
      if (item.code) codes.push(item.code);
      if (item.description) descs.push(txt(item.description));
    }
  }
  return { codes, descs };
}

function toTender(notice: DoeNotice, keywords: string[]): Tender {
  const { region, bundesland: bl } = bundesland(notice);
  const { codes, descs } = cpv(notice);

  const title = txt(notice.title) || 'Ohne Titel';
  const description = txt(notice.description) || '';
  const authority = txt(notice.buyerName) || notice.contractingAuthorityName || 'Öffentlicher Auftraggeber';
  const pubDate = notice.publishDate ?? notice.publicationDate ?? new Date().toISOString();
  const deadline = notice.submissionDeadline ?? notice.deadlineDate ?? null;
  const id = notice.id ?? notice.noticeId ?? notice.publicationId ?? String(Math.random());
  const url = notice.url ?? notice.noticeUrl
    ?? `https://oeffentlichevergabe.de/ui/en/notices/${id}`;

  const fullText = `${title} ${description}`.toLowerCase();
  const matched = keywords.filter((kw) => fullText.includes(kw.toLowerCase()));

  return {
    id: `doe-${id}`,
    title,
    description,
    contracting_authority: authority,
    published_date: new Date(pubDate).toISOString(),
    deadline,
    estimated_value: num(notice.estimatedValue),
    currency: notice.currency ?? 'EUR',
    cpv_codes: codes,
    cpv_descriptions: descs,
    region,
    bundesland: bl,
    source_platform: 'Datenservice Öffentlicher Einkauf',
    source_url: url,
    tender_type: notice.noticeType ?? notice.procedureType ?? 'Ausschreibung',
    keywords_matched: matched,
  };
}

// Try multiple plausible endpoint paths in order
const ENDPOINT_CANDIDATES = [
  `${BASE}/v1/notices`,
  `${BASE}/notices`,
  `${BASE}/v2/notices`,
];

export async function fetchDoeTenders(
  keywords: string[],
  cpvCodes: string[]
): Promise<{ tenders: Tender[]; error?: string }> {
  const dateFrom = new Date();
  dateFrom.setDate(dateFrom.getDate() - 14);
  const dateFromStr = dateFrom.toISOString().split('T')[0];

  // Build query params
  const params = new URLSearchParams({
    size: '50',
    sort: 'publishDate,desc',
    publishedFrom: dateFromStr,
  });

  if (cpvCodes.length > 0) {
    // Try CPV prefix filter – not all endpoints support this but include if available
    params.set('cpvCode', cpvCodes[0].substring(0, 5));
  }

  for (const base of ENDPOINT_CANDIDATES) {
    try {
      const url = `${base}?${params.toString()}`;
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'VergabeDashboard/1.0',
        },
        cache: 'no-store',
      });

      if (!res.ok) continue; // try next candidate

      const data = await res.json();

      // Handle Spring Page wrapper or plain array
      let notices: DoeNotice[] = [];
      if (Array.isArray(data)) {
        notices = data;
      } else if (Array.isArray(data?.content)) {
        notices = data.content;
      } else if (Array.isArray(data?.notices)) {
        notices = data.notices;
      } else if (Array.isArray(data?.items)) {
        notices = data.items;
      }

      const tenders = notices.map((n) => toTender(n, keywords));
      return { tenders };
    } catch {
      // continue to next candidate
    }
  }

  return { tenders: [], error: 'Alle API-Endpunkte nicht erreichbar' };
}
