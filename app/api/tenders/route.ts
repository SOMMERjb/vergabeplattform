import { NextRequest, NextResponse } from 'next/server';
import { fetchTedTenders } from '@/lib/fetchers/ted';
import { fetchRssTenders } from '@/lib/fetchers/rss';
import { fetchDoeTenders } from '@/lib/fetchers/doe';
import { generateDemoTenders } from '@/lib/fetchers/demo-data';
import { getCacheKey, getCached, setCache } from '@/lib/cache';
import { Tender } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const keywords = searchParams.get('keywords')?.split(',').filter(Boolean) || [];
  const cpvCodes = searchParams.get('cpv')?.split(',').filter(Boolean) || [];
  const useDemo = searchParams.get('demo') === 'true';
  const forceRefresh = searchParams.get('refresh') === 'true';

  if (useDemo) {
    const demoTenders = generateDemoTenders();
    return NextResponse.json({
      tenders: demoTenders,
      source: 'demo',
      total: demoTenders.length,
      source_status: [],
    });
  }

  const cacheKey = getCacheKey(keywords, cpvCodes);

  if (!forceRefresh) {
    const cached = getCached(cacheKey);
    if (cached) {
      return NextResponse.json({
        tenders: cached,
        source: 'cache',
        total: cached.length,
        cached_at: new Date().toISOString(),
        source_status: [],
      });
    }
  }

  // Fetch from all sources in parallel
  const [tedResult, rssResult, doeResult] = await Promise.allSettled([
    fetchTedTenders(keywords, cpvCodes),
    fetchRssTenders(keywords, cpvCodes),
    fetchDoeTenders(keywords, cpvCodes),
  ]);

  const allTenders: Tender[] = [];
  const sourceStatus: Array<{ name: string; count: number; error?: string }> = [];

  // TED results
  if (tedResult.status === 'fulfilled') {
    allTenders.push(...tedResult.value.tenders);
    sourceStatus.push({
      name: 'TED (EU)',
      count: tedResult.value.tenders.length,
      error: tedResult.value.error,
    });
  } else {
    sourceStatus.push({ name: 'TED (EU)', count: 0, error: String(tedResult.reason) });
  }

  // RSS results (service.bund.de)
  if (rssResult.status === 'fulfilled') {
    allTenders.push(...rssResult.value.tenders);
    for (const sr of rssResult.value.sourceResults) {
      sourceStatus.push({
        name: sr.source.name,
        count: sr.tenders.length,
        error: sr.error,
      });
    }
  } else {
    sourceStatus.push({ name: 'service.bund.de', count: 0, error: String(rssResult.reason) });
  }

  // Datenservice Öffentlicher Einkauf (oeffentlichevergabe.de)
  if (doeResult.status === 'fulfilled') {
    allTenders.push(...doeResult.value.tenders);
    sourceStatus.push({
      name: 'Öffentlicher Einkauf',
      count: doeResult.value.tenders.length,
      error: doeResult.value.error,
    });
  } else {
    sourceStatus.push({ name: 'Öffentlicher Einkauf', count: 0, error: String(doeResult.reason) });
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allTenders.filter((t) => {
    const key = t.source_url || t.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by publication date desc
  deduped.sort(
    (a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime()
  );

  setCache(cacheKey, deduped);

  return NextResponse.json({
    tenders: deduped,
    source: 'live',
    total: deduped.length,
    fetched_at: new Date().toISOString(),
    source_status: sourceStatus,
  });
}
