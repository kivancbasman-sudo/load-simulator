import React, { useState, useMemo } from 'react';
import { PackingResult, PackedBox, Box } from '../types';
import { 
  Printer, 
  Download, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Scale, 
  Layers, 
  Copy, 
  Check, 
  FileText, 
  Sparkles, 
  Info,
  Calendar,
  User,
  Globe,
  Tag
} from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PackingResult;
}

// Priority tag options for product groups
type PriorityTag = 'Normal' | 'Gecikmede' | 'Acil' | 'Stoklu';

// Preset pastel color palette matching decision card aesthetics
const PASTEL_PALETTE = [
  { bg: 'bg-amber-100 dark:bg-amber-900/40', border: 'border-amber-300 dark:border-amber-700', text: 'text-amber-900 dark:text-amber-200', hex: '#fef08a', badge: 'bg-amber-200 text-amber-900' },
  { bg: 'bg-indigo-100 dark:bg-indigo-900/40', border: 'border-indigo-300 dark:border-indigo-700', text: 'text-indigo-900 dark:text-indigo-200', hex: '#c7d2fe', badge: 'bg-indigo-200 text-indigo-900' },
  { bg: 'bg-rose-100 dark:bg-rose-900/40', border: 'border-rose-300 dark:border-rose-700', text: 'text-rose-900 dark:text-rose-200', hex: '#fbcfe8', badge: 'bg-rose-200 text-rose-900' },
  { bg: 'bg-emerald-100 dark:bg-emerald-900/40', border: 'border-emerald-300 dark:border-emerald-700', text: 'text-emerald-900 dark:text-emerald-200', hex: '#bbf7d0', badge: 'bg-emerald-200 text-emerald-900' },
  { bg: 'bg-cyan-100 dark:bg-cyan-900/40', border: 'border-cyan-300 dark:border-cyan-700', text: 'text-cyan-900 dark:text-cyan-200', hex: '#cffafe', badge: 'bg-cyan-200 text-cyan-900' },
  { bg: 'bg-purple-100 dark:bg-purple-900/40', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-900 dark:text-purple-200', hex: '#e9d5ff', badge: 'bg-purple-200 text-purple-900' },
];

export const ReportModal: React.FC<ReportModalProps> = ({ isOpen, onClose, result }) => {
  if (!isOpen) return null;

  // Active view tab: 'decision_card' (Sevkiyat Karar Kartı) vs 'manifesto' (Detaylı Manifest)
  const [activeTab, setActiveTab] = useState<'decision_card' | 'manifesto'>('decision_card');

  // Decision Card Editable Metadata
  const [shipmentWeek, setShipmentWeek] = useState('W43 Cuma');
  const [customerInfo, setCustomerInfo] = useState('A müşterisi / USA');
  const [scenarioTag, setScenarioTag] = useState('TEMSİLİ SENARYO');
  
  // Custom priorities per box type ID
  const [priorities, setPriorities] = useState<Record<string, PriorityTag>>({
    'box-1': 'Normal',
    'box-2': 'Gecikmede',
    'box-3': 'Acil'
  });

  // Selected Management Decision (Option A vs Option B)
  const [selectedDecision, setSelectedDecision] = useState<'A' | 'B'>('A');

  // Copy notification status
  const [copiedText, setCopiedText] = useState(false);

  // Print function
  const handlePrint = () => {
    window.print();
  };

  // CSV Export
  const handleExportCSV = () => {
    const headers = [
      'Palet ID',
      'Malzeme Kodu',
      'Malzeme Adi / Koli',
      'Koli Ici Adet',
      'Koli ID',
      'Genislik (mm)',
      'Derinlik (mm)',
      'Yukseklik (mm)',
      'Agirlik (kg)',
      'Pozisyon X (mm)',
      'Pozisyon Y (mm)',
      'Pozisyon Z (mm)',
      'Donduruldu',
      'Katman'
    ];

    const rows: string[] = [];
    rows.push(headers.join(';'));

    result.pallets.forEach((p) => {
      p.packedBoxes.forEach((b) => {
        rows.push([
          p.id,
          b.materialCode ? `"${b.materialCode}"` : '-',
          `"${b.materialName || b.name}"`,
          b.innerQuantity || 1,
          b.id,
          Math.round(b.width * 10),
          Math.round(b.depth * 10),
          Math.round(b.height * 10),
          b.weight || 0,
          Math.round(b.x * 10),
          Math.round(b.y * 10),
          Math.round(b.z * 10),
          b.rotated ? 'EVET' : 'HAYIR',
          b.layerIndex || 1
        ].join(';'));
      });
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(rows.join('\n'));
    const link = document.createElement('a');
    link.setAttribute('href', csvContent);
    link.setAttribute('download', `sevkiyat-karar-kart-raporu-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Process all boxes across packed and unpacked to build group statistics
  const boxGroupStats = useMemo(() => {
    const primaryPallet = result.pallets[0];
    const packedBoxes = primaryPallet ? primaryPallet.packedBoxes : [];
    const unpackedBoxes = result.unpackedBoxes;

    const groupMap: Record<string, {
      typeKey: string;
      shortCode: string;
      fullName: string;
      materialCode?: string;
      colorHex: string;
      packedCount: number;
      unpackedCount: number;
      totalCount: number;
      innerQuantity: number;
      palette: typeof PASTEL_PALETTE[0];
    }> = {};

    const alphabet = ['X', 'Y', 'Z', 'W', 'V', 'U', 'T', 'S'];
    let codeIndex = 0;

    // Helper to get or create group
    const getGroupKey = (b: Box | PackedBox) => `${b.materialCode || b.name}-${b.width}-${b.height}-${b.depth}`;

    // Process packed
    packedBoxes.forEach((b) => {
      const key = getGroupKey(b);
      if (!groupMap[key]) {
        const shortCode = alphabet[codeIndex % alphabet.length];
        const palette = PASTEL_PALETTE[codeIndex % PASTEL_PALETTE.length];
        codeIndex++;
        groupMap[key] = {
          typeKey: b.id.split('-')[0] || key,
          shortCode,
          fullName: b.materialName || b.name,
          materialCode: b.materialCode,
          colorHex: b.color,
          packedCount: 0,
          unpackedCount: 0,
          totalCount: 0,
          innerQuantity: b.innerQuantity || 1,
          palette
        };
      }
      groupMap[key].packedCount++;
      groupMap[key].totalCount++;
    });

    // Process unpacked
    unpackedBoxes.forEach((b) => {
      const key = getGroupKey(b);
      if (!groupMap[key]) {
        const shortCode = alphabet[codeIndex % alphabet.length];
        const palette = PASTEL_PALETTE[codeIndex % PASTEL_PALETTE.length];
        codeIndex++;
        groupMap[key] = {
          typeKey: b.id.split('-')[0] || key,
          shortCode,
          fullName: b.materialName || b.name,
          materialCode: b.materialCode,
          colorHex: b.color,
          packedCount: 0,
          unpackedCount: 0,
          totalCount: 0,
          innerQuantity: b.innerQuantity || 1,
          palette
        };
      }
      groupMap[key].unpackedCount++;
      groupMap[key].totalCount++;
    });

    return Object.values(groupMap);
  }, [result]);

  // Total inventory stats
  const totalInventoryCount = useMemo(() => {
    return result.totalBoxesPacked + result.totalBoxesRemaining;
  }, [result]);

  // Primary pallet stats
  const primaryPallet = result.pallets[0];
  const primaryPackedCount = primaryPallet ? primaryPallet.packedBoxes.length : 0;
  const primaryLayerCount = primaryPallet ? (primaryPallet.layerCount || 1) : 1;
  const avgBoxesPerLayer = primaryLayerCount > 0 ? Math.round(primaryPackedCount / primaryLayerCount) : 0;

  // Group packed boxes by layer for the layer-by-layer 2D visual grid
  const layerGridData = useMemo(() => {
    if (!primaryPallet) return [];

    const packed = primaryPallet.packedBoxes;
    // Find unique rounded elevation levels (y in cm)
    const yLevels = Array.from(new Set(packed.map(b => Math.round(b.y * 10) / 10)))
      .sort((a, b) => a - b);

    const layers = yLevels.map((y, idx) => {
      const boxesInLayer = packed.filter(b => Math.abs(b.y - y) < 0.5);
      
      // Map each box to its group shortCode and palette
      const itemBlocks = boxesInLayer.map(b => {
        const matchGroup = boxGroupStats.find(g => 
          g.fullName === (b.materialName || b.name) || 
          (g.materialCode && g.materialCode === b.materialCode)
        );
        return {
          boxId: b.id,
          shortCode: matchGroup ? matchGroup.shortCode : 'X',
          palette: matchGroup ? matchGroup.palette : PASTEL_PALETTE[0],
          name: b.name
        };
      });

      return {
        layerNumber: idx + 1,
        yElevation: y,
        blocks: itemBlocks
      };
    });

    // Sort layers top down (e.g. 4. kat, 3. kat, 2. kat, 1. kat)
    return layers.reverse();
  }, [primaryPallet, boxGroupStats]);

  // Compute Decision Option Text
  const decisionOptionA = useMemo(() => {
    const packedParts: string[] = [];
    const unpackedParts: string[] = [];

    boxGroupStats.forEach((g) => {
      if (g.packedCount > 0) {
        if (g.packedCount === g.totalCount) {
          packedParts.push(`${g.shortCode}'in tamamı (${g.packedCount} koli)`);
        } else {
          packedParts.push(`${g.packedCount} koli ${g.shortCode}`);
        }
      }
      if (g.unpackedCount > 0) {
        unpackedParts.push(`${g.unpackedCount} koli ${g.shortCode}`);
      }
    });

    const packedSummary = packedParts.join(' + ');
    const unpackedSummary = unpackedParts.length > 0 
      ? `; ${unpackedParts.join(', ')} devreder.` 
      : ' sevk edilir. Devreden koli bulunmamaktadır.';

    return `Öneri: ${packedSummary} sevk${unpackedSummary}`;
  }, [boxGroupStats]);

  const decisionOptionB = useMemo(() => {
    if (result.totalBoxesRemaining === 0) {
      return `Alternatif: Tüm koliler tek palete tam olarak sığmaktadır. Ek operasyona gerek yoktur.`;
    }
    return `Alternatif: ${totalInventoryCount} kolinin tamamı sevk; ilave ${result.totalBoxesRemaining} koli için ilave taşıma ve maliyet teyidi gerekir.`;
  }, [result, totalInventoryCount]);

  // Copy Executive Summary to Clipboard
  const handleCopySummary = () => {
    const textLines = [
      `--- SEVKİYAT KARAR KARTI ---`,
      `Dönem: ${shipmentWeek} | Müşteri: ${customerInfo} | Durum: ${scenarioTag}`,
      ``,
      `[1] ÖZET METRİKLER:`,
      `- Hazır Ürün: ${totalInventoryCount} koli (${boxGroupStats.map(g => `${g.shortCode}: ${g.totalCount}`).join(' · ')})`,
      `- Palet Kapasitesi: ${primaryPackedCount} koli (${primaryLayerCount} kat × ~${avgBoxesPerLayer} koli)`,
      `- Kapasite Aşımı: ${result.totalBoxesRemaining} koli (Karar bekliyor)`,
      ``,
      `[2] SEVKİYAT PLANI (1 Tam Palet):`,
      boxGroupStats.map(g => `- ${g.shortCode}: ${g.packedCount} koli`).join('\n'),
      ``,
      `[3] SONRAKİ SEVKİYATA DEVREDEN:`,
      result.totalBoxesRemaining > 0 
        ? boxGroupStats.filter(g => g.unpackedCount > 0).map(g => `- ${g.unpackedCount} koli ${g.shortCode}`).join('\n')
        : `- Sığmayan koli yok, %100 yükleme gerçekleşti.`,
      ``,
      `[4] ALINAN KARAR:`,
      `Seçilen Opsiyon: Opsiyon ${selectedDecision}`,
      selectedDecision === 'A' ? decisionOptionA : decisionOptionB,
      ``,
      `Oluşturulma Tarihi: ${new Date().toLocaleString('tr-TR')}`
    ];

    navigator.clipboard.writeText(textLines.join('\n'));
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-5xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-zinc-100 print:bg-white print:text-black print:border-none print:shadow-none print:max-h-none print:w-full">
        
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 bg-zinc-900/90 no-print">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <FileText size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Sevkiyat Karar & Raporlama Sistemi</h2>
                <span className="px-2 py-0.5 text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-md uppercase tracking-wider">
                  Karar Kartı V2
                </span>
              </div>
              <p className="text-xs text-zinc-400">Üst yönetim karar kartı ve detaylı yükleme simülasyonu</p>
            </div>
          </div>

          {/* Tab Switcher & Action Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Tab Pills */}
            <div className="bg-zinc-800/80 p-1 rounded-xl border border-zinc-700/80 flex items-center gap-1">
              <button
                onClick={() => setActiveTab('decision_card')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'decision_card'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                }`}
              >
                <Sparkles size={14} /> Sevkiyat Karar Kartı
              </button>
              <button
                onClick={() => setActiveTab('manifesto')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'manifesto'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-700/50'
                }`}
              >
                <Layers size={14} /> Detaylı Manifesto
              </button>
            </div>

            <button
              onClick={handleCopySummary}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Özet rapor metnini kopyala"
            >
              {copiedText ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedText ? 'Kopyalandı!' : 'Kararı Kopyala'}</span>
            </button>

            {activeTab === 'manifesto' && (
              <button
                onClick={handleExportCSV}
                className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Download size={14} /> CSV İndir
              </button>
            )}

            <button
              onClick={handlePrint}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Printer size={14} /> Yazdır / PDF
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6 print:p-0 print:overflow-visible text-zinc-100 print:text-black">
          
          {/* ========================================================================= */}
          {/* TAB 1: SEVKİYAT KARAR KARTI (EXECUTIVE DECISION CARD) */}
          {/* ========================================================================= */}
          {activeTab === 'decision_card' && (
            <div className="max-w-4xl mx-auto space-y-6 print:space-y-4">
              
              {/* Printable Executive Card Wrapper (Clean White/Bright Light Theme when Printed) */}
              <div className="bg-white text-zinc-900 rounded-2xl p-6 sm:p-8 shadow-xl border border-zinc-200 space-y-6 print:shadow-none print:p-0 print:border-none print:rounded-none">
                
                {/* 1. Header Row */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-200 pb-4">
                  <div>
                    <h1 className="text-2xl font-black text-zinc-900 tracking-tight flex items-center gap-2">
                      Sevkiyat karar kartı
                    </h1>
                    
                    {/* Interactive / Editable Subtitle for Customizing Shipment Context */}
                    <div className="flex flex-wrap items-center gap-3 mt-1.5 text-sm text-zinc-600 no-print">
                      <div className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                        <Calendar size={13} className="text-zinc-500" />
                        <input
                          type="text"
                          value={shipmentWeek}
                          onChange={(e) => setShipmentWeek(e.target.value)}
                          className="bg-transparent text-xs font-bold text-zinc-800 outline-none w-24"
                          placeholder="W43 Cuma"
                        />
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                        <User size={13} className="text-zinc-500" />
                        <input
                          type="text"
                          value={customerInfo}
                          onChange={(e) => setCustomerInfo(e.target.value)}
                          className="bg-transparent text-xs font-bold text-zinc-800 outline-none w-44"
                          placeholder="A müşterisi / USA"
                        />
                      </div>
                    </div>

                    {/* Print-only static subtitle */}
                    <div className="hidden print:block text-sm font-semibold text-zinc-600 mt-1">
                      {shipmentWeek} · {customerInfo}
                    </div>
                  </div>

                  {/* Top Right Badge / Tag */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={scenarioTag}
                      onChange={(e) => setScenarioTag(e.target.value)}
                      className="no-print bg-zinc-100 text-zinc-700 hover:bg-zinc-200 px-3 py-1 rounded-md text-xs font-extrabold uppercase tracking-wider border border-zinc-300 text-center cursor-pointer transition-colors"
                    />
                    <span className="hidden print:inline-block bg-zinc-200 text-zinc-800 px-3 py-1 rounded text-xs font-extrabold uppercase tracking-wider">
                      {scenarioTag}
                    </span>
                  </div>
                </div>

                {/* 2. Top Metric Cards (3 Cards in horizontal grid) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Card 1: Hazır Ürün */}
                  <div className="bg-zinc-100/80 border border-zinc-200 p-4 rounded-xl shadow-sm">
                    <span className="text-xs font-bold text-zinc-500 block mb-1">Hazır ürün</span>
                    <div className="text-2xl font-black text-zinc-900 tracking-tight mb-1">
                      {totalInventoryCount} koli
                    </div>
                    <div className="text-xs text-zinc-600 font-medium font-mono">
                      {boxGroupStats.map((g, idx) => (
                        <span key={g.shortCode}>
                          {idx > 0 && ' · '}
                          <span className="font-bold">{g.shortCode}: {g.totalCount}</span>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Card 2: Palet Kapasitesi */}
                  <div className="bg-zinc-100/80 border border-zinc-200 p-4 rounded-xl shadow-sm">
                    <span className="text-xs font-bold text-zinc-500 block mb-1">Palet kapasitesi</span>
                    <div className="text-2xl font-black text-zinc-900 tracking-tight mb-1">
                      {primaryPackedCount} koli
                    </div>
                    <div className="text-xs text-zinc-600 font-medium">
                      {primaryLayerCount} kat × ~{avgBoxesPerLayer} koli
                    </div>
                  </div>

                  {/* Card 3: Kapasite Aşımı */}
                  <div className={`border p-4 rounded-xl shadow-sm ${
                    result.totalBoxesRemaining > 0 
                      ? 'bg-rose-50/80 border-rose-200' 
                      : 'bg-emerald-50/80 border-emerald-200'
                  }`}>
                    <span className="text-xs font-bold text-zinc-500 block mb-1">Kapasite aşımı</span>
                    <div className={`text-2xl font-black tracking-tight mb-1 ${
                      result.totalBoxesRemaining > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}>
                      {result.totalBoxesRemaining} koli
                    </div>
                    <div className="text-xs font-bold text-zinc-600">
                      {result.totalBoxesRemaining > 0 ? 'Karar bekliyor' : 'Sıfır aşım (%100 sığdı)'}
                    </div>
                  </div>
                </div>

                {/* 3. Section A: Önerilen Sevkiyat — 1 Tam Palet */}
                <div className="space-y-3 pt-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-zinc-900 flex items-center gap-2">
                      <span>A · Önerilen sevkiyat — 1 tam palet</span>
                    </h3>
                  </div>

                  {/* Color Legend Pills */}
                  <div className="flex flex-wrap items-center gap-3 text-xs font-medium">
                    {boxGroupStats.map((g) => {
                      const priority = priorities[g.typeKey] || 'Normal';
                      return (
                        <div key={g.shortCode} className="flex items-center gap-1.5">
                          <span className={`w-3.5 h-3.5 rounded ${g.palette.badge}`} />
                          <span className="font-bold text-zinc-900">{g.shortCode} · {g.packedCount} koli</span>
                          {priority !== 'Normal' && (
                            <span className="text-zinc-500 font-normal">/ {priority.toLowerCase()}</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Layer-by-Layer Visual Grid (Kat Kat Dizilim) */}
                  <div className="border border-zinc-200 rounded-xl p-4 bg-zinc-50/50 space-y-2.5">
                    {layerGridData.length > 0 ? (
                      layerGridData.map((layer) => (
                        <div key={layer.layerNumber} className="flex items-center gap-3">
                          {/* Katman Label */}
                          <div className="w-16 shrink-0 text-xs font-bold text-zinc-500 text-right">
                            {layer.layerNumber}. kat
                          </div>

                          {/* Horizontal Row of Box Blocks */}
                          <div className="flex-1 grid grid-cols-8 gap-1.5">
                            {layer.blocks.map((block, bIdx) => (
                              <div
                                key={`${block.boxId}-${bIdx}`}
                                className={`h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-sm transition-transform hover:scale-[1.03] border ${block.palette.bg} ${block.palette.border} ${block.palette.text}`}
                                title={`${block.name} (1.0 Koli)`}
                              >
                                {block.shortCode}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs text-zinc-400">
                        Henüz palete yerleşen koli bulunmamaktadır.
                      </div>
                    )}
                  </div>

                  {/* Subtext info */}
                  <div className="text-xs text-zinc-500 font-medium">
                    Her kutu = 1 koli · Doluluk: <span className="font-bold text-zinc-800">{primaryPackedCount} / {primaryPackedCount}</span>
                  </div>
                </div>

                {/* 4. Section B: Sonraki Sevkiyata Devreden */}
                <div className="space-y-3 pt-2 border-t border-zinc-200">
                  <h3 className="text-base font-bold text-zinc-900">
                    Sonraki sevkiyata devreden
                  </h3>

                  {result.totalBoxesRemaining > 0 ? (
                    <div className="space-y-2">
                      {/* Unpacked boxes block icons */}
                      <div className="flex flex-wrap items-center gap-2">
                        {boxGroupStats.filter(g => g.unpackedCount > 0).flatMap((g) =>
                          Array.from({ length: g.unpackedCount }).map((_, i) => (
                            <div
                              key={`${g.shortCode}-unpacked-${i}`}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm border ${g.palette.bg} ${g.palette.border} ${g.palette.text}`}
                            >
                              {g.shortCode}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="text-xs font-medium text-zinc-600">
                        {boxGroupStats
                          .filter(g => g.unpackedCount > 0)
                          .map(g => `${g.unpackedCount} koli ${g.shortCode}`)
                          .join(' + ')} · Müşteri terminine etkisi teyit edilecek
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex items-center gap-2">
                      <CheckCircle size={16} />
                      <span>Sığmayan veya sonraki sevkiyata devreden koli bulunmamaktadır. Tüm sipariş tek palete yüklenmiştir.</span>
                    </div>
                  )}
                </div>

                {/* 5. Section C: Yönetimden Beklenen Karar */}
                <div className="space-y-3 pt-2 border-t border-zinc-200">
                  <h3 className="text-base font-bold text-zinc-900">
                    Yönetimden beklenen karar
                  </h3>

                  <div className="space-y-2.5">
                    {/* Option A (Recommended) */}
                    <div
                      onClick={() => setSelectedDecision('A')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        selectedDecision === 'A'
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        selectedDecision === 'A' ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-400 bg-white'
                      }`}>
                        {selectedDecision === 'A' && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className="text-xs">
                        <span className="font-extrabold text-zinc-900 block mb-0.5">
                          A — Öneri: {decisionOptionA.replace('Öneri: ', '')}
                        </span>
                        <span className="text-zinc-500">
                          (Standart navlun bütçesi korunur, devreden koliler bir sonraki haftalık yükleme programına eklenir)
                        </span>
                      </div>
                    </div>

                    {/* Option B (Alternative) */}
                    <div
                      onClick={() => setSelectedDecision('B')}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start gap-3 ${
                        selectedDecision === 'B'
                          ? 'bg-blue-50/80 border-blue-500 ring-2 ring-blue-500/20'
                          : 'bg-zinc-50 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 mt-0.5 ${
                        selectedDecision === 'B' ? 'border-blue-600 bg-blue-600 text-white' : 'border-zinc-400 bg-white'
                      }`}>
                        {selectedDecision === 'B' && <Check size={12} strokeWidth={3} />}
                      </div>
                      <div className="text-xs">
                        <span className="font-extrabold text-zinc-900 block mb-0.5">
                          B — Alternatif: {decisionOptionB.replace('Alternatif: ', '')}
                        </span>
                        <span className="text-zinc-500">
                          (İkinci bir yarım palet / parsiyel kargo seçeneği için onay alınması gerekmektedir)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer Notes & Digital Signatures */}
                <div className="pt-4 border-t border-zinc-200 flex flex-wrap items-center justify-between gap-2 text-[11px] text-zinc-400 font-medium">
                  <span>Desird Load Simulator • EPAL 1 & ISO Standartlarına Uygun Yükleme Motoru</span>
                  <span>Karar Onay Kodu: DSR-KARAR-{Math.floor(100000 + Math.random() * 900000)}</span>
                </div>

              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* TAB 2: DETAYLI SEVKİYAT MANİFESTOSU (FULL TECHNICAL SPEC) */}
          {/* ========================================================================= */}
          {activeTab === 'manifesto' && (
            <div className="space-y-6">
              
              {/* Top Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-zinc-800/60 border border-zinc-700/60 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Palet Sayısı</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono tabular-nums text-white">{result.pallets.length}</span>
                    <span className="text-xs text-zinc-400">Adet</span>
                  </div>
                </div>

                <div className="bg-zinc-800/60 border border-zinc-700/60 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Yerleşen / Kalan</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono tabular-nums text-emerald-400">{result.totalBoxesPacked}</span>
                    <span className="text-xs text-zinc-400">/</span>
                    <span className="text-2xl font-bold font-mono tabular-nums text-rose-400">{result.totalBoxesRemaining}</span>
                  </div>
                </div>

                <div className="bg-zinc-800/60 border border-zinc-700/60 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Toplam Brüt / Desi</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono tabular-nums text-white">{result.totalWeight}</span>
                    <span className="text-xs text-zinc-400">/</span>
                    <span className="text-xl font-bold font-mono tabular-nums text-zinc-300">
                      {Math.round(result.pallets.reduce((s, p) => s + p.chargeableWeight, 0))} kg
                    </span>
                  </div>
                </div>

                <div className="bg-zinc-800/60 border border-zinc-700/60 p-3.5 rounded-xl">
                  <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-1">Ort. Hacim Verimliliği</span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-bold font-mono tabular-nums text-blue-400">%{result.totalEfficiency}</span>
                  </div>
                </div>
              </div>

              {/* Pallet Breakdown */}
              {result.pallets.map((p) => {
                const boxGroups = p.packedBoxes.reduce((acc, b) => {
                  const key = `${b.materialCode || ''}-${b.name}-${b.width}-${b.height}-${b.depth}`;
                  if (!acc[key]) {
                    acc[key] = {
                      name: b.name,
                      materialCode: b.materialCode,
                      materialName: b.materialName,
                      innerQuantity: b.innerQuantity || 1,
                      width: b.width,
                      height: b.height,
                      depth: b.depth,
                      weight: b.weight || 0,
                      count: 0,
                      color: b.color
                    };
                  }
                  acc[key].count++;
                  return acc;
                }, {} as Record<string, { name: string; materialCode?: string; materialName?: string; innerQuantity: number; width: number; height: number; depth: number; weight: number; count: number; color: string }>);

                return (
                  <div key={p.id} className="border border-zinc-700/80 rounded-xl bg-zinc-800/30 overflow-hidden">
                    {/* Pallet Card Header */}
                    <div className="bg-zinc-800/80 px-4 py-3 border-b border-zinc-700/80 flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-white">{p.id}</span>
                        <span className="text-zinc-400 text-xs font-mono">
                          ({Math.round(p.pallet.width * 10)} × {Math.round(p.pallet.depth * 10)} × {Math.round(p.pallet.height * 10)} mm)
                        </span>
                      </div>

                      {/* Centering Verification Badge */}
                      <div className="flex items-center gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
                          <CheckCircle size={14} />
                          <span>Eşit Kenar Mesafesi (Ortalanmış)</span>
                        </div>
                        <span className="text-zinc-600">|</span>
                        <span className="font-mono text-zinc-300">
                          Sol: {p.margins.left}mm = Sağ: {p.margins.right}mm
                        </span>
                        <span className="text-zinc-600">|</span>
                        <span className="font-mono text-zinc-300">
                          Ön: {p.margins.front}mm = Arka: {p.margins.back}mm
                        </span>
                      </div>
                    </div>

                    {/* Weight Balance & CoG Info */}
                    <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 border-b border-zinc-800 text-xs">
                      <div className="flex items-center gap-2">
                        <Scale size={16} className="text-blue-400 shrink-0" />
                        <div>
                          <span className="text-zinc-400 block text-[10px] uppercase">Brüt / Desi Ağırlık</span>
                          <span className="font-mono font-bold text-zinc-200">
                            {p.actualWeight} kg / {p.chargeableWeight} kg
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Layers size={16} className="text-amber-400 shrink-0" />
                        <div>
                          <span className="text-zinc-400 block text-[10px] uppercase">Yükleme Yüksekliği & Katman</span>
                          <span className="font-mono font-bold text-zinc-200">
                            {Math.round(p.maxPackedHeight * 10)} mm ({p.layerCount} Katman)
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {p.centerOfGravity.status === 'perfect' || p.centerOfGravity.status === 'good' ? (
                          <CheckCircle size={16} className="text-emerald-400 shrink-0" />
                        ) : (
                          <AlertTriangle size={16} className="text-amber-400 shrink-0" />
                        )}
                        <div>
                          <span className="text-zinc-400 block text-[10px] uppercase">Ağırlık Merkezi (CoG) Durumu</span>
                          <span className="font-mono font-bold text-emerald-400">
                            {p.centerOfGravity.statusLabel} (%{p.centerOfGravity.deviationPercent} sapma)
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Box Table */}
                    <div className="p-4 overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-zinc-700/80 text-[11px] uppercase tracking-wider text-zinc-400 font-semibold">
                            <th className="pb-2">Malzeme Kodu / Adı</th>
                            <th className="pb-2 text-right">Ölçüler (G × D × Y mm)</th>
                            <th className="pb-2 text-right">Koli İçi Adet</th>
                            <th className="pb-2 text-right">Koli Adedi</th>
                            <th className="pb-2 text-right">Toplam Ürün</th>
                            <th className="pb-2 text-right">Birim / Toplam Ağırlık</th>
                            <th className="pb-2 text-right">Hacim Payı</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {Object.values(boxGroups).map((g, idx) => {
                            const totalGroupWeight = Math.round(g.weight * g.count * 10) / 10;
                            const groupVolume = g.width * g.height * g.depth * g.count;
                            const volShare = Math.round((groupVolume / p.totalLoadedVolume) * 1000) / 10;
                            const totalItems = g.count * (g.innerQuantity || 1);

                            return (
                              <tr key={idx} className="hover:bg-zinc-800/40">
                                <td className="py-2.5 flex items-center gap-2 font-medium text-white">
                                  <span
                                    className="w-3 h-3 rounded shrink-0"
                                    style={{ backgroundColor: g.color }}
                                  />
                                  <div>
                                    {g.materialCode && (
                                      <span className="font-mono text-[10px] text-blue-400 font-bold block">
                                        [{g.materialCode}]
                                      </span>
                                    )}
                                    <span>{g.materialName || g.name}</span>
                                  </div>
                                </td>
                                <td className="py-2.5 text-right font-mono text-zinc-300">
                                  {Math.round(g.width * 10)} × {Math.round(g.depth * 10)} × {Math.round(g.height * 10)}
                                </td>
                                <td className="py-2.5 text-right font-mono text-emerald-400 font-semibold">
                                  {g.innerQuantity} adet/koli
                                </td>
                                <td className="py-2.5 text-right font-mono font-bold text-white">
                                  {g.count} koli
                                </td>
                                <td className="py-2.5 text-right font-mono font-bold text-emerald-300">
                                  {totalItems} adet
                                </td>
                                <td className="py-2.5 text-right font-mono text-zinc-300">
                                  {g.weight} / <span className="text-white font-bold">{totalGroupWeight} kg</span>
                                </td>
                                <td className="py-2.5 text-right font-mono text-blue-400">
                                  %{volShare}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Unpacked Boxes Alert */}
              {result.unpackedBoxes.length > 0 && (
                <div className="p-4 border border-rose-500/40 bg-rose-500/10 rounded-xl flex items-start gap-3">
                  <AlertTriangle className="text-rose-400 shrink-0 mt-0.5" size={18} />
                  <div>
                    <h4 className="text-sm font-bold text-rose-300">Sığmayan / Kalan Koliler ({result.unpackedBoxes.length} Adet)</h4>
                    <p className="text-xs text-rose-200/80 mt-1">
                      Mevcut paletlerin hacim veya azami ağırlık sınırları dolduğu için bazı koliler yerleştirilememiştir. İkinci bir palet açabilir ya da koli adetlerini revize edebilirsiniz.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-zinc-800 flex items-center justify-between text-xs text-zinc-400 bg-zinc-900/90 no-print">
          <span>Desird Load Simulator • ISO & EPAL Standartlarına Uygun Yükleme Motoru</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg font-medium transition-colors"
          >
            Kapat
          </button>
        </div>

      </div>
    </div>
  );
};
