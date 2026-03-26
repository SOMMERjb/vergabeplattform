import { Tender } from '../types';

const TED_API_BASE = 'https://api.ted.europa.eu/v3';

// TED API v3 response shape – fields vary based on request, so everything is optional
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TedField = any;

interface TedNoticeRaw {
  noticeId?: string;
  id?: string;
  publicationDate?: string;
  deadlineDate?: string | null;
  links?: { tedUrl?: string; noticeUrl?: string };
  // top-level flattened fields (returned when no explicit fields list is sent)
  title?: TedField;
  description?: TedField;
  summary?: TedField;
  shortDescription?: TedField;
  buyerName?: TedField;
  contractingAuthorityName?: TedField;
  cpvCode?: TedField;
  cpvCodes?: TedField;
  estimatedValue?: TedField;
  totalEstimatedValue?: TedField;
  nutsCodes?: TedField;
  nutsCode?: TedField;
  placeOfPerformance?: TedField;
  noticeType?: string;
  type?: string;
  documentType?: string;
  // eForms BT-code fields (returned when fields are specified)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

function pickText(field: TedField): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object') {
    // Multilingual object: {"DEU": "...", "ENG": "..."}
    return (
      field['DEU'] ||
      field['deu'] ||
      field['de'] ||
      field['DE'] ||
      field['ENG'] ||
      field['eng'] ||
      field['en'] ||
      (Array.isArray(field) ? field[0] : null) ||
      Object.values(field).find((v) => typeof v === 'string') ||
      ''
    );
  }
  return String(field);
}

function pickNumber(field: TedField): number | null {
  if (!field) return null;
  if (typeof field === 'number') return field;
  if (typeof field === 'object') {
    return (
      field.amount ??
      field.value ??
      field.estimatedTotalValue ??
      field.netValue ??
      null
    );
  }
  const parsed = parseFloat(String(field).replace(/[^0-9.]/g, ''));
  return isNaN(parsed) ? null : parsed;
}

function pickCpvCodes(notice: TedNoticeRaw): { codes: string[]; descs: string[] } {
  const raw = notice.cpvCodes ?? notice.cpvCode ?? notice['CPV'] ?? null;
  if (!raw) return { codes: [], descs: [] };

  const items = Array.isArray(raw) ? raw : [raw];
  const codes: string[] = [];
  const descs: string[] = [];

  for (const item of items) {
    if (typeof item === 'string') {
      codes.push(item);
    } else if (typeof item === 'object') {
      const code = item.code ?? item.cpvCode ?? '';
      const desc = pickText(item.description ?? item.name ?? item.label ?? '');
      if (code) codes.push(String(code));
      if (desc) descs.push(desc);
    }
  }
  return { codes, descs };
}

const NUTS_TO_BUNDESLAND: Record<string, string> = {
  DE1: 'Baden-Württemberg',
  DE2: 'Bayern',
  DE3: 'Berlin',
  DE4: 'Brandenburg',
  DE5: 'Bremen',
  DE6: 'Hamburg',
  DE7: 'Hessen',
  DE8: 'Mecklenburg-Vorpommern',
  DE9: 'Niedersachsen',
  DEA: 'Nordrhein-Westfalen',
  DEB: 'Rheinland-Pfalz',
  DEC: 'Saarland',
  DED: 'Sachsen',
  DEE: 'Sachsen-Anhalt',
  DEF: 'Schleswig-Holstein',
  DEG: 'Thüringen',
};

function resolveBundesland(notice: TedNoticeRaw): { region: string; bundesland: string | null } {
  const raw =
    notice.nutsCodes ??
    notice.nutsCode ??
    notice.placeOfPerformance?.nutsCodes ??
    notice.placeOfPerformance?.nutsCode ??
    null;

  if (!raw) return { region: 'Deutschland', bundesland: null };

  const codes: string[] = Array.isArray(raw) ? raw : [raw];
  if (codes.length === 0) return { region: 'Deutschland', bundesland: null };

  const prefix = String(codes[0]).substring(0, 3).toUpperCase();
  const bl = NUTS_TO_BUNDESLAND[prefix] ?? null;
  return { region: bl ?? 'Deutschland', bundesland: bl };
}

function noticeUrl(notice: TedNoticeRaw): string {
  const id = notice.noticeId ?? notice.id ?? '';
  return (
    notice.links?.tedUrl ??
    notice.links?.noticeUrl ??
    (id ? `https://ted.europa.eu/de/notice/${id}` : 'https://ted.europa.eu')
  );
}

export async function fetchTedTenders(
  keywords: string[],
  cpvCodes: string[]
): Promise<{ tenders: Tender[]; error?: string }> {
  try {
    // Build a simple, broadly-compatible TED v3 query
    // Filter: Germany, last 14 days, optional CPV prefix filter
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 14);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    // Build CPV query part
    let cpvQueryPart = '';
    if (cpvCodes.length > 0) {
      // Use 5-digit prefix match for each CPV code
      const cpvParts = [...new Set(cpvCodes.map((c) => c.substring(0, 5)))]
        .map((prefix) => `CPV=${prefix}*`)
        .join(' OR ');
      cpvQueryPart = ` AND (${cpvParts})`;
    } else if (keywords.length > 0) {
      const kwParts = keywords.slice(0, 5).map((k) => `TE=${encodeURIComponent(k)}`).join(' OR ');
      cpvQueryPart = ` AND (${kwParts})`;
    }

    const query = `ND-CountryCode=DEU AND PD>=${dateFromStr}${cpvQueryPart}`;

    const body = {
      query,
      scope: 3, // 3 = all active notices
      onlyLatestVersions: true,
      page: 1,
      limit: 50,
    };

    const res = await fetch(`${TED_API_BASE}/notices/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      // No Next.js cache – always fresh on demand
      cache: 'no-store',
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error(`TED API error ${res.status}:`, errText.slice(0, 300));
      return { tenders: [], error: `TED HTTP ${res.status}: ${errText.slice(0, 100)}` };
    }

    const data = await res.json();
    const notices: TedNoticeRaw[] = data.notices ?? data.results ?? data.items ?? [];

    if (!Array.isArray(notices)) {
      console.warn('TED API returned unexpected shape:', JSON.stringify(data).slice(0, 200));
      return { tenders: [], error: 'Unerwartetes Antwortformat von TED' };
    }

    const tenders: Tender[] = notices.map((notice) => {
      const { region, bundesland } = resolveBundesland(notice);
      const { codes, descs } = pickCpvCodes(notice);

      const title =
        pickText(notice.title) ||
        pickText(notice.summary) ||
        pickText(notice.shortDescription) ||
        'Ohne Titel';

      const description =
        pickText(notice.description) ||
        pickText(notice.summary) ||
        pickText(notice.shortDescription) ||
        '';

      const authorityName =
        pickText(notice.buyerName) ||
        pickText(notice.contractingAuthorityName) ||
        'Unbekannte Behörde';

      const value = pickNumber(notice.estimatedValue ?? notice.totalEstimatedValue ?? null);

      const fullText = `${title} ${description}`.toLowerCase();
      const keywordsMatched = keywords.filter((kw) =>
        fullText.includes(kw.toLowerCase())
      );

      return {
        id: `ted-${notice.noticeId ?? notice.id ?? Math.random()}`,
        title,
        description,
        contracting_authority: authorityName,
        published_date: notice.publicationDate
          ? new Date(notice.publicationDate).toISOString()
          : new Date().toISOString(),
        deadline: notice.deadlineDate ?? null,
        estimated_value: value,
        currency: 'EUR',
        cpv_codes: codes,
        cpv_descriptions: descs,
        region,
        bundesland,
        source_platform: 'TED (EU)',
        source_url: noticeUrl(notice),
        tender_type: notice.noticeType ?? notice.type ?? notice.documentType ?? 'Ausschreibung',
        keywords_matched: keywordsMatched,
      };
    });

    return { tenders };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('fetchTedTenders failed:', msg);
    return { tenders: [], error: msg };
  }
}
