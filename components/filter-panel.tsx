'use client';

import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';

interface FilterPanelProps {
  filter: { type: string; location: string; persons: string };
  onFilterChange: (filter: { type: string; location: string; persons: string }) => void;
  typeOptions: { value: string; label: string }[];
  locationOptions: { value: string; label: string }[];
  personOptions: { value: string; label: string }[];
  onShare: () => void;
  shareUrlCopied: boolean;
}

export const FilterPanel = memo(function FilterPanel({ filter, onFilterChange, typeOptions, locationOptions, personOptions, onShare, shareUrlCopied }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  const activeFilterCount = useMemo(() =>
    [filter.type, filter.location, filter.persons].filter(Boolean).length,
    [filter.type, filter.location, filter.persons]
  );

  const toggleOpen = useCallback(() => setIsOpen(prev => !prev), []);

  useEffect(() => {
    if (contentRef.current) {
      setContentHeight(contentRef.current.scrollHeight);
    }
  }, [filter]);

  const filterContent = (
    <>
      <div className="flex justify-between items-center mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Filter Appointments</h2>
        <button
          onClick={onShare}
          className="flex items-center gap-1 px-3 py-2 md:py-1.5 text-xs min-h-[44px] md:min-h-0 bg-gray-100/80 dark:bg-gray-700/80 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 active:bg-gray-300 transition-colors"
          title="Copy link to filtered view"
          aria-label="Share filtered view"
        >
          {shareUrlCopied ? (
            <><svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg><span>Copied!</span></>
          ) : (
            <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg><span>Share</span></>
          )}
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
          <select value={filter.type} onChange={(e) => onFilterChange({ ...filter, type: e.target.value })}
            className="w-full px-3 py-2.5 md:py-1.5 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
          <select value={filter.location} onChange={(e) => onFilterChange({ ...filter, location: e.target.value })}
            className="w-full px-3 py-2.5 md:py-1.5 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {locationOptions.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300 mb-1">Persons</label>
          <select value={filter.persons} onChange={(e) => onFilterChange({ ...filter, persons: e.target.value })}
            className="w-full px-3 py-2.5 md:py-1.5 text-base md:text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          >
            {personOptions.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </div>
      </div>
    </>
  );

  return (
    <div className="glass-card overflow-hidden mb-3" role="region" aria-label="Filters">
      {/* Mobile: collapsible */}
      <button
        onClick={toggleOpen}
        className="w-full flex items-center justify-between p-4 md:hidden"
        aria-expanded={isOpen}
        aria-controls="filter-content-mobile"
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Filters</span>
          {activeFilterCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{activeFilterCount}</span>
          )}
        </div>
        <svg className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Mobile collapsible content */}
      <div id="filter-content-mobile"
        className="md:hidden transition-all duration-300 ease-in-out overflow-hidden"
        style={{ maxHeight: isOpen ? `${contentHeight + 32}px` : '0px', opacity: isOpen ? 1 : 0 }}
      >
        <div ref={contentRef} className="px-4 pb-4">{filterContent}</div>
      </div>

      {/* Desktop: always visible */}
      <div className="hidden md:block p-4">{filterContent}</div>
    </div>
  );
});

FilterPanel.displayName = 'FilterPanel';
