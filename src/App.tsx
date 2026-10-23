import React, { useState, useMemo, useEffect } from 'react';
import { 
  Package, 
  Plus, 
  Trash2, 
  RotateCcw, 
  Layers, 
  Eye, 
  CheckCircle, 
  Crosshair, 
  Ruler, 
  Box as BoxIcon,
  ChevronDown,
  FileSpreadsheet,
  Database,
  Search,
  X,
  Palette,
  Sliders,
  FileText,
  ArrowUp
} from 'lucide-react';
import { 
  Box, 
  PackedBox, 
  Pallet, 
  PackingResult, 
  PalletResult, 
  PALLET_PRESETS, 
  ProductCatalogItem,
  DEFAULT_MASTER_CATALOG
} from './types';
import { Pallet3D } from './components/Pallet3D';
import { ReportModal } from './components/ReportModal';
import { ImportModal } from './components/ImportModal';
import { CatalogManagerModal } from './components/CatalogManagerModal';
import { ManualPlacementStudio } from './components/ManualPlacementStudio';

const PRESET_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', 
  '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#e11d48'
];

export default function App() {
  // Master Product Catalog state (persistent in localStorage)
  const [masterCatalog, setMasterCatalog] = useState<ProductCatalogItem[]>(() => {
    try {
      const saved = localStorage.getItem('desird_master_product_catalog');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading master catalog from localStorage', e);
    }
    return DEFAULT_MASTER_CATALOG;
  });

  // Save to localStorage whenever masterCatalog changes
  useEffect(() => {
    try {
      localStorage.setItem('desird_master_product_catalog', JSON.stringify(masterCatalog));
    } catch (e) {
      console.error('Error saving master catalog to localStorage', e);
    }
  }, [masterCatalog]);

  // Modals state
  const [isCatalogManagerOpen, setIsCatalogManagerOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isAddBoxModalOpen, setIsAddBoxModalOpen] = useState(false);

  // Pallet state (dimensions in cm internally, displayed in mm)
  const [pallet, setPallet] = useState<Pallet>({ 
    width: 120, 
    height: 180, 
    depth: 80,
    maxWeight: 1500,
    tareWeight: 25
  });
  const [selectedPresetId, setSelectedPresetId] = useState<string>('euro_epal1');

  // Box inventory state
  const [boxes, setBoxes] = useState<Box[]>([
    { 
      id: 'box-1', 
      name: 'Standart İhracat Kolisi A', 
      materialCode: 'MLZ-101',
      materialName: 'Standart İhracat Kolisi A',
      innerQuantity: 12,
      width: 40, 
      height: 30, 
      depth: 30, 
      color: '#3b82f6', 
      quantity: 18, 
      allowRotateY: true, 
      allowRotateX: false, 
      allowRotateZ: false, 
      stackable: true, 
      mustBeBottom: false, 
      weight: 8 
    },
    { 
      id: 'box-2', 
      name: 'Ağır Yedek Parça B', 
      materialCode: 'MLZ-102',
      materialName: 'Ağır Yedek Parça B',
      innerQuantity: 6,
      width: 40, 
      height: 25, 
      depth: 40, 
      color: '#f59e0b', 
      quantity: 12, 
      allowRotateY: true, 
      allowRotateX: false, 
      allowRotateZ: false, 
      stackable: true, 
      mustBeBottom: true, 
      weight: 18 
    },
    { 
      id: 'box-3', 
      name: 'Küçük Aksesuar Kolisi C', 
      materialCode: 'MLZ-103',
      materialName: 'Küçük Aksesuar Kolisi C',
      innerQuantity: 24,
      width: 30, 
      height: 20, 
      depth: 20, 
      color: '#10b981', 
      quantity: 24, 
      allowRotateY: true, 
      allowRotateX: true, 
      allowRotateZ: false, 
      stackable: true, 
      mustBeBottom: false, 
      weight: 3.5 
    }
  ]);

  // Placed boxes on the pallet
  const [manualPackedBoxes, setManualPackedBoxes] = useState<PackedBox[]>([]);
  const [selectedBox, setSelectedBox] = useState<{ box: PackedBox; palletId: string } | null>(null);
  const [hoveredBox, setHoveredBox] = useState<PackedBox | null>(null);

  // 3D Visual Tool Toggles (Default false for clean viewport)
  const [showCoG, setShowCoG] = useState(false);
  const [showRulers, setShowRulers] = useState(false);
  const [showWireframe, setShowWireframe] = useState(false);
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [cameraPreset, setCameraPreset] = useState<'iso' | 'top' | 'front' | 'side'>('iso');

  // Quick Add Box Modal Form State
  const [addBoxTab, setAddBoxTab] = useState<'catalog' | 'custom'>('catalog');
  const [catSearchTerm, setCatSearchTerm] = useState('');
  const [selectedCatId, setSelectedCatId] = useState<string>('');
  const [catAddMode, setCatAddMode] = useState<'box' | 'piece'>('box');
  const [catBoxQty, setCatBoxQty] = useState<number>(10);
  const [catPieceQty, setCatPieceQty] = useState<number>(120);

  // Custom box state
  const [customBoxName, setCustomBoxName] = useState('');
  const [customWidthMm, setCustomWidthMm] = useState(400);
  const [customDepthMm, setCustomDepthMm] = useState(300);
  const [customHeightMm, setCustomHeightMm] = useState(250);
  const [customWeight, setCustomWeight] = useState(5);
  const [customQty, setCustomQty] = useState(10);
  const [customColor, setCustomColor] = useState('#3b82f6');

  // Filtered master catalog for picker
  const filteredCatalog = useMemo(() => {
    if (!catSearchTerm.trim()) return masterCatalog;
    const term = catSearchTerm.toLowerCase().trim();
    return masterCatalog.filter(
      item =>
        item.materialCode.toLowerCase().includes(term) ||
        item.materialName.toLowerCase().includes(term) ||
        (item.category && item.category.toLowerCase().includes(term))
    );
  }, [masterCatalog, catSearchTerm]);

  const selectedCatalogItem = useMemo(() => {
    return masterCatalog.find(c => c.id === selectedCatId) || filteredCatalog[0] || null;
  }, [masterCatalog, selectedCatId, filteredCatalog]);

  // Calculate box qty based on piece count or box count
  const calculatedAddStats = useMemo(() => {
    const item = selectedCatalogItem;
    const innerQty = item?.innerQuantity || 1;
    if (catAddMode === 'box') {
      const boxesCount = Math.max(1, catBoxQty);
      return {
        totalBoxes: boxesCount,
        pieces: boxesCount * innerQty,
        innerQty,
        totalWeight: Math.round(boxesCount * (item?.weight || 0) * 10) / 10
      };
    } else {
      const pieces = Math.max(1, catPieceQty);
      const totalBoxes = Math.ceil(pieces / innerQty);
      const remainder = pieces % innerQty;
      return {
        totalBoxes,
        pieces,
        innerQty,
        remainder,
        totalWeight: Math.round(totalBoxes * (item?.weight || 0) * 10) / 10
      };
    }
  }, [selectedCatalogItem, catAddMode, catBoxQty, catPieceQty]);

  // Change Pallet Preset
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = PALLET_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setPallet({
        width: preset.width,
        depth: preset.depth,
        height: preset.height,
        maxWeight: preset.maxWeight,
        tareWeight: 25
      });
    }
  };

  // Center All Boxes on Pallet
  const handleCenterManualBoxes = () => {
    if (manualPackedBoxes.length === 0) return;
    const minX = Math.min(...manualPackedBoxes.map(b => b.x));
    const maxX = Math.max(...manualPackedBoxes.map(b => b.x + b.width));
    const minZ = Math.min(...manualPackedBoxes.map(b => b.z));
    const maxZ = Math.max(...manualPackedBoxes.map(b => b.z + b.depth));

    const usedW = maxX - minX;
    const usedD = maxZ - minZ;

    const targetLeft = Math.max(0, (pallet.width - usedW) / 2);
    const targetBack = Math.max(0, (pallet.depth - usedD) / 2);

    const shiftX = targetLeft - minX;
    const shiftZ = targetBack - minZ;

    setManualPackedBoxes(manualPackedBoxes.map(b => ({
      ...b,
      x: Math.round((b.x + shiftX) * 10) / 10,
      z: Math.round((b.z + shiftZ) * 10) / 10
    })));
  };

  // Rotate Box around Y axis
  const handleManualRotate = () => {
    if (!selectedBox) return;
    const bId = selectedBox.box.id;

    const updated = manualPackedBoxes.map(b => {
      if (b.id !== bId) return b;
      const w = b.depth;
      const d = b.width;
      return {
        ...b,
        width: w,
        depth: d,
        x: Math.min(b.x, pallet.width - w),
        z: Math.min(b.z, pallet.depth - d),
        rotated: !b.rotated
      };
    });

    setManualPackedBoxes(updated);
    const newSel = updated.find(b => b.id === bId);
    if (newSel) setSelectedBox({ box: newSel, palletId: 'manual' });
  };

  // 3D Viewport Position Update
  const handleUpdateManualBoxPosition = (boxId: string, newPos: { x: number; y: number; z: number }) => {
    setManualPackedBoxes(prev => prev.map(b => {
      if (b.id === boxId) {
        return {
          ...b,
          x: Math.round(newPos.x * 10) / 10,
          y: Math.round(newPos.y * 10) / 10,
          z: Math.round(newPos.z * 10) / 10,
        };
      }
      return b;
    }));

    setSelectedBox(prev => {
      if (prev && prev.box.id === boxId) {
        return {
          ...prev,
          box: {
            ...prev.box,
            x: Math.round(newPos.x * 10) / 10,
            y: Math.round(newPos.y * 10) / 10,
            z: Math.round(newPos.z * 10) / 10,
          }
        };
      }
      return prev;
    });
  };

  // Drop selected box to pallet floor (Y = 0)
  const handleDropToFloor = () => {
    if (!selectedBox) return;
    handleUpdateManualBoxPosition(selectedBox.box.id, {
      x: selectedBox.box.x,
      y: 0,
      z: selectedBox.box.z
    });
  };

  // Reset pallet
  const handleReset = () => {
    if (manualPackedBoxes.length > 0 && !window.confirm('Palet üzerindeki tüm koliler temizlensin mi?')) {
      return;
    }
    setManualPackedBoxes([]);
    setSelectedBox(null);
    setHoveredBox(null);
  };

  // Add Box from Catalog Form
  const handleConfirmAddFromCatalog = () => {
    if (!selectedCatalogItem) return;
    const color = PRESET_COLORS[boxes.length % PRESET_COLORS.length];
    const newBox: Box = {
      id: `box-cat-${Date.now()}`,
      name: `${selectedCatalogItem.materialCode} - ${selectedCatalogItem.materialName}`,
      materialCode: selectedCatalogItem.materialCode,
      materialName: selectedCatalogItem.materialName,
      innerQuantity: selectedCatalogItem.innerQuantity,
      targetPieceCount: calculatedAddStats.pieces,
      width: selectedCatalogItem.width,
      depth: selectedCatalogItem.depth,
      height: selectedCatalogItem.height,
      weight: selectedCatalogItem.weight,
      quantity: calculatedAddStats.totalBoxes,
      color,
      allowRotateY: true,
      allowRotateX: false,
      allowRotateZ: false,
      stackable: true,
      mustBeBottom: (selectedCatalogItem.weight || 0) > 20
    };

    setBoxes(prev => [...prev, newBox]);
    setIsAddBoxModalOpen(false);
  };

  // Add Custom Box Form
  const handleConfirmAddCustom = () => {
    const newBox: Box = {
      id: `box-custom-${Date.now()}`,
      name: customBoxName.trim() || `Özel Koli (${customWidthMm}×${customDepthMm} mm)`,
      width: customWidthMm / 10,
      depth: customDepthMm / 10,
      height: customHeightMm / 10,
      weight: customWeight,
      quantity: Math.max(1, customQty),
      color: customColor,
      allowRotateY: true,
      allowRotateX: false,
      allowRotateZ: false,
      stackable: true,
      mustBeBottom: customWeight > 20
    };

    setBoxes(prev => [...prev, newBox]);
    setCustomBoxName('');
    setIsAddBoxModalOpen(false);
  };

  // Delete Box Type from inventory
  const handleDeleteBoxType = (boxTypeId: string) => {
    const boxToDelete = boxes.find(b => b.id === boxTypeId);
    if (!boxToDelete) return;

    // Check if there are placed boxes on the pallet of this type
    const placedBoxesOfThisType = manualPackedBoxes.filter(
      b => b.id.startsWith(boxTypeId) || b.name === boxToDelete.name
    );

    if (placedBoxesOfThisType.length > 0) {
      if (!window.confirm(`Bu koli tipinden palet üzerinde ${placedBoxesOfThisType.length} adet bulunuyor. Koli tipi silindiğinde paletteki bu koliler de kaldırılacaktır. Onaylıyor musunuz?`)) {
        return;
      }
      setManualPackedBoxes(prev => prev.filter(
        b => !b.id.startsWith(boxTypeId) && b.name !== boxToDelete.name
      ));
      if (selectedBox && (selectedBox.box.id.startsWith(boxTypeId) || selectedBox.box.name === boxToDelete.name)) {
        setSelectedBox(null);
      }
    }

    setBoxes(prev => prev.filter(b => b.id !== boxTypeId));
  };

  // Update Box Type Total Quantity and sync with placed boxes on pallet
  const handleUpdateBoxQuantity = (boxTypeId: string, newQuantity: number) => {
    const targetBox = boxes.find(b => b.id === boxTypeId);
    if (!targetBox) return;

    const qty = Math.max(0, newQuantity);

    // Find all placed boxes of this type on the pallet
    const placedOfThisType = manualPackedBoxes.filter(
      pb => pb.materialCode === targetBox.materialCode || pb.name === targetBox.name || pb.id.startsWith(boxTypeId)
    );

    if (placedOfThisType.length > qty) {
      const excessCount = placedOfThisType.length - qty;
      // Sort placed boxes so we remove the ones placed last (highest sequence or layer)
      const sorted = [...placedOfThisType].sort((a, b) => (b.sequenceNumber || 0) - (a.sequenceNumber || 0));
      const idsToRemove = new Set(sorted.slice(0, excessCount).map(b => b.id));

      setManualPackedBoxes(prev => prev.filter(b => !idsToRemove.has(b.id)));

      // Clear selected box if it was removed
      if (selectedBox && idsToRemove.has(selectedBox.box.id)) {
        setSelectedBox(null);
      }
    }

    setBoxes(prev => prev.map(b => b.id === boxTypeId ? { ...b, quantity: qty } : b));
  };

  // Calculate virtual PalletResult for 3D Viewport & ReportModal
  const activePalletList = useMemo((): PalletResult[] => {
    const totalVol = pallet.width * pallet.height * pallet.depth;
    const loadedVol = manualPackedBoxes.reduce((s, b) => s + b.width * b.height * b.depth, 0);
    const actualWeight = manualPackedBoxes.reduce((s, b) => s + (b.weight || 0), 0);
    const maxPackedH = manualPackedBoxes.reduce((m, b) => Math.max(m, b.y + b.height), 0);
    const chargeableWeight = Math.round(((pallet.width * pallet.depth * maxPackedH) / 5000) * 10) / 10;

    let totalMass = 0;
    let sumMx = 0, sumMy = 0, sumMz = 0;
    manualPackedBoxes.forEach(b => {
      const m = (b.weight && b.weight > 0) ? b.weight : (b.width * b.height * b.depth) / 1000;
      totalMass += m;
      sumMx += m * (b.x + b.width / 2);
      sumMy += m * (b.y + b.height / 2);
      sumMz += m * (b.z + b.depth / 2);
    });

    const cgX = totalMass > 0 ? sumMx / totalMass : pallet.width / 2;
    const cgY = totalMass > 0 ? sumMy / totalMass : 0;
    const cgZ = totalMass > 0 ? sumMz / totalMass : pallet.depth / 2;
    const xOffset = cgX - pallet.width / 2;
    const zOffset = cgZ - pallet.depth / 2;
    const maxR = Math.hypot(pallet.width / 2, pallet.depth / 2);
    const devPercent = maxR > 0 ? Math.min(100, Math.round((Math.hypot(xOffset, zOffset) / maxR) * 1000) / 10) : 0;

    const minX = manualPackedBoxes.length > 0 ? Math.min(...manualPackedBoxes.map(b => b.x)) : 0;
    const maxX = manualPackedBoxes.length > 0 ? Math.max(...manualPackedBoxes.map(b => b.x + b.width)) : 0;
    const minZ = manualPackedBoxes.length > 0 ? Math.min(...manualPackedBoxes.map(b => b.z)) : 0;
    const maxZ = manualPackedBoxes.length > 0 ? Math.max(...manualPackedBoxes.map(b => b.z + b.depth)) : 0;

    const leftMargin = manualPackedBoxes.length > 0 ? Math.round(minX * 10) : 0;
    const rightMargin = manualPackedBoxes.length > 0 ? Math.round((pallet.width - maxX) * 10) : 0;
    const frontMargin = manualPackedBoxes.length > 0 ? Math.round(minZ * 10) : 0;
    const backMargin = manualPackedBoxes.length > 0 ? Math.round((pallet.depth - maxZ) * 10) : 0;

    const statusLabel =
      devPercent < 5
        ? 'Kusursuz Dengeli'
        : devPercent < 15
        ? 'Dengeli'
        : devPercent < 30
        ? 'Hafif Sapma'
        : 'Dengesiz Yük!';

    return [{
      id: 'manual',
      pallet,
      packedBoxes: manualPackedBoxes,
      efficiency: totalVol > 0 ? Math.min(100, Math.round((loadedVol / totalVol) * 1000) / 10) : 0,
      actualWeight: Math.round(actualWeight * 10) / 10,
      chargeableWeight,
      totalLoadedVolume: Math.round(loadedVol),
      maxPackedHeight: Math.round(maxPackedH * 10) / 10,
      layerCount: Math.max(1, ...manualPackedBoxes.map(b => b.layerIndex || 1)),
      centerOfGravity: {
        x: Math.round(cgX * 10) / 10,
        y: Math.round(cgY * 10) / 10,
        z: Math.round(cgZ * 10) / 10,
        idealX: pallet.width / 2,
        idealZ: pallet.depth / 2,
        xOffset: Math.round(xOffset * 10) / 10,
        zOffset: Math.round(zOffset * 10) / 10,
        deviationPercent: devPercent,
        status: devPercent < 5 ? 'perfect' : devPercent < 15 ? 'good' : devPercent < 30 ? 'warning' : 'critical',
        statusLabel
      },
      margins: {
        left: leftMargin,
        right: rightMargin,
        front: frontMargin,
        back: backMargin,
        isXBalanced: Math.abs(leftMargin - rightMargin) <= 10,
        isZBalanced: Math.abs(frontMargin - backMargin) <= 10
      }
    }];
  }, [pallet, manualPackedBoxes]);

  // Virtual packing result for ReportModal
  const virtualPackingResult: PackingResult = useMemo(() => {
    const pRes = activePalletList[0];
    return {
      pallets: activePalletList,
      totalBoxesPacked: manualPackedBoxes.length,
      totalBoxesRemaining: 0,
      unpackedBoxes: [],
      totalEfficiency: pRes.efficiency,
      totalWeight: pRes.actualWeight + (pallet.tareWeight || 25)
    };
  }, [activePalletList, manualPackedBoxes.length, pallet.tareWeight]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans select-none">
      {/* 
        ========================================================================
        TOP NAVIGATION BAR: Brand, Pallet Selector & Primary Actions
        ========================================================================
      */}
      <header className="h-13 border-b border-zinc-800 bg-zinc-900/95 px-4 flex items-center justify-between shrink-0 z-30">
        {/* Zone 1: Brand Wordmark & Tagline */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm shrink-0">
            <Package size={18} />
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-base font-bold text-white tracking-tight">
              Paletify
            </span>
            <span className="hidden sm:inline text-xs text-zinc-400 font-medium">
              2D & 3D Palet Stüdyosu
            </span>
          </div>
        </div>

        {/* Zone 2: Pallet Preset Selector & Dimensions */}
        <div className="flex items-center gap-2 bg-zinc-800/80 px-2.5 py-1 rounded-lg border border-zinc-700/60">
          <label className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider flex items-center gap-1">
            <Layers size={13} className="text-blue-400" />
            <span className="hidden md:inline">Palet:</span>
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => handleSelectPreset(e.target.value)}
            className="bg-transparent text-xs font-semibold text-zinc-100 outline-none cursor-pointer pr-1"
          >
            {PALLET_PRESETS.map((p) => (
              <option key={p.id} value={p.id} className="bg-zinc-900 text-zinc-100">
                {p.name} ({p.code})
              </option>
            ))}
          </select>
          <span className="text-[11px] font-mono text-emerald-400 font-bold border-l border-zinc-700 pl-2">
            {Math.round(pallet.width * 10)}×{Math.round(pallet.depth * 10)} mm
          </span>
          <span className="text-[11px] font-mono text-amber-400 font-bold border-l border-zinc-700 pl-2 flex items-center gap-1">
            <ArrowUp size={12} className="text-amber-400" />
            <span>Yükseklik: {activePalletList[0] ? Math.round(activePalletList[0].maxPackedHeight * 10) : 0} mm</span>
            <span className="hidden lg:inline text-[10px] text-zinc-400 font-normal">(Max {Math.round(pallet.height * 10)} mm)</span>
          </span>
        </div>

        {/* Zone 3: Actions & Modals */}
        <div className="flex items-center gap-2">
          {/* Master Catalog */}
          <button
            onClick={() => setIsCatalogManagerOpen(true)}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-emerald-300 border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Kalıcı ürün kataloğu"
          >
            <Database size={13} className="text-emerald-400" />
            <span className="hidden sm:inline">Ürün Kataloğu</span>
            <span className="text-[10px] px-1 bg-emerald-500/20 text-emerald-300 rounded font-mono">
              {masterCatalog.length}
            </span>
          </button>

          {/* Import CSV / Excel */}
          <button
            onClick={() => setIsImportOpen(true)}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-blue-300 border border-blue-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Excel veya CSV dosyasından içe aktar"
          >
            <FileSpreadsheet size={13} />
            <span className="hidden sm:inline">İçe Aktar</span>
          </button>

          {/* Paleti Ortala */}
          <button
            onClick={handleCenterManualBoxes}
            disabled={manualPackedBoxes.length === 0}
            className="px-2.5 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-zinc-200 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Tüm kolileri palet merkezine eşit aralıklarla hizalar"
          >
            <Crosshair size={13} className="text-blue-400" />
            <span className="hidden md:inline">Ortala</span>
          </button>

          {/* Manifest / Report */}
          <button
            onClick={() => setIsReportOpen(true)}
            disabled={manualPackedBoxes.length === 0}
            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
            title="Katman katman palet manifestosu ve PDF / CSV raporu"
          >
            <FileText size={13} />
            <span>Rapor / Çıktı</span>
          </button>

          {/* Clear Pallet */}
          {manualPackedBoxes.length > 0 && (
            <button
              onClick={handleReset}
              className="p-1.5 text-zinc-400 hover:text-rose-400 rounded-lg hover:bg-zinc-800 transition-colors"
              title="Paleti Temizle"
            >
              <RotateCcw size={15} />
            </button>
          )}
        </div>
      </header>

      {/* 
        ========================================================================
        WORKSPACE: Integrated 2D & 3D Manual Placement Studio
        ========================================================================
      */}
      <main className="flex-1 flex overflow-hidden relative">
        <ManualPlacementStudio
          pallet={pallet}
          boxes={boxes}
          packedBoxes={manualPackedBoxes}
          onChangePackedBoxes={(newBoxes) => {
            setManualPackedBoxes(newBoxes);
            if (selectedBox) {
              const found = newBoxes.find(b => b.id === selectedBox.box.id);
              if (found) {
                setSelectedBox({ box: found, palletId: 'manual' });
              } else {
                setSelectedBox(null);
              }
            }
          }}
          selectedBoxId={selectedBox?.box.id || null}
          onSelectBoxId={(id) => {
            if (!id) {
              setSelectedBox(null);
            } else {
              const b = manualPackedBoxes.find(box => box.id === id);
              if (b) setSelectedBox({ box: b, palletId: 'manual' });
            }
          }}
          masterCatalog={masterCatalog}
          bgColor="#242c38"
          onOpenAddBoxModal={() => setIsAddBoxModalOpen(true)}
          onDeleteBoxType={handleDeleteBoxType}
          onUpdateBoxQuantity={handleUpdateBoxQuantity}
          render3DViewport={({ snapStep, magneticSnap, cameraLock, activeLayerIndex }) => (
            <div className="w-full h-full relative" style={{ backgroundColor: '#242c38' }}>
              <Pallet3D
                pallets={activePalletList}
                activePalletId="manual"
                selectedBoxId={selectedBox?.box.id}
                hoveredBoxId={hoveredBox?.id}
                onSelectBox={(b, pid) => setSelectedBox({ box: b, palletId: pid })}
                onHoverBox={setHoveredBox}
                showCoG={showCoG}
                showRulers={showRulers}
                showWireframe={showWireframe}
                maxVisibleSequence={9999}
                maxVisibleLayer={999}
                cameraPreset={cameraPreset}
                bgColor="#242c38"
                isManualMode={true}
                onMoveBox={handleUpdateManualBoxPosition}
                onRotateBox={() => handleManualRotate()}
                onDeleteBox={(boxId) => {
                  setManualPackedBoxes(prev => prev.filter(b => b.id !== boxId));
                  setSelectedBox(null);
                }}
                onDropToFloor={handleDropToFloor}
                snapToGrid={true}
                snapStepMm={snapStep}
                magneticSnap={magneticSnap}
                cameraLock={cameraLock}
                autoStack={false}
              />

              {/* Collapsible View & Analysis Control Panel (On-Demand Dropdown) */}
              <div className="absolute top-4 right-4 z-20 pointer-events-auto flex flex-col items-end gap-2">
                <button
                  onClick={() => setIsViewMenuOpen(!isViewMenuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-200 border border-zinc-700/80 rounded-xl shadow-xl text-xs font-semibold backdrop-blur-md transition-all active:scale-95"
                >
                  <Sliders size={14} className="text-blue-400" />
                  <span>Görünüm & Analiz</span>
                  <ChevronDown size={14} className={`text-zinc-400 transition-transform duration-200 ${isViewMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isViewMenuOpen && (
                  <div className="w-64 bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-2xl p-3 text-xs space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                    {/* Kamera Açıları */}
                    <div>
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1.5">Kamera Görünümü</span>
                      <div className="grid grid-cols-4 gap-1 p-1 bg-zinc-950/80 rounded-lg border border-zinc-800/80">
                        {(['iso', 'top', 'front', 'side'] as const).map((preset) => (
                          <button
                            key={preset}
                            onClick={() => setCameraPreset(preset)}
                            className={`py-1 text-[10px] font-bold rounded transition-colors ${
                              cameraPreset === preset ? 'bg-blue-600 text-white shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
                            }`}
                          >
                            {preset === 'iso' ? 'İzo' : preset === 'top' ? 'Üst' : preset === 'front' ? 'Ön' : 'Yan'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Görsel Katman Toggles */}
                    <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Görsel Göstergeler</span>
                      
                      <button
                        onClick={() => setShowRulers(!showRulers)}
                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between border transition-all ${
                          showRulers ? 'bg-blue-950/50 border-blue-500/50 text-blue-300 font-bold' : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Ruler size={13} className={showRulers ? 'text-blue-400' : 'text-zinc-500'} />
                          <span>Cetvel / Kenar Ölçüleri</span>
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${showRulers ? 'bg-blue-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                          {showRulers ? 'AÇIK' : 'KAPALI'}
                        </span>
                      </button>

                      <button
                        onClick={() => setShowCoG(!showCoG)}
                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between border transition-all ${
                          showCoG ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-300 font-bold' : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Crosshair size={13} className={showCoG ? 'text-emerald-400' : 'text-zinc-500'} />
                          <span>Ağırlık Merkezi (CoG)</span>
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${showCoG ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                          {showCoG ? 'AÇIK' : 'KAPALI'}
                        </span>
                      </button>

                      <button
                        onClick={() => setShowWireframe(!showWireframe)}
                        className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between border transition-all ${
                          showWireframe ? 'bg-amber-950/50 border-amber-500/50 text-amber-300 font-bold' : 'bg-zinc-950/40 border-zinc-800/80 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          <Eye size={13} className={showWireframe ? 'text-amber-400' : 'text-zinc-500'} />
                          <span>X-Ray Tel Kafes</span>
                        </div>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${showWireframe ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                          {showWireframe ? 'AÇIK' : 'KAPALI'}
                        </span>
                      </button>
                    </div>

                    {/* Canlı Palet Durumu */}
                    {activePalletList[0] && (
                      <div className="pt-2 border-t border-zinc-800/80 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-bold text-emerald-400">
                          <span className="flex items-center gap-1"><CheckCircle size={12} /> Canlı Palet Durumu</span>
                          <span className="text-[10px] text-zinc-400 font-mono">%{activePalletList[0].efficiency} Doluluk</span>
                        </div>

                        {/* Pallet Height Gauge Banner */}
                        <div className="p-2 bg-amber-950/30 rounded-lg border border-amber-500/30 flex items-center justify-between text-xs font-mono">
                          <span className="text-zinc-300 font-bold flex items-center gap-1">
                            <ArrowUp size={13} className="text-amber-400 shrink-0" />
                            <span>Yükseklik:</span>
                          </span>
                          <span className="text-amber-300 font-bold">
                            {Math.round(activePalletList[0].maxPackedHeight * 10)} mm
                            <span className="text-[10px] text-zinc-400 font-normal ml-1">/ {Math.round(pallet.height * 10)} mm</span>
                          </span>
                        </div>

                        <div className="p-2 bg-zinc-950/80 rounded-lg border border-zinc-800/80 text-[10px] font-mono space-y-0.5 text-zinc-300">
                          <div>Sol: <span className="text-white font-bold">{activePalletList[0].margins.left}mm</span> | Sağ: <span className="text-white font-bold">{activePalletList[0].margins.right}mm</span></div>
                          <div>Ön: <span className="text-white font-bold">{activePalletList[0].margins.front}mm</span> | Arka: <span className="text-white font-bold">{activePalletList[0].margins.back}mm</span></div>
                          <div className="pt-1 text-zinc-400 border-t border-zinc-900 flex items-center justify-between">
                            <span>CoG: <strong className="text-emerald-400">{activePalletList[0].centerOfGravity.status}</strong> (%{activePalletList[0].centerOfGravity.deviationPercent})</span>
                            <span>Brüt: <strong className="text-white">{activePalletList[0].actualWeight} kg</strong></span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        />
      </main>

      {/* 
        ========================================================================
        MODAL: Quick Add Box (Catalog Search + Custom Dimension)
        ========================================================================
      */}
      {isAddBoxModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <BoxIcon size={16} />
                </div>
                <h3 className="text-sm font-bold text-white">Yeni Koli Tipi Ekle</h3>
              </div>
              <button
                onClick={() => setIsAddBoxModalOpen(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/50 p-1">
              <button
                onClick={() => setAddBoxTab('catalog')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  addBoxTab === 'catalog'
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Database size={13} className="text-emerald-400" />
                <span>Katalogdan Seç ({masterCatalog.length})</span>
              </button>
              <button
                onClick={() => setAddBoxTab('custom')}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                  addBoxTab === 'custom'
                    ? 'bg-zinc-800 text-white shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <Plus size={13} className="text-blue-400" />
                <span>Özel Ölçü Belirle</span>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {addBoxTab === 'catalog' ? (
                <>
                  {/* Search Bar */}
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Malzeme kodu, adı veya kategori ara..."
                      value={catSearchTerm}
                      onChange={(e) => setCatSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  {/* Catalog Item Grid */}
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {filteredCatalog.map((item) => {
                      const isSel = (selectedCatalogItem?.id === item.id);
                      return (
                        <div
                          key={item.id}
                          onClick={() => setSelectedCatId(item.id)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                            isSel
                              ? 'bg-blue-950/40 border-blue-500 ring-1 ring-blue-500'
                              : 'bg-zinc-950/70 border-zinc-800 hover:border-zinc-700'
                          }`}
                        >
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white truncate">{item.materialCode}</span>
                              <span className="text-[10px] text-zinc-400 truncate">{item.materialName}</span>
                            </div>
                            <div className="text-[10px] text-zinc-400 font-mono mt-0.5">
                              {Math.round(item.width * 10)}×{Math.round(item.depth * 10)}×{Math.round(item.height * 10)} mm • {item.weight} kg
                            </div>
                          </div>
                          <span className="text-[10px] font-mono px-2 py-0.5 bg-zinc-800 text-amber-400 font-bold rounded shrink-0">
                            {item.innerQuantity} Adet/Koli
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Calculation Mode: Box Count vs Piece Count */}
                  {selectedCatalogItem && (
                    <div className="bg-zinc-950 p-3 rounded-xl border border-zinc-800/80 space-y-3">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-zinc-300">Giriş Türü:</span>
                        <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                          <button
                            type="button"
                            onClick={() => setCatAddMode('box')}
                            className={`px-2.5 py-1 text-[11px] rounded font-bold transition-colors ${
                              catAddMode === 'box' ? 'bg-blue-600 text-white' : 'text-zinc-400'
                            }`}
                          >
                            Koli Olarak
                          </button>
                          <button
                            type="button"
                            onClick={() => setCatAddMode('piece')}
                            className={`px-2.5 py-1 text-[11px] rounded font-bold transition-colors ${
                              catAddMode === 'piece' ? 'bg-emerald-600 text-white' : 'text-zinc-400'
                            }`}
                          >
                            Ürün / Adet Olarak
                          </button>
                        </div>
                      </div>

                      {catAddMode === 'box' ? (
                        <div className="flex items-center justify-between">
                          <label className="text-xs text-zinc-400">Eklenecek Koli Sayısı:</label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={catBoxQty}
                            onChange={(e) => setCatBoxQty(parseInt(e.target.value) || 1)}
                            className="w-24 px-2.5 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-right text-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-xs text-zinc-400 block">Eklenecek Toplam Ürün Adedi:</label>
                            <span className="text-[10px] text-zinc-500">
                              (1 koli = {selectedCatalogItem.innerQuantity} adet)
                            </span>
                          </div>
                          <input
                            type="number"
                            min="1"
                            max="50000"
                            value={catPieceQty}
                            onChange={(e) => setCatPieceQty(parseInt(e.target.value) || 1)}
                            className="w-24 px-2.5 py-1 bg-zinc-900 border border-zinc-700 rounded-lg text-xs font-bold text-right text-emerald-400 focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                      )}

                      {/* Summary breakdown banner */}
                      <div className="p-2.5 bg-zinc-900/90 rounded-lg border border-zinc-800 text-[11px] flex items-center justify-between">
                        <span className="text-zinc-400">Hesaplanan Koli:</span>
                        <span className="font-mono font-bold text-emerald-400 text-xs">
                          {calculatedAddStats.totalBoxes} Koli ({calculatedAddStats.pieces} adet, {calculatedAddStats.totalWeight} kg)
                        </span>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Custom Box Input Form */
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Koli Adı / Tanımı</label>
                    <input
                      type="text"
                      placeholder="Örn: Yedek Parça Kolisi D"
                      value={customBoxName}
                      onChange={(e) => setCustomBoxName(e.target.value)}
                      className="w-full px-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Genişlik (mm)</label>
                      <input
                        type="number"
                        value={customWidthMm}
                        onChange={(e) => setCustomWidthMm(parseInt(e.target.value) || 100)}
                        className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Derinlik (mm)</label>
                      <input
                        type="number"
                        value={customDepthMm}
                        onChange={(e) => setCustomDepthMm(parseInt(e.target.value) || 100)}
                        className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Yükseklik (mm)</label>
                      <input
                        type="number"
                        value={customHeightMm}
                        onChange={(e) => setCustomHeightMm(parseInt(e.target.value) || 100)}
                        className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Ağırlık (kg)</label>
                      <input
                        type="number"
                        value={customWeight}
                        onChange={(e) => setCustomWeight(parseFloat(e.target.value) || 1)}
                        className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Koli Adedi</label>
                      <input
                        type="number"
                        value={customQty}
                        onChange={(e) => setCustomQty(parseInt(e.target.value) || 1)}
                        className="w-full px-2.5 py-1 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Color Selector */}
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1.5 flex items-center gap-1">
                      <Palette size={12} /> Koli Rengi
                    </label>
                    <div className="flex items-center gap-2">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setCustomColor(c)}
                          className={`w-6 h-6 rounded-full transition-transform ${
                            customColor === c ? 'scale-125 ring-2 ring-white ring-offset-2 ring-offset-zinc-900' : 'opacity-80 hover:opacity-100'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-zinc-800 flex items-center justify-end gap-2 bg-zinc-950/60">
              <button
                type="button"
                onClick={() => setIsAddBoxModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={addBoxTab === 'catalog' ? handleConfirmAddFromCatalog : handleConfirmAddCustom}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors shadow-sm"
              >
                + Koli Tipini Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Catalog Manager Modal */}
      <CatalogManagerModal
        isOpen={isCatalogManagerOpen}
        onClose={() => setIsCatalogManagerOpen(false)}
        catalog={masterCatalog}
        onSaveCatalog={(newCatalog) => setMasterCatalog(newCatalog)}
        onAddBoxToPallet={(item, qty) => {
          const color = PRESET_COLORS[boxes.length % PRESET_COLORS.length];
          const newBox: Box = {
            id: `box-cat-${Date.now()}`,
            name: `${item.materialCode} - ${item.materialName}`,
            materialCode: item.materialCode,
            materialName: item.materialName,
            innerQuantity: item.innerQuantity,
            width: item.width,
            depth: item.depth,
            height: item.height,
            weight: item.weight,
            quantity: Math.max(1, qty),
            color,
            allowRotateY: true,
            allowRotateX: false,
            allowRotateZ: false,
            stackable: true,
            mustBeBottom: (item.weight || 0) > 20
          };
          setBoxes(prev => [...prev, newBox]);
          setIsCatalogManagerOpen(false);
        }}
        onOpenImportModal={() => {
          setIsCatalogManagerOpen(false);
          setIsImportOpen(true);
        }}
      />

      {/* Import Modal */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        currentBoxCount={boxes.length}
        initialDestination="both"
        onImport={(importedBoxes, mode) => {
          if (mode === 'replace') {
            setBoxes(importedBoxes);
            setManualPackedBoxes([]);
          } else {
            setBoxes(prev => [...prev, ...importedBoxes]);
          }
          setIsImportOpen(false);
        }}
        onSaveToCatalog={(importedCatalog) => {
          setMasterCatalog(prev => {
            const map = new Map<string, ProductCatalogItem>();
            prev.forEach(item => map.set(item.materialCode.toUpperCase().trim(), item));
            importedCatalog.forEach(item => map.set(item.materialCode.toUpperCase().trim(), item));
            return Array.from(map.values());
          });
          setIsImportOpen(false);
        }}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        result={virtualPackingResult}
      />
    </div>
  );
}
