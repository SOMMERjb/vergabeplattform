import { NextRequest, NextResponse } from 'next/server';
import { fetchTedTenders } from '@/lib/fetchers/ted';
import { fetchRssTenders } from '@/lib/fetchers/rss';
import { generateDemoTenders } from '@/lib/fetchers/demo-data';
import { getCacheKey, getCached, setCache } from '@/lib/cache';
import { Tender } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const keywords = searchParams.get('keywords')?.split(',').filter(Boolean) || [];
  const cpvCodes = searchParams.get('cpv')?.split(',').filter(Boolean) || [];
  const useDemo = searchParams.get('demo') === 'true';
  const forceRefresh = searchParams.get('refresh') === 'true';

  if (useDemo) {
    const demoTenders = generateDemoTenders();
    return NextResponse.json({ tenders: demoTenders, source: 'demo', total: demoTenders.length });
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
      });
    }
  }

  // Fetch from all sources in parallel
  const [tedTenders, rssTenders] = await Promise.allSettled([
    fetchTedTenders(keywords, cpvCodes),
    fetchRssTenders(keywords, cpvCodes),
  ]);

  const allTenders: Tender[] = [];

  if (tedTenders.status === 'fulfilled') allTenders.push(...tedTenders.value);
  if (rssTenders.status === 'fulfilled') allTenders.push(...rssTenders.value);

  // Deduplicate by URL
  const seen = new Set<string>();
  const deduped = allTenders.filter((t) => {
    const key = t.source_url || t.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Sort by publication date desc
  deduped.sort((a, b) => new Date(b.published_date).getTime() - new Date(a.published_date).getTime());

  setCache(cacheKey, deduped);

  return NextResponse.json({
    tenders: deduped,
    source: 'live',
    total: deduped.length,
    fetched_at: new Date().toISOString(),
    sources: {
      ted: tedTenders.status === 'fulfilled' ? tedTenders.value.length : 0,
      rss: rssTenders.status === 'fulfilled' ? rssTenders.value.length : 0,
    },
  });
}
