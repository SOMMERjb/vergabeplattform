import { Tender } from '../types';

interface RssItem {
  title?: string;
  description?: string;
  link?: string;
  pubDate?: string;
  guid?: string;
  category?: string;
  // German procurement extensions
  'vergabe:auftraggeber'?: string;
  'vergabe:wertVon'?: string;
  'vergabe:wertBis'?: string;
  'vergabe:cpv'?: string;
  'vergabe:region'?: string;
  [key: string]: string | undefined;
}

export interface RssSource {
  id: string;
  name: string;
  url: string;
  region: string;
  bundesland: string | null;
  active: boolean;
}

export const RSS_SOURCES: RssSource[] = [
  {
    id: 'dtvp',
    name: 'DTVP',
    url: 'https://www.dtvp.de/Center/notice/rss',
    region: 'Deutschland',
    bundesland: null,
    active: true,
  },
  {
    id: 'bund',
    name: 'Bund.de',
    url: 'https://www.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewContracts/RSSNewContracts_Formular.html',
    region: 'Deutschland',
    bundesland: null,
    active: true,
  },
  {
    id: 'vergabe-nrw',
    name: 'Vergabe.NRW',
    url: 'https://www.vergabe.nrw.de/VMPSatellite/satellite.rss',
    region: 'Nordrhein-Westfalen',
    bundesland: 'Nordrhein-Westfalen',
    active: true,
  },
  {
    id: 'had',
    name: 'HAD Hessen',
    url: 'https://had.de/rss.xml',
    region: 'Hessen',
    bundesland: 'Hessen',
    active: true,
  },
  {
    id: 'vmp-berlin',
    name: 'Vergabemarktplatz Berlin',
    url: 'https://www.vergabemarktplatz.de/VMPCenter/satellite.rss',
    region: 'Berlin',
    bundesland: 'Berlin',
    active: true,
  },
  {
    id: 'evergabe-bw',
    name: 'eVergabe BW',
    url: 'https://www.vergabe.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewContracts/RSSNewContracts_Formular.html',
    region: 'Baden-Württemberg',
    bundesland: 'Baden-Württemberg',
    active: true,
  },
];

// ── XML helpers ──────────────────────────────────────────────────────────────

/** Extract text content from a single XML tag (handles CDATA) */
function extractTag(xml: string, tag: string): string | undefined {
  // Try CDATA form first, then plain text
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cdataRe = new RegExp(
    `<${escapedTag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escapedTag}>`,
    'i'
  );
  const plainRe = new RegExp(
    `<${escapedTag}[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`,
    'i'
  );
  const m = cdataRe.exec(xml) ?? plainRe.exec(xml);
  return m ? m[1].trim() : undefined;
}

function parseItem(itemXml: string): RssItem {
  const tags: string[] = [
    'title', 'description', 'link', 'pubDate', 'guid', 'category',
    'vergabe:auftraggeber', 'vergabe:wertVon', 'vergabe:wertBis',
    'vergabe:cpv', 'vergabe:region',
    // Atom / Dublin Core variants
    'dc:date', 'updated', 'summary', 'content',
  ];
  const item: RssItem = {};
  for (const tag of tags) {
    const val = extractTag(itemXml, tag);
    if (val !== undefined) item[tag] = val;
  }
  // Fallback: use <dc:date> or <updated> as pubDate
  if (!item.pubDate) {
    item.pubDate = item['dc:date'] ?? item['updated'];
  }
  return item;
}

function parseRssItems(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const re = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const item = parseItem(m[1]);
    if (item.title || item.link) items.push(item);
  }
  // Also handle Atom <entry> elements
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
  while ((m = entryRe.exec(xml)) !== null) {
    const item = parseItem(m[1]);
    if (item.title || item.link) items.push(item);
  }
  return items;
}

// ── Per-source fetcher ───────────────────────────────────────────────────────

export interface SourceResult {
  source: RssSource;
  tenders: Tender[];
  itemCount: number;
  error?: string;
  httpStatus?: number;
}

async function fetchSource(
  source: RssSource,
  keywords: string[]
): Promise<SourceResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 VergabeDashboard/1.0',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
      cache: 'no-store',
    }).finally(() => clearTimeout(timeout));

    if (!res.ok) {
      return {
        source,
        tenders: [],
        itemCount: 0,
        error: `HTTP ${res.status}`,
        httpStatus: res.status,
      };
    }

    const xml = await res.text();
    const items = parseRssItems(xml);

    const tenders: Tender[] = items.map((item, idx) => {
      const title = item.title?.replace(/\s+/g, ' ').trim() ?? 'Ohne Titel';
      const description = (item.description ?? item.summary ?? item.content ?? '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      const link = item.link ?? '';
      const pubDate = item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString();

      const cpvRaw = item['vergabe:cpv'] ?? '';
      const valueStr = item['vergabe:wertVon'] ?? '';
      const estimatedValue = valueStr
        ? parseFloat(valueStr.replace(/[^0-9.]/g, '')) || null
        : null;

      const fullText = `${title} ${description}`.toLowerCase();
      const matched = keywords.filter((kw) => fullText.includes(kw.toLowerCase()));

      return {
        id: `rss-${source.id}-${item.guid ?? link ?? idx}`,
        title,
        description,
        contracting_authority: item['vergabe:auftraggeber'] ?? extractAuthority(title, description),
        published_date: pubDate,
        deadline: null,
        estimated_value: estimatedValue !== null && !isNaN(estimatedValue) ? estimatedValue : null,
        currency: 'EUR',
        cpv_codes: cpvRaw ? [cpvRaw] : [],
        cpv_descriptions: [],
        region: item['vergabe:region'] ?? source.region,
        bundesland: source.bundesland,
        source_platform: source.name,
        source_url: link,
        tender_type: 'Ausschreibung',
        keywords_matched: matched,
      };
    });

    return { source, tenders, itemCount: items.length };
  } catch (err) {
    clearTimeout(timeout);
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = msg.includes('abort') || msg.includes('timeout');
    return {
      source,
      tenders: [],
      itemCount: 0,
      error: isTimeout ? 'Timeout (12s)' : msg.slice(0, 120),
    };
  }
}

/** Heuristic: extract authority name from title/description if not in custom field */
function extractAuthority(title: string, description: string): string {
  // Common patterns: "Vergabe: XYZ – [Behörde]", "Auftraggeber: XYZ"
  const patterns = [
    /auftraggeber[:\s]+([^,\n]{3,60})/i,
    /vergabestelle[:\s]+([^,\n]{3,60})/i,
    /–\s*([^–\n]{5,60})$/i,
  ];
  const text = `${title} ${description}`;
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) return m[1].trim();
  }
  return 'Öffentlicher Auftraggeber';
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function fetchRssTenders(
  keywords: string[],
  _cpvCodes: string[] // CPV matching is done client-side for RSS; keep param for API compat
): Promise<{ tenders: Tender[]; sourceResults: SourceResult[] }> {
  const activeSources = RSS_SOURCES.filter((s) => s.active);

  const settled = await Promise.allSettled(
    activeSources.map((s) => fetchSource(s, keywords))
  );

  const sourceResults: SourceResult[] = settled.map((r, i) =>
    r.status === 'fulfilled'
      ? r.value
      : { source: activeSources[i], tenders: [], itemCount: 0, error: String(r.reason) }
  );

  const tenders = sourceResults.flatMap((r) => r.tenders);
  return { tenders, sourceResults };
}
