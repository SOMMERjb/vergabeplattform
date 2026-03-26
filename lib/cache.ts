import { Tender } from './types';

interface CacheEntry {
  tenders: Tender[];
  timestamp: number;
  filterKey: string;
}

// In-memory cache with 1 hour TTL
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function getCacheKey(keywords: string[], cpvCodes: string[]): string {
  return `${keywords.sort().join(',')}_${cpvCodes.sort().join(',')}`;
}

export function getCached(key: string): Tender[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.tenders;
}

export function setCache(key: string, tenders: Tender[]): void {
  cache.set(key, {
    tenders,
    timestamp: Date.now(),
    filterKey: key,
  });
}
