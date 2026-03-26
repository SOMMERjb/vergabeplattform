import { Tender } from '../types';

const TED_API_BASE = 'https://api.ted.europa.eu/v3';

interface TedNotice {
  noticeId?: string;
  id?: string;
  title?: Record<string, string> | string;
  description?: Record<string, string> | string;
  buyerName?: Record<string, string> | string;
  publicationDate?: string;
  deadlineDate?: string | null;
  estimatedValue?: { amount?: number; currency?: string } | null;
  cpvCode?: { code?: string; description?: Record<string, string> | string } | null;
  cpvCodes?: Array<{ code?: string; description?: Record<string, string> | string }>;
  placeOfPerformance?: {
    countryCode?: string;
    nutsCodes?: string[];
  } | null;
  noticeUrl?: string;
  documentType?: string;
  contractType?: string;
}

function extractText(
  field: Record<string, string> | string | undefined | null
): string {
  if (!field) return '';
  if (typeof field === 'string') return field;
  return field['DEU'] || field['deu'] || field['de'] || Object.values(field)[0] || '';
}

function nutsToRegion(nutsCodes: string[]): { region: string; bundesland: string | null } {
  if (!nutsCodes || nutsCodes.length === 0) return { region: 'Deutschland', bundesland: null };

  const code = nutsCodes[0];
  const bundeslandMap: Record<string, string> = {
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

  const prefix = code.substring(0, 3);
  const bundesland = bundeslandMap[prefix] || null;
  return { region: bundesland || 'Deutschland', bundesland };
}

export async function fetchTedTenders(keywords: string[], cpvCodes: string[]): Promise<Tender[]> {
  try {
    const tenders: Tender[] = [];

    // Build query for TED API v3
    const queryParts: string[] = [];

    // Add Germany filter
    queryParts.push('ND-RootCountry:(DEU)');

    // Add CPV codes
    if (cpvCodes.length > 0) {
      const cpvQuery = cpvCodes.map(c => `CPV:(${c}*)`).join(' OR ');
      queryParts.push(`(${cpvQuery})`);
    } else if (keywords.length > 0) {
      // Use keywords in title/description
      const kwQuery = keywords.map(k => `TI:(${k})`).join(' OR ');
      queryParts.push(`(${kwQuery})`);
    }

    const query = queryParts.join(' AND ');

    // Get notices from last 7 days
    const dateFrom = new Date();
    dateFrom.setDate(dateFrom.getDate() - 7);
    const dateFromStr = dateFrom.toISOString().split('T')[0];

    const requestBody = {
      query,
      filters: {
        publicationDateRange: {
          startDate: dateFromStr,
        },
      },
      page: 1,
      limit: 50,
      fields: [
        'ND-PublicationDate',
        'ND-NoticeTitle',
        'ND-NoticeType',
        'ND-RootCountry',
        'ND-TenderingInformation',
        'ND-ContractingParty',
        'ND-LotTenderingInformation',
        'ND-LotEstimatedValue',
        'ND-CPVCode',
        'OPT-130-Lot',
        'BT-727-Lot',
        'BT-23-Lot',
      ],
    };

    const response = await fetch(`${TED_API_BASE}/notices/search`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      console.error('TED API error:', response.status, await response.text());
      return [];
    }

    const data = await response.json();
    const notices = data.notices || [];

    for (const notice of notices as TedNotice[]) {
      const nutsCodes = notice.placeOfPerformance?.nutsCodes || [];
      const { region, bundesland } = nutsToRegion(nutsCodes);

      const cpvList = notice.cpvCodes || (notice.cpvCode ? [notice.cpvCode] : []);
      const cpvCodesExtracted = cpvList.map((c) => c.code || '').filter(Boolean);
      const cpvDescs = cpvList.map((c) => extractText(c.description)).filter(Boolean);

      const titleText = extractText(notice.title);
      const descText = extractText(notice.description);

      const keywordsMatched = keywords.filter(
        (kw) =>
          titleText.toLowerCase().includes(kw.toLowerCase()) ||
          descText.toLowerCase().includes(kw.toLowerCase())
      );

      tenders.push({
        id: `ted-${notice.noticeId || notice.id || Math.random()}`,
        title: titleText || 'Ohne Titel',
        description: descText || '',
        contracting_authority: extractText(notice.buyerName) || 'Unbekannte Behörde',
        published_date: notice.publicationDate || new Date().toISOString(),
        deadline: notice.deadlineDate || null,
        estimated_value: notice.estimatedValue?.amount || null,
        currency: notice.estimatedValue?.currency || 'EUR',
        cpv_codes: cpvCodesExtracted,
        cpv_descriptions: cpvDescs,
        region,
        bundesland,
        source_platform: 'TED (EU)',
        source_url: notice.noticeUrl || `https://ted.europa.eu/de/notice/${notice.noticeId}`,
        tender_type: notice.documentType || 'Ausschreibung',
        keywords_matched: keywordsMatched,
      });
    }

    return tenders;
  } catch (error) {
    console.error('Error fetching TED tenders:', error);
    return [];
  }
}
