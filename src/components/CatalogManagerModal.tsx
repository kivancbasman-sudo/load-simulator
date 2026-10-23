import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { ProductCatalogItem } from '../types';
import {
  Database,
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  Upload,
  Check,
  X,
  FileSpreadsheet,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Package,
  ArrowRight
} from 'lucide-react';

interface CatalogManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalog: ProductCatalogItem[];
  onSaveCatalog: (items: ProductCatalogItem[]) => void;
  onAddBoxToPallet: (item: ProductCatalogItem, quantity: number) => void;
  onOpenImportModal: () => void;
}

export const CatalogManagerModal: React.FC<CatalogManagerModalProps> = ({
  isOpen,
  onClose,
  catalog,
  onSaveCatalog,
  onAddBoxToPallet,
  onOpenImportModal
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<ProductCatalogItem>>({});
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<Partial<ProductCatalogItem>>({
    materialCode: '',
    materialName: '',
    innerQuantity: 12,
    width: 40,
    depth: 30,
    height: 25,
    weight: 8
  });
  const [quickAddQty, setQuickAddQty] = useState<{ [id: string]: number }>({});

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return catalog;
    return catalog.filter(
      item =>
        item.materialCode.toLowerCase().includes(q) ||
        item.materialName.toLowerCase().includes(q) ||
        (item.category && item.category.toLowerCase().includes(q))
    );
  }, [catalog, searchQuery]);

  if (!isOpen) return null;

  const handleStartEdit = (item: ProductCatalogItem) => {
    setEditingId(item.id);
    setEditForm({
      materialCode: item.materialCode,
      materialName: item.materialName,
      innerQuantity: item.innerQuantity,
      width: Math.round(item.width * 10), // displayed in mm
      depth: Math.round(item.depth * 10),
      height: Math.round(item.height * 10),
      weight: item.weight
    });
  };

  const handleSaveEdit = (id: string) => {
    if (!editForm.materialCode || !editForm.materialName) return;
    const updated = catalog.map(item => {
      if (item.id !== id) return item;
      return {
        ...item,
        materialCode: editForm.materialCode || item.materialCode,
        materialName: editForm.materialName || item.materialName,
        innerQuantity: Math.max(1, editForm.innerQuantity || 1),
        width: Math.max(1, (editForm.width || 400) / 10), // convert mm to cm
        depth: Math.max(1, (editForm.depth || 300) / 10),
        height: Math.max(1, (editForm.height || 250) / 10),
        weight: Math.max(0.1, editForm.weight || 1)
      };
    });
    onSaveCatalog(updated);
    setEditingId(null);
    setEditForm({});
  };

  const handleDeleteItem = (id: string) => {
    onSaveCatalog(catalog.filter(i => i.id !== id));
  };

  const handleSaveNewItem = () => {
    if (!newForm.materialCode || !newForm.materialName) return;
    const newItem: ProductCatalogItem = {
      id: `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      materialCode: newForm.materialCode.trim(),
      materialName: newForm.materialName.trim(),
      innerQuantity: Math.max(1, newForm.innerQuantity || 1),
      width: Math.max(1, (newForm.width || 400) / 10),
      depth: Math.max(1, (newForm.depth || 300) / 10),
      height: Math.max(1, (newForm.height || 250) / 10),
      weight: Math.max(0.1, newForm.weight || 1)
    };

    onSaveCatalog([newItem, ...catalog]);
    setIsAddingNew(false);
    setNewForm({
      materialCode: '',
      materialName: '',
      innerQuantity: 12,
      width: 400,
      depth: 300,
      height: 250,
      weight: 8
    });
  };

  const handleExportCatalog = () => {
    const data = [
      ['malzeme kodu', 'malzeme adı', 'koli içi adet', 'en (mm)', 'boy (mm)', 'yükseklik (mm)', 'ağırlık (kg)'],
      ...catalog.map(item => [
        item.materialCode,
        item.materialName,
        item.innerQuantity,
        Math.round(item.width * 10),
        Math.round(item.depth * 10),
        Math.round(item.height * 10),
        item.weight
      ])
    ];

    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'AnaUrunKatalogu');
    XLSX.writeFile(wb, `Ana_Urun_Katalogu_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-5xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-inner">
              <Database size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Ana Ürün Kataloğu (Base Ürün Listesi)</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  {catalog.length} Kayıtlı Ürün
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Bu liste tarayıcınızda kalıcı saklanır. Koli eklerken listeden <strong>tek tıkla</strong> tüm ölçü ve bilgiler otomatik gelir.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenImportModal}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Excel veya CSV dosyasından ürünleri içe aktar"
            >
              <Upload size={13} /> Excel'den İçe Aktar
            </button>
            <button
              onClick={handleExportCatalog}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Kataloğu Excel olarak indir"
            >
              <Download size={13} /> Excel İndir
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search & Add new */}
        <div className="px-6 py-3 bg-zinc-950/70 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="relative flex-1 max-w-md">
            <Search size={14} className="absolute left-3 top-2.5 text-zinc-500" />
            <input
              type="text"
              placeholder="Malzeme kodu veya ürün adı ile ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-100 placeholder-zinc-500 focus:border-blue-500 outline-none"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAddingNew(!isAddingNew)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                isAddingNew
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
              }`}
            >
              <Plus size={13} /> {isAddingNew ? 'Vazgeç' : 'Manuel Yeni Ürün Ekle'}
            </button>
          </div>
        </div>

        {/* Manual New Item Form Row */}
        {isAddingNew && (
          <div className="p-4 bg-zinc-850 border-b border-zinc-700 space-y-3 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-400">
              <span className="flex items-center gap-1.5">
                <Plus size={14} /> Yeni Ürün Kartı Tanımla
              </span>
              <span className="text-[11px] text-zinc-400 font-normal">Ölçüler mm cinsindendir</span>
            </div>
            <div className="grid grid-cols-7 gap-2 text-xs">
              <div>
                <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Malzeme Kodu *</label>
                <input
                  type="text"
                  placeholder="MLZ-999"
                  value={newForm.materialCode || ''}
                  onChange={(e) => setNewForm({ ...newForm, materialCode: e.target.value })}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs font-mono text-blue-400 font-semibold outline-none focus:border-blue-500"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Malzeme Adı *</label>
                <input
                  type="text"
                  placeholder="Ürün Tanımı"
                  value={newForm.materialName || ''}
                  onChange={(e) => setNewForm({ ...newForm, materialName: e.target.value })}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Koli İçi Adet</label>
                <input
                  type="number"
                  min="1"
                  value={newForm.innerQuantity || 1}
                  onChange={(e) => setNewForm({ ...newForm, innerQuantity: parseInt(e.target.value, 10) || 1 })}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs font-mono text-emerald-400 font-bold outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 font-semibold mb-1">En×Boy×Yük (mm)</label>
                <div className="grid grid-cols-3 gap-1">
                  <input
                    type="number"
                    placeholder="En"
                    value={newForm.width || ''}
                    onChange={(e) => setNewForm({ ...newForm, width: parseFloat(e.target.value) || 0 })}
                    className="w-full px-1 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-[11px] font-mono text-zinc-200 outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Boy"
                    value={newForm.depth || ''}
                    onChange={(e) => setNewForm({ ...newForm, depth: parseFloat(e.target.value) || 0 })}
                    className="w-full px-1 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-[11px] font-mono text-zinc-200 outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Yük"
                    value={newForm.height || ''}
                    onChange={(e) => setNewForm({ ...newForm, height: parseFloat(e.target.value) || 0 })}
                    className="w-full px-1 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-[11px] font-mono text-zinc-200 outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-zinc-400 font-semibold mb-1">Ağırlık (kg)</label>
                <input
                  type="number"
                  step="0.1"
                  value={newForm.weight || 0}
                  onChange={(e) => setNewForm({ ...newForm, weight: parseFloat(e.target.value) || 0 })}
                  className="w-full px-2 py-1.5 bg-zinc-900 border border-zinc-700 rounded text-xs font-mono text-amber-300 outline-none"
                />
              </div>
              <div className="flex items-end gap-1">
                <button
                  onClick={handleSaveNewItem}
                  disabled={!newForm.materialCode || !newForm.materialName}
                  className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white rounded font-bold text-xs flex items-center justify-center gap-1 transition-colors"
                >
                  <Check size={13} /> Kaydet
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Catalog Table */}
        <div className="p-6 overflow-y-auto flex-1">
          {filteredCatalog.length === 0 ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-zinc-800 text-zinc-500 flex items-center justify-center">
                <Database size={24} />
              </div>
              <h3 className="text-sm font-bold text-zinc-300">Katalogda Eşleşen Ürün Bulunamadı</h3>
              <p className="text-xs text-zinc-500 max-w-sm mx-auto">
                {searchQuery
                  ? 'Arama kriterinize uygun ürün bulunamadı. Aramayı temizleyin veya yeni ürün ekleyin.'
                  : 'Katalog şu an boş. Excel / CSV dosyanızı yükleyerek ürünleri toplu aktarabilirsiniz.'}
              </p>
              <button
                onClick={onOpenImportModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Upload size={14} /> Excel'den Ürün Listesi İçe Aktar
              </button>
            </div>
          ) : (
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/70">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-zinc-900/90 sticky top-0 z-10 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                  <tr>
                    <th className="p-3">Malzeme Kodu</th>
                    <th className="p-3">Malzeme Adı</th>
                    <th className="p-3 text-right">Koli İçi Adet</th>
                    <th className="p-3 text-right">En (mm)</th>
                    <th className="p-3 text-right">Boy (mm)</th>
                    <th className="p-3 text-right">Yükseklik (mm)</th>
                    <th className="p-3 text-right">Ağırlık (kg)</th>
                    <th className="p-3 text-center">Tek Tıkla Palete Ekle</th>
                    <th className="p-3 text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/70">
                  {filteredCatalog.map((item) => {
                    const isEditing = editingId === item.id;
                    const addQty = quickAddQty[item.id] || 10;

                    if (isEditing) {
                      return (
                        <tr key={item.id} className="bg-blue-950/30">
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={editForm.materialCode || ''}
                              onChange={(e) => setEditForm({ ...editForm, materialCode: e.target.value })}
                              className="w-24 px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded font-mono text-blue-400 text-xs font-bold outline-none"
                            />
                          </td>
                          <td className="p-2.5">
                            <input
                              type="text"
                              value={editForm.materialName || ''}
                              onChange={(e) => setEditForm({ ...editForm, materialName: e.target.value })}
                              className="w-48 px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded text-white text-xs outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              min="1"
                              value={editForm.innerQuantity || 1}
                              onChange={(e) => setEditForm({ ...editForm, innerQuantity: parseInt(e.target.value, 10) || 1 })}
                              className="w-16 px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded text-right font-mono text-emerald-400 text-xs font-bold outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              value={editForm.width || ''}
                              onChange={(e) => setEditForm({ ...editForm, width: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded text-right font-mono text-zinc-200 text-xs outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              value={editForm.depth || ''}
                              onChange={(e) => setEditForm({ ...editForm, depth: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded text-right font-mono text-zinc-200 text-xs outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              value={editForm.height || ''}
                              onChange={(e) => setEditForm({ ...editForm, height: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded text-right font-mono text-zinc-200 text-xs outline-none"
                            />
                          </td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              step="0.1"
                              value={editForm.weight || ''}
                              onChange={(e) => setEditForm({ ...editForm, weight: parseFloat(e.target.value) || 0 })}
                              className="w-16 px-1.5 py-1 bg-zinc-900 border border-zinc-700 rounded text-right font-mono text-amber-300 text-xs outline-none"
                            />
                          </td>
                          <td colSpan={2} className="p-2.5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleSaveEdit(item.id)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-semibold text-xs flex items-center gap-1"
                              >
                                <Check size={12} /> Kaydet
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded text-xs"
                              >
                                İptal
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return (
                      <tr key={item.id} className="hover:bg-zinc-850/60 transition-colors group">
                        <td className="p-3 font-mono font-bold text-blue-400">
                          <span className="px-1.5 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                            {item.materialCode}
                          </span>
                        </td>
                        <td className="p-3 text-white font-medium">
                          {item.materialName}
                        </td>
                        <td className="p-3 text-right font-mono text-emerald-400 font-bold">
                          {item.innerQuantity} ad/koli
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {Math.round(item.width * 10)}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {Math.round(item.depth * 10)}
                        </td>
                        <td className="p-3 text-right font-mono text-zinc-300">
                          {Math.round(item.height * 10)}
                        </td>
                        <td className="p-3 text-right font-mono text-amber-300 font-semibold">
                          {item.weight} kg
                        </td>
                        <td className="p-3 text-center">
                          <div className="inline-flex items-center gap-1.5 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
                            <input
                              type="number"
                              min="1"
                              value={addQty}
                              onChange={(e) =>
                                setQuickAddQty({
                                  ...quickAddQty,
                                  [item.id]: Math.max(1, parseInt(e.target.value, 10) || 1)
                                })
                              }
                              className="w-12 px-1 py-0.5 bg-zinc-950 border border-zinc-700 rounded text-center text-xs font-mono font-bold text-white outline-none"
                              title="Palete eklenecek koli adedi"
                            />
                            <button
                              onClick={() => {
                                onAddBoxToPallet(item, addQty);
                              }}
                              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs flex items-center gap-1 shadow-sm transition-all active:scale-95"
                              title="Bu ürünü belirtilen koli adediyle palete ekler"
                            >
                              <Plus size={12} /> Palete Ekle
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEdit(item)}
                              className="p-1.5 text-zinc-400 hover:text-white rounded hover:bg-zinc-800 transition-colors"
                              title="Ürünü Düzenle"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteItem(item.id)}
                              className="p-1.5 text-zinc-400 hover:text-rose-400 rounded hover:bg-zinc-800 transition-colors"
                              title="Katalogdan Sil"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-400">
            <Package size={14} className="text-blue-400" />
            <span>
              Toplam <strong>{catalog.length}</strong> ürün ana veri tabanında kayıtlı.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl font-medium transition-colors"
            >
              Kapat
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
