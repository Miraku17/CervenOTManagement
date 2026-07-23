"use client"
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, X } from 'lucide-react';

export interface MultiSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface MultiSelectFilterProps {
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  searchable?: boolean;
}

// Excel-style multi-select checkbox dropdown used in the tickets filter panel.
export default function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
  searchable = false,
}: MultiSelectFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleValue = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const filteredOptions = search
    ? options.filter((opt) =>
        `${opt.label} ${opt.sublabel || ''}`.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-950 border rounded-lg text-sm transition-colors ${
          selected.length > 0
            ? 'border-blue-500/60 text-white'
            : 'border-slate-700 text-slate-300 hover:text-white'
        }`}
      >
        <span className="truncate">
          {label}
          {selected.length > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-blue-600 text-white text-xs rounded-full">
              {selected.length}
            </span>
          )}
        </span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 sm:right-auto sm:min-w-[240px] mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          {searchable && (
            <div className="p-2 border-b border-slate-800">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}...`}
                className="w-full bg-slate-950 border border-slate-700 text-white px-3 py-1.5 rounded-lg text-sm focus:ring-1 focus:ring-blue-500 outline-none"
              />
            </div>
          )}
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full flex items-center gap-2 px-4 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border-b border-slate-800"
            >
              <X size={12} />
              Clear selection
            </button>
          )}
          <div className="max-h-64 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-500">No options found</p>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = selected.includes(option.value);
                return (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => toggleValue(option.value)}
                    className={`w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors flex items-center gap-3 border-b border-slate-800 last:border-0 ${
                      isSelected ? 'bg-slate-800/60' : ''
                    }`}
                  >
                    <span
                      className={`w-4 h-4 flex-shrink-0 rounded border flex items-center justify-center ${
                        isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-600'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm text-slate-200 truncate">{option.label}</span>
                      {option.sublabel && (
                        <span className="block text-xs text-slate-500 truncate">{option.sublabel}</span>
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
