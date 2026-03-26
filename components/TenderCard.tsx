'use client';

import { Tender } from '@/lib/types';
import { format, parseISO, isToday, isYesterday, differenceInDays } from 'date-fns';
import { de } from 'date-fns/locale';

interface TenderCardProps {
  tender: Tender;
  isSelected: boolean;
  onClick: () => void;
}

function formatDate(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Heute';
    if (isYesterday(date)) return 'Gestern';
    return format(date, 'd. MMM yyyy', { locale: de });
  } catch {
    return dateStr;
  }
}

function formatDeadline(dateStr: string | null): { text: string; urgent: boolean } {
  if (!dateStr) return { text: 'Keine Frist', urgent: false };
  try {
    const date = parseISO(dateStr);
    const days = differenceInDays(date, new Date());
    if (days < 0) return { text: 'Abgelaufen', urgent: true };
    if (days === 0) return { text: 'Heute!', urgent: true };
    if (days <= 7) return { text: `Noch ${days} Tage`, urgent: true };
    if (days <= 14) return { text: `Noch ${days} Tage`, urgent: false };
    return { text: format(date, 'd. MMM yyyy', { locale: de }), urgent: false };
  } catch {
    return { text: dateStr, urgent: false };
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

function platformColor(platform: string): string {
  if (platform.includes('TED')) return 'bg-blue-100 text-blue-800';
  if (platform.includes('DTVP')) return 'bg-purple-100 text-purple-800';
  if (platform.includes('NRW')) return 'bg-orange-100 text-orange-800';
  if (platform.includes('Bayern') || platform.includes('evergabe')) return 'bg-emerald-100 text-emerald-800';
  if (platform.includes('Bund')) return 'bg-gray-100 text-gray-800';
  if (platform.includes('Berlin')) return 'bg-red-100 text-red-800';
  if (platform.includes('HAD') || platform.includes('Hessisch')) return 'bg-yellow-100 text-yellow-800';
  return 'bg-indigo-100 text-indigo-800';
}

export default function TenderCard({ tender, isSelected, onClick }: TenderCardProps) {
  const deadline = formatDeadline(tender.deadline);
  const isNew = isToday(parseISO(tender.published_date));

  return (
    <div
      onClick={onClick}
      className={`
        cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md
        ${isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-gray-300'
        }
      `}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          {isNew && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block"></span>
              Neu heute
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${platformColor(tender.source_platform)}`}>
            {tender.source_platform}
          </span>
          {tender.bundesland && (
            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
              {tender.bundesland}
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500 whitespace-nowrap">
          {formatDate(tender.published_date)}
        </span>
      </div>

      <h3 className="font-semibold text-gray-900 text-sm leading-snug mb-2 line-clamp-2">
        {tender.title}
      </h3>

      <p className="text-xs text-gray-600 mb-3 line-clamp-2">
        {tender.contracting_authority}
      </p>

      {tender.keywords_matched.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {tender.keywords_matched.slice(0, 4).map((kw) => (
            <span key={kw} className="px-1.5 py-0.5 rounded text-xs bg-yellow-50 text-yellow-800 border border-yellow-200">
              {kw}
            </span>
          ))}
          {tender.keywords_matched.length > 4 && (
            <span className="text-xs text-gray-500">+{tender.keywords_matched.length - 4}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-gray-900">
          {formatValue(tender.estimated_value, tender.currency)}
        </div>
        <div className={`text-xs font-medium ${deadline.urgent ? 'text-red-600' : 'text-gray-500'}`}>
          Frist: {deadline.text}
        </div>
      </div>

      {tender.cpv_codes.length > 0 && (
        <div className="mt-2 text-xs text-gray-400">
          CPV: {tender.cpv_codes.slice(0, 2).join(', ')}
          {tender.cpv_codes.length > 2 && ` +${tender.cpv_codes.length - 2}`}
        </div>
      )}
    </div>
  );
}
