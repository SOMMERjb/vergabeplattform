'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tender, FilterState, DEFAULT_KEYWORDS, FRAME_LIGHTING_CPV_CODES } from '@/lib/types';
import TenderCard from '@/components/TenderCard';
import TenderDetail from '@/components/TenderDetail';
import FilterPanel from '@/components/FilterPanel';
import StatsBar, { SourceStatus } from '@/components/StatsBar';
import { isToday, parseISO } from 'date-fns';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';

const DEFAULT_FILTERS: FilterState = {
  keywords: DEFAULT_KEYWORDS.slice(0, 8),
  cpv_codes: FRAME_LIGHTING_CPV_CODES.slice(0, 6).map((c) => c.code),
  min_value: null,
  max_value: null,
  bundeslaender: [],
  platforms: [],
  date_from: null,
  show_today_only: false,
};

function applyClientFilters(tenders: Tender[], filters: FilterState): Tender[] {
  return tenders.filter((t) => {
    if (filters.show_today_only) {
      try {
        if (!isToday(parseISO(t.published_date))) return false;
      } catch {
        return false;
      }
    }

    if (filters.min_value !== null && t.estimated_value !== null) {
      if (t.estimated_value < filters.min_value) return false;
    }

    if (filters.max_value !== null && t.estimated_value !== null) {
      if (t.estimated_value > filters.max_value) return false;
    }

    if (filters.bundeslaender.length > 0 && t.bundesland) {
      if (!filters.bundeslaender.includes(t.bundesland)) return false;
    }

    if (filters.platforms.length > 0) {
      if (!filters.platforms.includes(t.source_platform)) return false;
    }

    return true;
  });
}

export default function Dashboard() {
  const [allTenders, setAllTenders] = useState<Tender[]>([]);
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [selectedTender, setSelectedTender] = useState<Tender | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastFetched, setLastFetched] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(true);
  const [sourceStatus, setSourceStatus] = useState<SourceStatus[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'value' | 'deadline'>('date');
  const [showFilters, setShowFilters] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenders = useCallback(
    async (demo: boolean, refresh = false) => {
      setIsLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (demo) {
          params.set('demo', 'true');
        } else {
          if (filters.keywords.length > 0) params.set('keywords', filters.keywords.join(','));
          if (filters.cpv_codes.length > 0) params.set('cpv', filters.cpv_codes.join(','));
          if (refresh) params.set('refresh', 'true');
        }

        const res = await fetch(`/api/tenders?${params.toString()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAllTenders(data.tenders || []);
        setLastFetched(data.fetched_at || data.cached_at || new Date().toISOString());
        if (data.source_status) setSourceStatus(data.source_status);
      } catch (err) {
        setError('Fehler beim Laden der Vergaben. Bitte versuche es erneut.');
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    },
    [filters.keywords, filters.cpv_codes]
  );

  useEffect(() => {
    fetchTenders(isDemo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDemo]);

  const filteredTenders = (() => {
    let result = applyClientFilters(allTenders, filters);

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.contracting_authority.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === 'date') {
        return new Date(b.published_date).getTime() - new Date(a.published_date).getTime();
      }
      if (sortBy === 'value') {
        return (b.estimated_value || 0) - (a.estimated_value || 0);
      }
      if (sortBy === 'deadline') {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return 0;
    });

    return result;
  })();

  const today = format(new Date(), "EEEE, d. MMMM yyyy", { locale: de });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Nav */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <div className="font-bold text-gray-900 text-sm leading-none">VergabeDashboard</div>
              <div className="text-xs text-gray-500 leading-none mt-0.5">Rahmen &amp; Beleuchtung</div>
            </div>
          </div>

          <div className="text-xs text-gray-500 hidden sm:block">{today}</div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
                showFilters
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              Filter {showFilters ? 'ausblenden' : 'einblenden'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto px-4 py-4">
        {/* Stats Bar */}
        <div className="mb-4">
          <StatsBar
            tenders={filteredTenders}
            isLoading={isLoading}
            lastFetched={lastFetched}
            onRefresh={() => fetchTenders(isDemo, true)}
            isDemo={isDemo}
            onToggleDemo={() => { setIsDemo(!isDemo); setSourceStatus([]); }}
            sourceStatus={sourceStatus}
          />
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          {/* Filter Panel */}
          {showFilters && (
            <div className="w-64 flex-shrink-0">
              <FilterPanel
                filters={filters}
                onChange={(newFilters) => {
                  setFilters(newFilters);
                  if (!isDemo) {
                    const keywordsChanged =
                      newFilters.keywords.join() !== filters.keywords.join() ||
                      newFilters.cpv_codes.join() !== filters.cpv_codes.join();
                    if (keywordsChanged) {
                      fetchTenders(false, true);
                    }
                  }
                }}
                keywordPool={DEFAULT_KEYWORDS}
              />
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            {/* Search & Sort Bar */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="In Vergaben suchen..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'value' | 'deadline')}
                className="text-xs border border-gray-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="date">Neueste zuerst</option>
                <option value="value">Höchster Wert</option>
                <option value="deadline">Nächste Frist</option>
              </select>
              <span className="text-xs text-gray-500 whitespace-nowrap">
                {filteredTenders.length} Ergebnisse
              </span>
            </div>

            {/* Content area */}
            <div className="flex gap-4">
              {/* Tender List */}
              <div className={`flex-1 min-w-0 ${selectedTender ? 'max-w-md' : ''}`}>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 animate-pulse">
                        <div className="flex gap-2 mb-2">
                          <div className="h-5 w-16 bg-gray-200 rounded-full" />
                          <div className="h-5 w-20 bg-gray-200 rounded-full" />
                        </div>
                        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
                        <div className="h-3 bg-gray-100 rounded w-1/2 mb-3" />
                        <div className="flex justify-between">
                          <div className="h-4 w-24 bg-gray-200 rounded" />
                          <div className="h-4 w-20 bg-gray-200 rounded" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : filteredTenders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1">Keine Vergaben gefunden</h3>
                    <p className="text-xs text-gray-500 max-w-xs">
                      Passe deine Filter an oder klicke auf &quot;Demo-Daten&quot; um Beispieldaten zu sehen.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredTenders.map((tender) => (
                      <TenderCard
                        key={tender.id}
                        tender={tender}
                        isSelected={selectedTender?.id === tender.id}
                        onClick={() =>
                          setSelectedTender(selectedTender?.id === tender.id ? null : tender)
                        }
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Detail Panel */}
              {selectedTender && (
                <div className="w-96 flex-shrink-0 sticky top-20 self-start">
                  <TenderDetail
                    tender={selectedTender}
                    onClose={() => setSelectedTender(null)}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
