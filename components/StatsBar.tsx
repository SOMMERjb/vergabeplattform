'use client';

import { Tender } from '@/lib/types';
import { isToday, parseISO } from 'date-fns';

export interface SourceStatus {
  name: string;
  count: number;
  error?: string;
}

interface StatsBarProps {
  tenders: Tender[];
  isLoading: boolean;
  lastFetched: string | null;
  onRefresh: () => void;
  isDemo: boolean;
  onToggleDemo: () => void;
  sourceStatus?: SourceStatus[];
}

export default function StatsBar({
  tenders,
  isLoading,
  lastFetched,
  onRefresh,
  isDemo,
  onToggleDemo,
  sourceStatus = [],
}: StatsBarProps) {
  const todayCount = tenders.filter((t) => {
    try {
      return isToday(parseISO(t.published_date));
    } catch {
      return false;
    }
  }).length;

  const totalValue = tenders.reduce((sum, t) => sum + (t.estimated_value || 0), 0);

  function formatCompact(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M €`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}T €`;
    return `${n.toFixed(0)} €`;
  }

  const workingSources = sourceStatus.filter((s) => !s.error || s.count > 0);
  const failedSources = sourceStatus.filter((s) => s.error && s.count === 0);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
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

      {/* Source status (only shown in live mode) */}
      {!isDemo && sourceStatus.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-gray-100">
          {sourceStatus.map((s) => {
            const ok = !s.error || s.count > 0;
            return (
              <span
                key={s.name}
                title={s.error ? `Fehler: ${s.error}` : `${s.count} Vergaben`}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  ok
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-700 border border-red-200'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${ok ? 'bg-green-500' : 'bg-red-400'}`} />
                {s.name}
                {s.count > 0 && <span className="opacity-70">({s.count})</span>}
                {!ok && <span className="opacity-70">✕</span>}
              </span>
            );
          })}
          {failedSources.length > 0 && (
            <a
              href="/api/debug"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-400 hover:text-gray-600 underline ml-1 self-center"
            >
              Debug-Info
            </a>
          )}
        </div>
      )}

      {lastFetched && (
        <div className="text-xs text-gray-400">
          Zuletzt aktualisiert: {new Date(lastFetched).toLocaleString('de-DE')}
        </div>
      )}

      {/* Working sources summary when no errors */}
      {!isDemo && workingSources.length > 0 && failedSources.length === 0 && (
        <div className="text-xs text-gray-400">
          Alle {workingSources.length} Quellen erreichbar
        </div>
      )}
    </div>
  );
}
