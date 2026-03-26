'use client';

import { useState } from 'react';
import { FilterState, BUNDESLAENDER, FRAME_LIGHTING_CPV_CODES } from '@/lib/types';

interface FilterPanelProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
  keywordPool: string[];
}

export default function FilterPanel({ filters, onChange, keywordPool }: FilterPanelProps) {
  const [newKeyword, setNewKeyword] = useState('');
  const [showCpv, setShowCpv] = useState(false);

  function toggleKeyword(kw: string) {
    const kws = filters.keywords.includes(kw)
      ? filters.keywords.filter((k) => k !== kw)
      : [...filters.keywords, kw];
    onChange({ ...filters, keywords: kws });
  }

  function addKeyword(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newKeyword.trim();
    if (trimmed && !filters.keywords.includes(trimmed)) {
      onChange({ ...filters, keywords: [...filters.keywords, trimmed] });
    }
    setNewKeyword('');
  }

  function toggleCpv(code: string) {
    const codes = filters.cpv_codes.includes(code)
      ? filters.cpv_codes.filter((c) => c !== code)
      : [...filters.cpv_codes, code];
    onChange({ ...filters, cpv_codes: codes });
  }

  function toggleBundesland(bl: string) {
    const bls = filters.bundeslaender.includes(bl)
      ? filters.bundeslaender.filter((b) => b !== bl)
      : [...filters.bundeslaender, bl];
    onChange({ ...filters, bundeslaender: bls });
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-5">
      {/* Today toggle */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-900">Filter</span>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-600">Nur heute</span>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={filters.show_today_only}
              onChange={(e) => onChange({ ...filters, show_today_only: e.target.checked })}
            />
            <div className={`w-9 h-5 rounded-full transition-colors ${filters.show_today_only ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${filters.show_today_only ? 'translate-x-4' : ''}`} />
          </div>
        </label>
      </div>

      {/* Keywords */}
      <div>
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Keywords</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {keywordPool.map((kw) => (
            <button
              key={kw}
              onClick={() => toggleKeyword(kw)}
              className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
                filters.keywords.includes(kw)
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {kw}
            </button>
          ))}
        </div>
        <form onSubmit={addKeyword} className="flex gap-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            placeholder="Keyword hinzufügen..."
            className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-2.5 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700"
          >
            +
          </button>
        </form>
      </div>

      {/* Auftragswert */}
      <div>
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Auftragswert (EUR)</div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Minimum</label>
            <input
              type="number"
              placeholder="0"
              value={filters.min_value ?? ''}
              onChange={(e) => onChange({ ...filters, min_value: e.target.value ? Number(e.target.value) : null })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Maximum</label>
            <input
              type="number"
              placeholder="Unbegrenzt"
              value={filters.max_value ?? ''}
              onChange={(e) => onChange({ ...filters, max_value: e.target.value ? Number(e.target.value) : null })}
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Bundesland */}
      <div>
        <div className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2">Bundesland</div>
        <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto">
          {BUNDESLAENDER.map((bl) => (
            <label key={bl} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
              <input
                type="checkbox"
                checked={filters.bundeslaender.includes(bl)}
                onChange={() => toggleBundesland(bl)}
                className="rounded border-gray-300 text-blue-600"
              />
              <span className="text-xs text-gray-700">{bl}</span>
            </label>
          ))}
        </div>
      </div>

      {/* CPV Codes */}
      <div>
        <button
          onClick={() => setShowCpv(!showCpv)}
          className="text-xs font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-1 w-full"
        >
          CPV-Codes
          <span className="ml-auto">
            {showCpv ? '▲' : '▼'}
          </span>
          {filters.cpv_codes.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-blue-600 text-white">
              {filters.cpv_codes.length}
            </span>
          )}
        </button>
        {showCpv && (
          <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {FRAME_LIGHTING_CPV_CODES.map(({ code, description }) => (
              <label key={code} className="flex items-start gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                <input
                  type="checkbox"
                  checked={filters.cpv_codes.includes(code)}
                  onChange={() => toggleCpv(code)}
                  className="mt-0.5 rounded border-gray-300 text-blue-600 flex-shrink-0"
                />
                <span className="text-xs text-gray-700">
                  <span className="font-mono text-gray-500">{code}</span>{' '}
                  {description}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Reset */}
      <button
        onClick={() =>
          onChange({
            keywords: [],
            cpv_codes: [],
            min_value: null,
            max_value: null,
            bundeslaender: [],
            platforms: [],
            date_from: null,
            show_today_only: false,
          })
        }
        className="w-full text-xs text-gray-500 hover:text-gray-700 underline"
      >
        Filter zurücksetzen
      </button>
    </div>
  );
}
