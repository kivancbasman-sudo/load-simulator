import React, { useState, useRef, useEffect, useMemo } from 'react';
import { ProductCatalogItem } from '../types';
import { Search, ChevronDown, Check, X, Plus, Package, Database } from 'lucide-react';

interface CatalogSearchPickerProps {
  catalog: ProductCatalogItem[];
  selectedId: string;
  onSelect: (item: ProductCatalogItem) => void;
  onQuickAdd?: (item: ProductCatalogItem) => void;
  placeholder?: string;
  className?: string;
  compact?: boolean;
}

// Helper to normalize Turkish characters and lower case for forgiving search
function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .trim();
}

export const CatalogSearchPicker: React.FC<CatalogSearchPickerProps> = ({
  catalog,
  selectedId,
  onSelect,
  onQuickAdd,
  placeholder = 'Katalogda ürün ara (kod, ad veya ölçü)...',
  className = '',
  compact = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedItem = useMemo(() => {
    return catalog.find(item => item.id === selectedId) || null;
  }, [catalog, selectedId]);

  // Filter catalog based on search input
  const filteredItems = useMemo(() => {
    const term = normalizeSearchText(searchTerm);
    if (!term) return catalog;

    return catalog.filter(item => {
      const code = normalizeSearchText(item.materialCode || '');
      const name = normalizeSearchText(item.materialName || '');
      const category = normalizeSearchText(item.category || '');
      const widthMm = String(Math.round(item.width * 10));
      const depthMm = String(Math.round(item.depth * 10));
      const heightMm = String(Math.round(item.height * 10));
      const dims = `${widthMm}x${depthMm}x${heightMm}`;

      return (
        code.includes(term) ||
        name.includes(term) ||
        category.includes(term) ||
        widthMm.includes(term) ||
        depthMm.includes(term) ||
        heightMm.includes(term) ||
        dims.includes(term)
      );
    });
  }, [catalog, searchTerm]);

  // Keep highlighted index within bounds
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchTerm, isOpen]);

  // Scroll active item into view
  useEffect(() => {
    if (isOpen && listRef.current) {
      const el = listRef.current.children[highlightedIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[highlightedIndex]) {
        handleSelectItem(filteredItems[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleSelectItem = (item: ProductCatalogItem) => {
    onSelect(item);
    setIsOpen(false);
  };

  const handleClearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSearchTerm('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Combobox Trigger / Search Field */}
      <div
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={`w-full bg-zinc-900 border rounded-lg transition-all cursor-pointer ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-zinc-900'
            : selectedItem
            ? 'border-blue-500/50 hover:border-blue-400 bg-blue-950/20'
            : 'border-zinc-700 hover:border-zinc-600'
        } ${compact ? 'p-1.5' : 'p-2'}`}
      >
        <div className="flex items-center gap-2">
          <Search
            size={compact ? 13 : 15}
            className={`shrink-0 transition-colors ${
              isOpen || selectedItem ? 'text-blue-400' : 'text-zinc-500'
            }`}
          />

          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              className="w-full bg-transparent text-xs text-white placeholder-zinc-500 outline-none font-medium"
              autoFocus
            />
          ) : selectedItem ? (
            <div className="flex-1 min-w-0 flex items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5 min-w-0 truncate">
                <span className="font-mono text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
                  {selectedItem.materialCode}
                </span>
                <span className="text-xs font-semibold text-white truncate">
                  {selectedItem.materialName}
                </span>
                <span className="text-[10px] text-zinc-400 shrink-0 hidden sm:inline font-mono">
                  ({Math.round(selectedItem.width * 10)}×{Math.round(selectedItem.depth * 10)}×{Math.round(selectedItem.height * 10)} mm)
                </span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-zinc-400 truncate select-none">
              {placeholder}
            </span>
          )}

          <div className="flex items-center gap-1 shrink-0">
            {isOpen && searchTerm && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  setSearchTerm('');
                  inputRef.current?.focus();
                }}
                className="p-0.5 text-zinc-400 hover:text-white rounded"
                title="Aramayı Temizle"
              >
                <X size={13} />
              </button>
            )}
            <ChevronDown
              size={14}
              className={`text-zinc-400 transition-transform duration-200 ${
                isOpen ? 'rotate-180 text-blue-400' : ''
              }`}
            />
          </div>
        </div>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
          {/* Sub-header info bar */}
          <div className="px-3 py-1.5 bg-zinc-950/90 border-b border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400">
            <span className="flex items-center gap-1">
              <Database size={11} className="text-blue-400" />
              <span>
                {filteredItems.length} / {catalog.length} ürün listelendi
              </span>
            </span>
            <span className="text-[9px] text-zinc-500 font-mono">
              ↑↓ Gezin • Enter Seç
            </span>
          </div>

          {/* List of items */}
          <div ref={listRef} className="max-h-64 overflow-y-auto divide-y divide-zinc-800/60 p-1">
            {filteredItems.length === 0 ? (
              <div className="py-6 text-center px-4">
                <Package size={24} className="mx-auto text-zinc-600 mb-2 opacity-50" />
                <p className="text-xs text-zinc-400 font-medium">Eşleşen ürün bulunamadı</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">
                  &quot;{searchTerm}&quot; için arama kriterini değiştirin veya kataloğu kontrol edin.
                </p>
              </div>
            ) : (
              filteredItems.map((item, idx) => {
                const isSelected = item.id === selectedId;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <div
                    key={item.id}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    onClick={() => handleSelectItem(item)}
                    className={`px-2.5 py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between gap-2 group ${
                      isHighlighted
                        ? 'bg-blue-600/20 text-white'
                        : isSelected
                        ? 'bg-zinc-800/80 text-blue-300'
                        : 'hover:bg-zinc-800/50 text-zinc-200'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {/* Top line: Code and Name */}
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-mono text-[10px] font-bold text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20 shrink-0">
                          {item.materialCode}
                        </span>
                        <span className="text-xs font-semibold truncate group-hover:text-blue-200">
                          {item.materialName}
                        </span>
                        {isSelected && (
                          <span className="shrink-0 text-emerald-400">
                            <Check size={13} />
                          </span>
                        )}
                      </div>

                      {/* Bottom line: Dimensions & Specifications */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-zinc-400 font-mono">
                        <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300">
                          {Math.round(item.width * 10)}×{Math.round(item.depth * 10)}×{Math.round(item.height * 10)} mm
                        </span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-emerald-400 font-semibold bg-emerald-500/10 px-1 py-0.5 rounded border border-emerald-500/20">
                          {item.innerQuantity} ad/koli
                        </span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-amber-400 font-semibold">
                          {item.weight} kg
                        </span>
                        {item.category && (
                          <>
                            <span className="text-zinc-500">•</span>
                            <span className="text-zinc-400">{item.category}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Quick Add Button directly from search row */}
                    {onQuickAdd && (
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          onQuickAdd(item);
                        }}
                        className="shrink-0 px-2 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-md text-[10px] font-bold flex items-center gap-1 border border-blue-500/30 transition-all opacity-80 group-hover:opacity-100 shadow-sm"
                        title="Bu ürünü doğrudan palete ekle"
                      >
                        <Plus size={11} /> Ekle
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
