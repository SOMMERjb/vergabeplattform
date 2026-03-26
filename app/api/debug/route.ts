import { NextResponse } from 'next/server';
import { fetchTedTenders } from '@/lib/fetchers/ted';
import { fetchRssTenders, RSS_SOURCES } from '@/lib/fetchers/rss';
import { fetchDoeTenders } from '@/lib/fetchers/doe';
import { DEFAULT_KEYWORDS, FRAME_LIGHTING_CPV_CODES } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const keywords = DEFAULT_KEYWORDS.slice(0, 8);
  const cpvCodes = FRAME_LIGHTING_CPV_CODES.slice(0, 6).map((c) => c.code);

  const startTime = Date.now();

  const [tedResult, rssResult, doeResult] = await Promise.allSettled([
    fetchTedTenders(keywords, cpvCodes),
    fetchRssTenders(keywords, cpvCodes),
    fetchDoeTenders(keywords, cpvCodes),
  ]);

  const ted =
    tedResult.status === 'fulfilled'
      ? {
          ok: !tedResult.value.error,
          count: tedResult.value.tenders.length,
          error: tedResult.value.error ?? null,
          sample: tedResult.value.tenders.slice(0, 2).map((t) => ({
            title: t.title,
            platform: t.source_platform,
            date: t.published_date,
            cpv: t.cpv_codes,
          })),
        }
      : { ok: false, count: 0, error: String(tedResult.reason), sample: [] };

  const rss =
    rssResult.status === 'fulfilled'
      ? rssResult.value.sourceResults.map((r) => ({
          source: r.source.name,
          url: r.source.url,
          ok: !r.error,
          itemCount: r.itemCount,
          tendersReturned: r.tenders.length,
          error: r.error ?? null,
          sample: r.tenders.slice(0, 1).map((t) => ({ title: t.title, date: t.published_date })),
        }))
      : RSS_SOURCES.map((s) => ({
          source: s.name,
          url: s.url,
          ok: false,
          itemCount: 0,
          tendersReturned: 0,
          error: String(rssResult.reason),
          sample: [],
        }));

  const doe =
    doeResult.status === 'fulfilled'
      ? {
          ok: !doeResult.value.error,
          count: doeResult.value.tenders.length,
          error: doeResult.value.error ?? null,
          sample: doeResult.value.tenders.slice(0, 2).map((t) => ({
            title: t.title,
            date: t.published_date,
          })),
        }
      : { ok: false, count: 0, error: String(doeResult.reason), sample: [] };

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    ted,
    rss,
    doe,
    config: { keywords, cpvCodes },
  });
}
