'use client';

import { Tender } from '@/lib/types';
import { isToday, parseISO } from 'date-fns';

interface StatsBarProps {
  tenders: Tender[];
  isLoading: boolean;
  lastFetched: string | null;
  onRefresh: () => void;
  isDemo: boolean;
  onToggleDemo: () => void;
}

export default function StatsBar({
  tenders,
  isLoading,
  lastFetched,
  onRefresh,
  isDemo,
  onToggleDemo,
}: StatsBarProps) {
  const todayCount = tenders.filter((t) => {
    try {
      return isToday(parseISO(t.published_date));
    } catch {
      return false;
    }
  }).length;

  const totalValue = tenders.reduce((sum, t) => sum + (t.estimated_value || 0), 0);

  const avgValue = tenders.length > 0 ? totalValue / tenders.length : 0;

  function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}T €`;
    return `${n.toFixed(0)} €`;
  }

  const platforms = [...new Set(tenders.map((t) => t.source_platform))];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-6 flex-wrap">
          <div>
            <div className="text-2xl font-bold text-gray-900">{tenders.length}</div>
            <div className="text-xs text-gray-500">Vergaben gefunden</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{todayCount}</div>
            <div className="text-xs text-gray-500">Neu heute</div>
          </div>
          {totalValue > 0 && (
            <div>
              <div className="text-2xl font-bold text-blue-600">{formatCompact(totalValue)}</div>
              <div className="text-xs text-gray-500">Gesamtvolumen</div>
            </div>
          )}
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">Quellen aktiv</div>
            <div className="flex flex-wrap gap-1">
              {platforms.slice(0, 4).map((p) => (
                <span key={p} className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                  {p.split(' ')[0]}
                </span>
              ))}
              {platforms.length > 4 && (
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                  +{platforms.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {isDemo && (
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
              Demo-Daten
            </span>
          )}

          <button
            onClick={onToggleDemo}
            className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${
              isDemo
                ? 'border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100'
                : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100'
            }`}
          >
            {isDemo ? 'Live-Daten laden' : 'Demo-Daten'}
          </button>

          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <svg
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isLoading ? 'Lädt...' : 'Aktualisieren'}
          </button>
        </div>
      </div>

      {lastFetched && (
        <div className="mt-2 text-xs text-gray-400">
          Zuletzt aktualisiert: {new Date(lastFetched).toLocaleString('de-DE')}
        </div>
      )}
    </div>
  );
}
