import { Tender } from '../types';

interface RssItem {
  title?: string[];
  description?: string[];
  link?: string[];
  pubDate?: string[];
  'dc:date'?: string[];
  guid?: string[] | Array<{ _: string; $: { isPermaLink: string } }>;
  category?: string[];
  'vergabe:auftraggeber'?: string[];
  'vergabe:wertVon'?: string[];
  'vergabe:wertBis'?: string[];
  'vergabe:cpv'?: string[];
  'vergabe:region'?: string[];
  [key: string]: unknown;
}

interface RssSource {
  name: string;
  url: string;
  region?: string;
  bundesland?: string | null;
}

const RSS_SOURCES: RssSource[] = [
  {
    name: 'DTVP - Deutsches Vergabeportal',
    url: 'https://www.dtvp.de/Center/notice/NoticeSearch/rss?type=1',
    region: 'Deutschland',
    bundesland: null,
  },
  {
    name: 'Vergabe.NRW',
    url: 'https://www.vergabe.nrw.de/VMPSatellite/satellite.rss',
    region: 'Nordrhein-Westfalen',
    bundesland: 'Nordrhein-Westfalen',
  },
  {
    name: 'Bund.de - Öffentliche Aufträge',
    url: 'https://www.bund.de/SiteGlobals/Functions/RSSFeed/RSSNewContracts/RSSNewContracts_Formular.html',
    region: 'Deutschland',
    bundesland: null,
  },
  {
    name: 'Vergabemarktplatz Berlin-Brandenburg',
    url: 'https://www.vergabemarktplatz.de/VMPCenter/satellite.rss',
    region: 'Berlin',
    bundesland: 'Berlin',
  },
  {
    name: 'HAD - Hessische Ausschreibungsdatenbank',
    url: 'https://had.de/rss.xml',
    region: 'Hessen',
    bundesland: 'Hessen',
  },
];

async function parseRss(xmlText: string): Promise<RssItem[]> {
  // Simple XML parser for RSS feeds without external dependencies
  const items: RssItem[] = [];

  // Extract all <item> blocks
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemXml = match[1];
    const item: RssItem = {};

    // Extract common fields
    const fields = [
      'title', 'description', 'link', 'pubDate', 'guid',
      'category', 'dc:date',
      'vergabe:auftraggeber', 'vergabe:wertVon', 'vergabe:wertBis',
      'vergabe:cpv', 'vergabe:region',
    ];

    for (const field of fields) {
      const escapedField = field.replace(':', ':');
      const regex = new RegExp(`<${escapedField}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${escapedField}>|<${escapedField}[^>]*>([\\s\\S]*?)<\\/${escapedField}>`, 'i');
      const fieldMatch = regex.exec(itemXml);
      if (fieldMatch) {
        item[field] = [fieldMatch[1] || fieldMatch[2] || ''];
      }
    }

    if (item.title || item.link) {
      items.push(item);
    }
  }

  return items;
}

function extractGuid(item: RssItem): string {
  const guid = item.guid;
  if (!guid || guid.length === 0) return Math.random().toString(36);
  const g = guid[0];
  if (typeof g === 'string') return g;
  if (typeof g === 'object' && '_' in g) return g._;
  return String(g);
}

function matchesKeywords(text: string, keywords: string[]): string[] {
  return keywords.filter((kw) => text.toLowerCase().includes(kw.toLowerCase()));
}

function matchesCpv(cpvField: string, cpvCodes: string[]): boolean {
  if (!cpvField || cpvCodes.length === 0) return false;
  return cpvCodes.some((code) => cpvField.includes(code.substring(0, 5)));
}

async function fetchRssSource(
  source: RssSource,
  keywords: string[],
  cpvCodes: string[]
): Promise<Tender[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'VergabeDashboard/1.0 (+https://vergabe.local)',
        Accept: 'application/rss+xml, application/xml, text/xml, */*',
      },
      next: { revalidate: 3600 },
    }).finally(() => clearTimeout(timeout));

    if (!response.ok) {
      console.warn(`RSS fetch failed for ${source.name}: ${response.status}`);
      return [];
    }

    const xmlText = await response.text();
    const items = await parseRss(xmlText);

    const tenders: Tender[] = [];

    for (const item of items) {
      const title = item.title?.[0] || '';
      const description = item.description?.[0] || '';
      const link = item.link?.[0] || '';
      const pubDate = item.pubDate?.[0] || item['dc:date']?.[0] || new Date().toISOString();
      const cpvField = item['vergabe:cpv']?.[0] || '';

      const fullText = `${title} ${description}`;
      const matched = matchesKeywords(fullText, keywords);
      const cpvMatch = matchesCpv(cpvField, cpvCodes);

      // Only include if matches keywords or CPV codes
      if (matched.length === 0 && !cpvMatch && keywords.length > 0 && cpvCodes.length > 0) {
        continue;
      }

      const valueStr = item['vergabe:wertVon']?.[0] || '';
      const estimatedValue = valueStr ? parseFloat(valueStr.replace(/[^0-9.]/g, '')) || null : null;

      tenders.push({
        id: `rss-${source.name.replace(/\s/g, '_')}-${extractGuid(item)}`,
        title: title.trim() || 'Ohne Titel',
        description: description.replace(/<[^>]+>/g, '').trim(),
        contracting_authority: item['vergabe:auftraggeber']?.[0] || 'Unbekannte Behörde',
        published_date: new Date(pubDate).toISOString(),
        deadline: null,
        estimated_value: isNaN(estimatedValue ?? NaN) ? null : estimatedValue,
        currency: 'EUR',
        cpv_codes: cpvField ? [cpvField] : [],
        cpv_descriptions: [],
        region: item['vergabe:region']?.[0] || source.region || 'Deutschland',
        bundesland: source.bundesland ?? null,
        source_platform: source.name,
        source_url: link,
        tender_type: 'Ausschreibung',
        keywords_matched: matched,
      });
    }

    return tenders;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.warn(`Timeout fetching RSS from ${source.name}`);
    } else {
      console.error(`Error fetching RSS from ${source.name}:`, error);
    }
    return [];
  }
}

export async function fetchRssTenders(keywords: string[], cpvCodes: string[]): Promise<Tender[]> {
  const results = await Promise.allSettled(
    RSS_SOURCES.map((source) => fetchRssSource(source, keywords, cpvCodes))
  );

  const tenders: Tender[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      tenders.push(...result.value);
    }
  }

  return tenders;
}

export { RSS_SOURCES };
