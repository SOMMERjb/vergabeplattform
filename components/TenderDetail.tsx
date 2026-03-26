'use client';

import { Tender } from '@/lib/types';
import { format, parseISO, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

interface TenderDetailProps {
  tender: Tender;
  onClose: () => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr), 'd. MMMM yyyy', { locale: de });
  } catch {
    return dateStr;
  }
}

function formatValue(value: number | null, currency: string): string {
  if (!value) return 'Nicht angegeben';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 0,
  }).format(value);
}

function getDaysLeft(deadline: string | null): number | null {
  if (!deadline) return null;
  try {
    return differenceInDays(parseISO(deadline), new Date());
  } catch {
    return null;
  }
}

export default function TenderDetail({ tender, onClose }: TenderDetailProps) {
  const daysLeft = getDaysLeft(tender.deadline);

  return (
    <div className="bg-white rounded-xl border border-gray-200 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {tender.source_platform}
            </span>
            {tender.bundesland && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                {tender.bundesland}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {tender.tender_type}
            </span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <h2 className="text-base font-bold text-gray-900 leading-snug">
          {tender.title}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {/* Key Facts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Auftraggeber</div>
            <div className="text-sm font-medium text-gray-900">{tender.contracting_authority}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Region</div>
            <div className="text-sm font-medium text-gray-900">{tender.region}</div>
          </div>
          <div className={`rounded-lg p-3 ${tender.estimated_value ? 'bg-blue-50' : 'bg-gray-50'}`}>
            <div className="text-xs text-gray-500 mb-1">Auftragswert (geschätzt)</div>
            <div className={`text-sm font-bold ${tender.estimated_value ? 'text-blue-800' : 'text-gray-500'}`}>
              {formatValue(tender.estimated_value, tender.currency)}
            </div>
          </div>
          <div className={`rounded-lg p-3 ${daysLeft !== null && daysLeft <= 7 ? 'bg-red-50' : 'bg-gray-50'}`}>
            <div className="text-xs text-gray-500 mb-1">Einreichungsfrist</div>
            <div className={`text-sm font-medium ${daysLeft !== null && daysLeft <= 7 ? 'text-red-700 font-bold' : 'text-gray-900'}`}>
              {formatDate(tender.deadline)}
              {daysLeft !== null && (
                <span className="block text-xs mt-0.5">
                  {daysLeft < 0 ? 'Abgelaufen' : daysLeft === 0 ? 'Heute!' : `Noch ${daysLeft} Tage`}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Dates */}
        <div className="text-xs text-gray-500">
          Veröffentlicht am {formatDate(tender.published_date)}
        </div>

        {/* Description */}
        {tender.description && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Beschreibung</h3>
            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
              {tender.description}
            </p>
          </div>
        )}

        {/* Keywords matched */}
        {tender.keywords_matched.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Erkannte Keywords</h3>
            <div className="flex flex-wrap gap-1.5">
              {tender.keywords_matched.map((kw) => (
                <span key={kw} className="px-2 py-1 rounded-md text-xs bg-yellow-50 text-yellow-800 border border-yellow-200 font-medium">
                  {kw}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* CPV Codes */}
        {tender.cpv_codes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">CPV-Codes</h3>
            <div className="space-y-1">
              {tender.cpv_codes.map((code, i) => (
                <div key={code} className="flex items-center gap-2 text-sm">
                  <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-700">
                    {code}
                  </span>
                  {tender.cpv_descriptions[i] && (
                    <span className="text-gray-600 text-xs">{tender.cpv_descriptions[i]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="p-5 border-t border-gray-100 bg-gray-50 space-y-2">
        <a
          href={tender.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          Zur Ausschreibung &rarr;
        </a>
        <div className="text-xs text-center text-gray-400">
          Quelle: {tender.source_platform}
        </div>
      </div>
    </div>
  );
}
