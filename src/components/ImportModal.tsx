import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  Upload,
  FileSpreadsheet,
  Download,
  ClipboardPaste,
  Check,
  AlertTriangle,
  X,
  Plus,
  RefreshCw,
  Sparkles,
  Info,
  Layers,
  Package,
  Database
} from 'lucide-react';
import { Box, ProductCatalogItem } from '../types';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (boxes: Box[], mode: 'replace' | 'append') => void;
  onSaveToCatalog?: (items: ProductCatalogItem[]) => void;
  currentBoxCount: number;
  initialDestination?: 'catalog_only' | 'pallet_only' | 'both';
}

export interface ParsedProductRow {
  id: string;
  materialCode: string;
  materialName: string;
  innerQuantity: number;
  width: number; // in user-selected unit
  depth: number;
  height: number;
  weight: number;
  boxQuantity: number;
  isValid: boolean;
  errorMessage?: string;
  selected: boolean;
}

const PALETTE_COLORS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#f97316', // Orange
  '#14b8a6', // Teal
  '#6366f1', // Indigo
  '#84cc16', // Lime
  '#e11d48', // Rose
  '#d97706', // Ochre
];

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  onSaveToCatalog,
  currentBoxCount,
  initialDestination = 'both'
}) => {
  const [activeTab, setActiveTab] = useState<'upload' | 'paste' | 'template'>('upload');
  const [targetDestination, setTargetDestination] = useState<'catalog_only' | 'pallet_only' | 'both'>(initialDestination);
  const [unit, setUnit] = useState<'mm' | 'cm'>('mm');
  const [pasteText, setPasteText] = useState('');
  const [parsedRows, setParsedRows] = useState<ParsedProductRow[]>([]);
  const [importMode, setImportMode] = useState<'replace' | 'append'>('append');
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (isOpen) {
      setTargetDestination(initialDestination);
    }
  }, [isOpen, initialDestination]);

  if (!isOpen) return null;

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Flexible column mapper
  const normalizeKey = (key: string): string => {
    return String(key || '')
      .toLowerCase()
      .trim()
      .replace(/[\s_\-\.\(\)\[\]\/\\:]/g, '')
      .replace(/ı/g, 'i')
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c');
  };

  const isWidthColumn = (col: string, raw: string): boolean => {
    const stripped = col.replace(/(mm|cm|m|metre|santim|milim)$/g, '');
    if (stripped === 'en' || stripped === 'eni' || stripped === 'kolieni' || stripped === 'uruneni') return true;
    if (col === 'en' || col === 'eni' || col === 'kolieni' || col === 'uruneni') return true;
    if (col.startsWith('kolieni') || col.startsWith('uruneni')) return true;
    if (/^en(mm|cm|m|metre|santim|milim)?$/i.test(col)) return true;
    if (col.includes('genislik')) return true;
    if (stripped === 'w' || stripped === 'width' || col === 'w' || col.includes('width')) return true;
    if (/\b(en|eni|geni[sş]lik|width|w)\b/i.test(raw)) return true;
    return false;
  };

  const isDepthColumn = (col: string, raw: string): boolean => {
    const stripped = col.replace(/(mm|cm|m|metre|santim|milim)$/g, '');
    if (stripped === 'boy' || stripped === 'boyu' || stripped === 'koliboyu' || stripped === 'urunboyu') return true;
    if (col === 'boy' || col === 'boyu' || col === 'koliboyu' || col === 'urunboyu') return true;
    if (col.startsWith('koliboyu') || col.startsWith('urunboyu')) return true;
    if (/^boy(mm|cm|m|metre|santim|milim)?$/i.test(col)) return true;
    if (col.includes('uzunluk') || col.includes('derinlik')) return true;
    if (stripped === 'l' || stripped === 'd' || stripped === 'length' || stripped === 'depth') return true;
    if (col === 'l' || col === 'd' || col.includes('length') || col.includes('depth')) return true;
    if (/\b(boy|boyu|uzunluk|derinlik|length|depth)\b/i.test(raw)) return true;
    return false;
  };

  const isHeightColumn = (col: string, raw: string): boolean => {
    const stripped = col.replace(/(mm|cm|m|metre|santim|milim)$/g, '');
    if (stripped === 'yukseklik' || stripped === 'koliyuksekligi' || stripped === 'urunyuksekligi') return true;
    if (col.includes('yukseklik') || col.includes('height')) return true;
    if (stripped === 'h' || stripped === 'y' || col === 'h' || col === 'y') return true;
    if (/^(yukseklik|height|h|y)(mm|cm|m|metre|santim|milim)?$/i.test(col)) return true;
    if (/\b(y[uü]kseklik|height|h)\b/i.test(raw)) return true;
    return false;
  };

  const isWeightColumn = (col: string, raw: string): boolean => {
    const stripped = col.replace(/(kg|gr|gram|kilo)$/g, '');
    if (stripped === 'agirlik' || stripped === 'koliagirligi' || stripped === 'brutagirlik' || stripped === 'netagirlik') return true;
    if (col.includes('agirlik') || col.includes('kilo') || col.includes('weight')) return true;
    if (col === 'kg' || col === 'gr' || stripped === 'kg') return true;
    if (/\b(a[gğ][iı]rl[iı]k|kilo|weight|kg)\b/i.test(raw)) return true;
    return false;
  };

  const isInnerQtyColumn = (col: string, raw: string): boolean => {
    if (col.includes('ici') || col.includes('icadet') || col.includes('koliic') || col.includes('paketici') || col.includes('kutuic')) return true;
    if (col.includes('inner') || col.includes('adetkoli') || (col.includes('koliadet') && col.includes('ic'))) return true;
    if (/\b(i[cç]i?|inner|pack|paket)\b/i.test(raw) && /\b(adet|qty|quantity|count|say[iı]s[iı])\b/i.test(raw)) return true;
    if ((raw.includes('içi') || raw.includes('ici') || raw.includes('iç') || raw.includes('ic')) && (raw.includes('adet') || raw.includes('qty') || raw.includes('miktar'))) return true;
    return false;
  };

  const isBoxQtyColumn = (col: string, raw: string): boolean => {
    if (isInnerQtyColumn(col, raw)) return false;
    if (col.includes('koliadedi') || col.includes('koliadeti') || col.includes('koliadet') || col.includes('kolisayi') || col.includes('kolisayisi')) return true;
    if (col.includes('siparis') || col.includes('toplamkoli') || col.includes('boxqty') || col.includes('carton') || col.includes('paletkoli')) return true;
    if (col === 'adet' || col === 'miktar' || col === 'koli' || col === 'qty' || col === 'quantity') return true;
    if (/\b(koli\s*adedi|koli\s*say[iı]s[iı]|sipari[sş]|koli|adet|miktar|qty|quantity)\b/i.test(raw)) return true;
    return false;
  };

  const isCodeColumn = (col: string, raw: string): boolean => {
    if (col.includes('kod') || col.includes('sku') || col.includes('code')) return true;
    if (col.includes('parcano') || col.includes('partno') || col.includes('stokno') || col.includes('malzemeno') || col.includes('urunno')) return true;
    if (/\b(kod|kodu|code|sku|part\s*no|par[cç]a\s*no|stok\s*kodu|malzeme\s*kodu)\b/i.test(raw)) return true;
    return false;
  };

  const isNameColumn = (col: string, raw: string): boolean => {
    if (isCodeColumn(col, raw) || isInnerQtyColumn(col, raw) || isBoxQtyColumn(col, raw)) return false;
    if (col.includes('tanim') || col.includes('aciklama') || col.includes('isim') || col.includes('desc') || col.includes('name')) return true;
    if (col === 'malzemeadi' || col === 'urunadi' || col === 'stokadi' || col === 'adi' || col === 'ad') return true;
    if (col.endsWith('adi') || col.endsWith('name')) return true;
    if (/\b(ad[iı]?|isim|tan[iı]m[iı]?|a[cç][iı]klama|name|description)\b/i.test(raw)) return true;
    return false;
  };

  const cleanNum = (val: any, fallback = 0): number => {
    if (val === null || val === undefined) return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    let str = String(val).trim().replace(/\s/g, '');
    if (!str) return fallback;
    // Handle European vs US number formatting
    if (/\d+\.\d{3},\d+/.test(str)) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else if (/\d+,\d{3}\.\d+/.test(str)) {
      str = str.replace(/,/g, '');
    } else if (str.includes(',') && !str.includes('.')) {
      str = str.replace(',', '.');
    }
    const match = str.match(/[-+]?[0-9]*\.?[0-9]+/);
    if (!match) return fallback;
    const num = parseFloat(match[0]);
    return isNaN(num) ? fallback : num;
  };

  const parseRawData = (rows: any[][]) => {
    if (!rows || rows.length === 0) {
      showToast('Yüklenecek veri bulunamadı.', 'error');
      return;
    }

    // Filter out completely empty rows
    const nonEmptyRows = rows.filter(r => r && r.some((cell: any) => cell !== null && cell !== undefined && String(cell).trim() !== ''));
    if (nonEmptyRows.length === 0) {
      showToast('Dosya veya yapıştırılan metin boş görünüyor.', 'error');
      return;
    }

    // Search top 5 rows to detect the best header row
    let bestHeaderRowIdx = -1;
    let maxHeaderScore = 0;
    let detectedHeaderIndices = {
      code: -1,
      name: -1,
      innerQty: -1,
      width: -1,
      depth: -1,
      height: -1,
      weight: -1,
      boxQty: -1
    };

    const maxRowsToSearch = Math.min(5, nonEmptyRows.length);
    for (let r = 0; r < maxRowsToSearch; r++) {
      const row = nonEmptyRows[r];
      const indices = {
        code: -1,
        name: -1,
        innerQty: -1,
        width: -1,
        depth: -1,
        height: -1,
        weight: -1,
        boxQty: -1
      };

      row.forEach((cell: any, idx: number) => {
        const raw = String(cell || '').trim();
        const col = normalizeKey(raw);
        if (!col) return;

        if (indices.code === -1 && isCodeColumn(col, raw)) {
          indices.code = idx;
        } else if (indices.innerQty === -1 && isInnerQtyColumn(col, raw)) {
          indices.innerQty = idx;
        } else if (indices.width === -1 && isWidthColumn(col, raw)) {
          indices.width = idx;
        } else if (indices.depth === -1 && isDepthColumn(col, raw)) {
          indices.depth = idx;
        } else if (indices.height === -1 && isHeightColumn(col, raw)) {
          indices.height = idx;
        } else if (indices.weight === -1 && isWeightColumn(col, raw)) {
          indices.weight = idx;
        } else if (indices.boxQty === -1 && isBoxQtyColumn(col, raw)) {
          indices.boxQty = idx;
        } else if (indices.name === -1 && isNameColumn(col, raw)) {
          indices.name = idx;
        }
      });

      let score = 0;
      if (indices.code !== -1) score++;
      if (indices.name !== -1) score++;
      if (indices.innerQty !== -1) score++;
      if (indices.width !== -1) score++;
      if (indices.depth !== -1) score++;
      if (indices.height !== -1) score++;
      if (indices.weight !== -1) score++;
      if (indices.boxQty !== -1) score++;

      if (score > maxHeaderScore) {
        maxHeaderScore = score;
        bestHeaderRowIdx = r;
        detectedHeaderIndices = indices;
      }
    }

    let headerIndices = detectedHeaderIndices;
    let dataRows: any[][];

    if (maxHeaderScore >= 2) {
      dataRows = nonEmptyRows.slice(bestHeaderRowIdx + 1);

      // Check if header row mentions units
      const headerRowStr = nonEmptyRows[bestHeaderRowIdx].map(c => String(c || '').toLowerCase()).join(' ');
      if (headerRowStr.includes('(cm)') || headerRowStr.includes('[cm]') || headerRowStr.includes(' cm ') || headerRowStr.endsWith(' cm') || headerRowStr.includes('santim')) {
        setUnit('cm');
      } else if (headerRowStr.includes('(mm)') || headerRowStr.includes('[mm]') || headerRowStr.includes(' mm ') || headerRowStr.endsWith(' mm') || headerRowStr.includes('milim')) {
        setUnit('mm');
      }
    } else {
      // Default standard order specified in user prompt:
      // 0: malzeme kodu, 1: malzeme adı, 2: koli içi adet, 3: en, 4: boy, 5: yükseklik, 6: ağırlık, 7 (opsiyonel): koli adedi
      headerIndices = {
        code: 0,
        name: 1,
        innerQty: 2,
        width: 3,
        depth: 4,
        height: 5,
        weight: 6,
        boxQty: 7
      };
      dataRows = nonEmptyRows;
    }

    const parsed: ParsedProductRow[] = [];

    dataRows.forEach((row, i) => {
      const code = headerIndices.code !== -1 && row[headerIndices.code] !== undefined ? String(row[headerIndices.code]).trim() : `MLZ-${String(i + 1).padStart(3, '0')}`;
      const name = headerIndices.name !== -1 && row[headerIndices.name] !== undefined ? String(row[headerIndices.name]).trim() : (code ? `${code} Koli` : `Ürün ${i + 1}`);
      const innerQty = headerIndices.innerQty !== -1 && row[headerIndices.innerQty] !== undefined ? Math.max(1, Math.round(cleanNum(row[headerIndices.innerQty], 1))) : 1;
      
      let width = headerIndices.width !== -1 && row[headerIndices.width] !== undefined ? cleanNum(row[headerIndices.width], 0) : 0;
      let depth = headerIndices.depth !== -1 && row[headerIndices.depth] !== undefined ? cleanNum(row[headerIndices.depth], 0) : 0;
      let height = headerIndices.height !== -1 && row[headerIndices.height] !== undefined ? cleanNum(row[headerIndices.height], 0) : 0;
      const weight = headerIndices.weight !== -1 && row[headerIndices.weight] !== undefined ? cleanNum(row[headerIndices.weight], 0) : 0;
      const boxQty = headerIndices.boxQty !== -1 && row[headerIndices.boxQty] !== undefined ? Math.max(1, Math.round(cleanNum(row[headerIndices.boxQty], 10))) : 10;

      // Fallback for combined dimensions if separate columns were empty (e.g., "400x300x250")
      if (width === 0 || depth === 0 || height === 0) {
        for (const cell of row) {
          const dimMatch = String(cell || '').match(/(\d+(?:[.,]\d+)?)\s*[xX*×]\s*(\d+(?:[.,]\d+)?)\s*[xX*×]\s*(\d+(?:[.,]\d+)?)/);
          if (dimMatch) {
            width = cleanNum(dimMatch[1], width);
            depth = cleanNum(dimMatch[2], depth);
            height = cleanNum(dimMatch[3], height);
            break;
          }
        }
      }

      const isValid = width > 0 && depth > 0 && height > 0;
      let errorMessage: string | undefined;
      if (!isValid) {
        errorMessage = 'En, boy veya yükseklik sıfırdan büyük olmalıdır.';
      }

      parsed.push({
        id: `imported-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
        materialCode: code || `MLZ-${String(i + 1).padStart(3, '0')}`,
        materialName: name || `Ürün ${i + 1}`,
        innerQuantity: innerQty,
        width,
        depth,
        height,
        weight,
        boxQuantity: boxQty,
        isValid,
        errorMessage,
        selected: isValid
      });
    });

    if (parsed.length === 0) {
      showToast('İçe aktarılacak geçerli satır bulunamadı.', 'error');
      return;
    }

    // Auto-detect unit: If dimensions are large (> 80), likely in mm
    const maxDim = Math.max(...parsed.map(r => Math.max(r.width, r.depth, r.height)));
    if (maxDim > 80 && unit === 'cm') {
      setUnit('mm');
      showToast('Büyük ölçüler tespit edildi; ölçü birimi otomatik olarak milimetre (mm) seçildi.', 'info');
    }

    setParsedRows(parsed);
    showToast(`${parsed.length} ürün satırı başarıyla okundu.`, 'success');
  };

  const handleFileUpload = (file: File) => {
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawJson: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        parseRawData(rawJson);
      } catch (err) {
        showToast('Dosya okunurken bir hata oluştu. Lütfen dosya formatını kontrol edin.', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handlePasteProcess = () => {
    if (!pasteText.trim()) {
      showToast('Lütfen yapıştırılacak metin veya tablo verisi girin.', 'error');
      return;
    }

    const lines = pasteText.trim().split(/\r?\n/);
    const rows = lines.map(line => {
      // Check delimiter: tab, semicolon, or comma
      if (line.includes('\t')) return line.split('\t');
      if (line.includes(';')) return line.split(';');
      return line.split(',');
    });

    parseRawData(rows);
  };

  const handleLoadSampleData = () => {
    const sampleRows: any[][] = [
      ['malzeme kodu', 'malzeme adı', 'koli içi adet', 'en', 'boy', 'yükseklik', 'ağırlık', 'koli adedi'],
      ['MLZ-101', 'Otomotiv Filtre Takımı', 12, 400, 300, 250, 7.5, 24],
      ['MLZ-102', 'Elektrikli El Aletleri Çantası', 6, 450, 350, 300, 14.0, 16],
      ['MLZ-103', 'Hassas Sensör Modülü', 48, 300, 200, 180, 3.2, 36],
      ['MLZ-104', 'Hidrolik Bağlantı Elemanı', 24, 380, 280, 220, 18.5, 12],
      ['MLZ-105', 'Endüstriyel Conta Seti', 100, 250, 250, 150, 4.0, 20],
      ['MLZ-106', 'Ağır Hizmet Rulman Grubu', 4, 500, 400, 350, 26.0, 8]
    ];

    setUnit('mm');
    setFileName('Örnek_Ürün_Listesi.xlsx');
    parseRawData(sampleRows);
  };

  const handleDownloadExcelTemplate = () => {
    const templateData = [
      ['malzeme kodu', 'malzeme adı', 'koli içi adet', 'en (mm)', 'boy (mm)', 'yükseklik (mm)', 'ağırlık (kg)', 'koli adedi'],
      ['PRD-001', 'Standart Ürün Kolisi A', 12, 400, 300, 250, 8.5, 20],
      ['PRD-002', 'Ağır Yedek Parça Kolisi B', 6, 500, 350, 300, 19.0, 12],
      ['PRD-003', 'Küçük Aksesuar Kutusu C', 36, 300, 200, 180, 4.0, 30]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'UrunListesi');
    XLSX.writeFile(wb, 'Palet_Urun_Import_Sablonu.xlsx');
    showToast('Excel şablonu indirildi.', 'success');
  };

  const handleDownloadCSVTemplate = () => {
    const csvContent =
      '\uFEFFmalzeme kodu;malzeme adı;koli içi adet;en (mm);boy (mm);yükseklik (mm);ağırlık (kg);koli adedi\n' +
      'PRD-001;Standart Ürün Kolisi A;12;400;300;250;8.5;20\n' +
      'PRD-002;Ağır Yedek Parça Kolisi B;6;500;350;300;19.0;12\n' +
      'PRD-003;Küçük Aksesuar Kutusu C;36;300;200;180;4.0;30\n';

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Palet_Urun_Import_Sablonu.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('CSV şablonu indirildi.', 'success');
  };

  const handleRowChange = (id: string, field: keyof ParsedProductRow, value: any) => {
    setParsedRows(prev =>
      prev.map(row => {
        if (row.id !== id) return row;
        const updated = { ...row, [field]: value };
        // recheck validity
        const isValid = updated.width > 0 && updated.depth > 0 && updated.height > 0;
        return {
          ...updated,
          isValid,
          errorMessage: isValid ? undefined : 'En, boy ve yükseklik 0\'dan büyük olmalıdır.'
        };
      })
    );
  };

  const handleToggleSelectAll = (select: boolean) => {
    setParsedRows(prev => prev.map(r => (r.isValid ? { ...r, selected: select } : r)));
  };

  const handleConfirmImport = () => {
    const selectedRows = parsedRows.filter(r => r.selected && r.isValid);
    if (selectedRows.length === 0) {
      showToast('Lütfen içe aktarılacak en az bir geçerli ürün seçin.', 'error');
      return;
    }

    const factor = unit === 'mm' ? 0.1 : 1.0;

    // 1. Save to Master Catalog if requested
    if ((targetDestination === 'catalog_only' || targetDestination === 'both') && onSaveToCatalog) {
      const catalogItems: ProductCatalogItem[] = selectedRows.map((row, idx) => ({
        id: `cat-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        materialCode: row.materialCode,
        materialName: row.materialName,
        innerQuantity: row.innerQuantity || 1,
        width: Math.round(row.width * factor * 10) / 10,
        depth: Math.round(row.depth * factor * 10) / 10,
        height: Math.round(row.height * factor * 10) / 10,
        weight: Math.round(row.weight * 10) / 10 || 5,
        category: 'İçe Aktarılan'
      }));
      onSaveToCatalog(catalogItems);
    }

    // 2. Add to pallet simulation if requested
    if (targetDestination === 'pallet_only' || targetDestination === 'both') {
      const newBoxes: Box[] = selectedRows.map((row, idx) => {
        const color = PALETTE_COLORS[idx % PALETTE_COLORS.length];
        const displayName = row.materialCode
          ? `${row.materialCode} - ${row.materialName}`
          : row.materialName;

        return {
          id: `box-imported-${Date.now()}-${idx}`,
          name: displayName,
          materialCode: row.materialCode,
          materialName: row.materialName,
          innerQuantity: row.innerQuantity || 1,
          width: Math.round(row.width * factor * 10) / 10,
          depth: Math.round(row.depth * factor * 10) / 10,
          height: Math.round(row.height * factor * 10) / 10,
          weight: Math.round(row.weight * 10) / 10 || 5,
          quantity: Math.max(1, row.boxQuantity || 1),
          color,
          allowRotateY: true,
          allowRotateX: false,
          allowRotateZ: false,
          stackable: true,
          mustBeBottom: (row.weight || 0) > 20
        };
      });

      onImport(newBoxes, importMode);
    }

    onClose();
  };

  const selectedCount = parsedRows.filter(r => r.selected && r.isValid).length;
  const totalBoxCount = parsedRows.filter(r => r.selected && r.isValid).reduce((sum, r) => sum + r.boxQuantity, 0);
  const totalItemCount = parsedRows.filter(r => r.selected && r.isValid).reduce((sum, r) => sum + (r.boxQuantity * (r.innerQuantity || 1)), 0);
  const totalWeight = parsedRows.filter(r => r.selected && r.isValid).reduce((sum, r) => sum + (r.boxQuantity * (r.weight || 0)), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-zinc-900 border border-zinc-700 w-full max-w-5xl max-h-[92vh] rounded-2xl flex flex-col shadow-2xl overflow-hidden text-zinc-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/95">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shadow-inner">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">Ürün Bilgisi İçe Aktar (Import)</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Excel / CSV / ERP
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                Kolonlar: <strong>Malzeme Kodu, Malzeme Adı, Koli İçi Adet, En, Boy, Yükseklik, Ağırlık</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSampleData}
              className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
              title="Örnek verilerle anında test edin"
            >
              <Sparkles size={13} /> Örnek Veri Yükle
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800 transition-colors ml-1"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Toast Notification */}
        {notification && (
          <div className={`px-6 py-2 text-xs flex items-center gap-2 ${
            notification.type === 'success' ? 'bg-emerald-950/80 text-emerald-300 border-b border-emerald-800/60' :
            notification.type === 'error' ? 'bg-rose-950/80 text-rose-300 border-b border-rose-800/60' :
            'bg-blue-950/80 text-blue-300 border-b border-blue-800/60'
          }`}>
            <Info size={14} className="shrink-0" />
            <span>{notification.message}</span>
          </div>
        )}

        {/* Navigation Tabs & Unit Settings */}
        <div className="px-6 py-3 bg-zinc-950/70 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1 bg-zinc-900 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'upload' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Upload size={13} /> Excel / CSV Yükle
            </button>
            <button
              onClick={() => setActiveTab('paste')}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'paste' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ClipboardPaste size={13} /> Kopyala / Yapıştır
            </button>
            <button
              onClick={() => setActiveTab('template')}
              className={`px-3 py-1.5 rounded-md font-semibold flex items-center gap-1.5 transition-all ${
                activeTab === 'template' ? 'bg-blue-600 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Download size={13} /> Şablon İndir
            </button>
          </div>

          {/* Unit Toggle & Auto Stack Detection */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-zinc-400 text-[11px] font-medium">Ölçü Birimi:</span>
              <div className="flex bg-zinc-900 p-0.5 rounded-lg border border-zinc-800">
                <button
                  onClick={() => setUnit('mm')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                    unit === 'mm' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Milimetre (Lojistikte standart, örn: 400 × 300 × 250 mm)"
                >
                  Milimetre (mm)
                </button>
                <button
                  onClick={() => setUnit('cm')}
                  className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                    unit === 'cm' ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                  title="Santimetre (örn: 40 × 30 × 25 cm)"
                >
                  Santimetre (cm)
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Contents: Upload / Paste / Templates */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'upload' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileUpload(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
                  : 'border-zinc-700 hover:border-zinc-500 bg-zinc-900/60 hover:bg-zinc-800/40'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv, .tsv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileUpload(e.target.files[0]);
                  }
                }}
              />
              <div className="w-14 h-14 mx-auto rounded-full bg-blue-600/15 text-blue-400 flex items-center justify-center mb-3">
                <Upload size={26} />
              </div>
              <h3 className="text-sm font-bold text-white mb-1">
                {fileName ? `Seçilen Dosya: ${fileName}` : 'Excel (.xlsx, .xls) veya CSV dosyanızı buraya sürükleyin'}
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mx-auto mb-3">
                veya bilgisayarınızdan dosya seçmek için tıklayın. Başlık satırında malzeme kodu, malzeme adı, koli içi adet, en, boy, yükseklik ve ağırlık aranır.
              </p>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-[11px] text-zinc-300">
                <span>Desteklenen:</span>
                <span className="font-mono text-blue-400 font-semibold">.XLSX</span>
                <span className="font-mono text-blue-400 font-semibold">.XLS</span>
                <span className="font-mono text-blue-400 font-semibold">.CSV</span>
                <span className="font-mono text-blue-400 font-semibold">.TSV</span>
              </div>
            </div>
          )}

          {activeTab === 'paste' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-300 font-medium">
                  Excel veya Google Sheets tablonuzdan kopyalayıp buraya yapıştırın:
                </span>
                <span className="text-zinc-500 text-[11px]">Tab veya noktalı virgül ile ayrılmış</span>
              </div>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="malzeme kodu	malzeme adı	koli içi adet	en	boy	yükseklik	ağırlık	koli adedi&#10;MLZ-001	Motor Yağı 4L	4	400	300	280	16.5	20&#10;MLZ-002	Hava Filtresi	12	350	250	200	4.2	15"
                rows={5}
                className="w-full p-3 bg-zinc-950 border border-zinc-700 rounded-xl text-xs font-mono text-zinc-200 placeholder-zinc-600 focus:border-blue-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setPasteText('')}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-xs"
                >
                  Temizle
                </button>
                <button
                  onClick={handlePasteProcess}
                  className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw size={13} /> Tabloyu Çözümle ve Önizle
                </button>
              </div>
            </div>
          )}

          {activeTab === 'template' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">Excel Şablonu (.xlsx)</h4>
                    <p className="text-xs text-zinc-400">Türkçe başlıklar ve örnek satırlar içeren hazır dosya</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  İçerisinde <strong>malzeme kodu, malzeme adı, koli içi adet, en, boy, yükseklik, ağırlık ve koli adedi</strong> sütunları hazır formattadır.
                </p>
                <button
                  onClick={handleDownloadExcelTemplate}
                  className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Download size={14} /> Excel Şablonunu İndir (.xlsx)
                </button>
              </div>

              <div className="p-5 bg-zinc-950/80 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white">CSV Şablonu (.csv)</h4>
                    <p className="text-xs text-zinc-400">UTF-8 BOM kodlamalı, Türkçe karakter destekli CSV</p>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  ERP veya WMS yazılımlarından çıktı almak veya toplu aktarım yapmak için noktalı virgüllü CSV şablonu.
                </p>
                <button
                  onClick={handleDownloadCSVTemplate}
                  className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs flex items-center justify-center gap-2 transition-colors"
                >
                  <Download size={14} /> CSV Şablonunu İndir (.csv)
                </button>
              </div>
            </div>
          )}

          {/* Preview Table Section */}
          {parsedRows.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Package size={14} className="text-blue-400" />
                    Çözümlenen Ürün Listesi ({parsedRows.length} Kalem)
                  </span>
                  <div className="flex items-center gap-1 text-[11px] text-zinc-400 ml-2">
                    <button
                      onClick={() => handleToggleSelectAll(true)}
                      className="hover:text-blue-400 underline underline-offset-2"
                    >
                      Tümünü Seç
                    </button>
                    <span>/</span>
                    <button
                      onClick={() => handleToggleSelectAll(false)}
                      className="hover:text-blue-400 underline underline-offset-2"
                    >
                      Kaldır
                    </button>
                  </div>
                </div>

                {/* Summary Badges */}
                <div className="flex items-center gap-3 text-xs font-mono">
                  <span className="text-zinc-400">
                    Seçili: <strong className="text-white">{selectedCount}</strong> kalem
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">
                    Toplam Koli: <strong className="text-blue-400">{totalBoxCount}</strong>
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">
                    Toplam Ürün: <strong className="text-emerald-400">{totalItemCount}</strong> adet
                  </span>
                  <span className="text-zinc-600">•</span>
                  <span className="text-zinc-400">
                    Ağırlık: <strong className="text-amber-400">{Math.round(totalWeight)}</strong> kg
                  </span>
                </div>
              </div>

              {/* Table */}
              <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/80 max-h-72 overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-zinc-900/90 sticky top-0 z-10 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
                    <tr>
                      <th className="p-2.5 w-8 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCount === parsedRows.length && parsedRows.length > 0}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                          className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0"
                        />
                      </th>
                      <th className="p-2.5">Malzeme Kodu</th>
                      <th className="p-2.5">Malzeme Adı</th>
                      <th className="p-2.5 text-right">Koli İçi Adet</th>
                      <th className="p-2.5 text-right">En ({unit})</th>
                      <th className="p-2.5 text-right">Boy ({unit})</th>
                      <th className="p-2.5 text-right">Yükseklik ({unit})</th>
                      <th className="p-2.5 text-right">Ağırlık (kg)</th>
                      <th className="p-2.5 text-right">Koli Adedi</th>
                      <th className="p-2.5 text-right">Toplam Adet</th>
                      <th className="p-2.5 text-center">Durum</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/70">
                    {parsedRows.map((row) => (
                      <tr
                        key={row.id}
                        className={`hover:bg-zinc-850/60 transition-colors ${
                          !row.isValid ? 'bg-rose-950/20' : row.selected ? 'bg-blue-950/15' : ''
                        }`}
                      >
                        <td className="p-2.5 text-center">
                          <input
                            type="checkbox"
                            disabled={!row.isValid}
                            checked={row.selected}
                            onChange={(e) => handleRowChange(row.id, 'selected', e.target.checked)}
                            className="rounded bg-zinc-800 border-zinc-700 text-blue-600 focus:ring-0 disabled:opacity-30"
                          />
                        </td>
                        <td className="p-2.5 font-mono font-semibold text-blue-400">
                          <input
                            type="text"
                            value={row.materialCode}
                            onChange={(e) => handleRowChange(row.id, 'materialCode', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-blue-500 outline-none w-24 px-1 text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-white font-medium">
                          <input
                            type="text"
                            value={row.materialName}
                            onChange={(e) => handleRowChange(row.id, 'materialName', e.target.value)}
                            className="bg-transparent border-b border-transparent hover:border-zinc-700 focus:border-blue-500 outline-none w-44 px-1 text-xs"
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          <input
                            type="number"
                            min="1"
                            value={row.innerQuantity}
                            onChange={(e) => handleRowChange(row.id, 'innerQuantity', parseInt(e.target.value, 10) || 1)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 w-16 text-right text-emerald-400 font-bold outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          <input
                            type="number"
                            value={row.width}
                            onChange={(e) => handleRowChange(row.id, 'width', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 w-16 text-right text-zinc-200 outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          <input
                            type="number"
                            value={row.depth}
                            onChange={(e) => handleRowChange(row.id, 'depth', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 w-16 text-right text-zinc-200 outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          <input
                            type="number"
                            value={row.height}
                            onChange={(e) => handleRowChange(row.id, 'height', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 w-16 text-right text-zinc-200 outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          <input
                            type="number"
                            step="0.1"
                            value={row.weight}
                            onChange={(e) => handleRowChange(row.id, 'weight', parseFloat(e.target.value) || 0)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 w-16 text-right text-amber-300 outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono">
                          <input
                            type="number"
                            min="1"
                            value={row.boxQuantity}
                            onChange={(e) => handleRowChange(row.id, 'boxQuantity', parseInt(e.target.value, 10) || 1)}
                            className="bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 w-16 text-right text-white font-bold outline-none"
                          />
                        </td>
                        <td className="p-2.5 text-right font-mono text-zinc-300 font-bold">
                          {row.boxQuantity * (row.innerQuantity || 1)}
                        </td>
                        <td className="p-2.5 text-center">
                          {row.isValid ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                              <Check size={11} /> Hazır
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1 text-[10px] text-rose-400 font-semibold px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20"
                              title={row.errorMessage}
                            >
                              <AlertTriangle size={11} /> Hata
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/90 flex flex-col gap-3 text-xs">
          {/* Target Destination & Mode Selector */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-zinc-900/90 p-2.5 rounded-xl border border-zinc-800">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-zinc-400 font-semibold flex items-center gap-1.5">
                <Database size={13} className="text-blue-400" /> Aktarım Hedefi:
              </span>
              <label className="flex items-center gap-1.5 text-zinc-200 cursor-pointer">
                <input
                  type="radio"
                  name="targetDestination"
                  value="both"
                  checked={targetDestination === 'both'}
                  onChange={() => setTargetDestination('both')}
                  className="text-blue-600 focus:ring-0 bg-zinc-800 border-zinc-700"
                />
                <span className="font-medium text-emerald-400">Her İkisi (Kataloğa Kaydet + Palete Yükle)</span>
              </label>
              <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="targetDestination"
                  value="catalog_only"
                  checked={targetDestination === 'catalog_only'}
                  onChange={() => setTargetDestination('catalog_only')}
                  className="text-blue-600 focus:ring-0 bg-zinc-800 border-zinc-700"
                />
                <span>Sadece Ana Kataloğa Kaydet (Kalıcı Base Liste)</span>
              </label>
              <label className="flex items-center gap-1.5 text-zinc-300 cursor-pointer">
                <input
                  type="radio"
                  name="targetDestination"
                  value="pallet_only"
                  checked={targetDestination === 'pallet_only'}
                  onChange={() => setTargetDestination('pallet_only')}
                  className="text-blue-600 focus:ring-0 bg-zinc-800 border-zinc-700"
                />
                <span>Sadece Bu Palete Ekle</span>
              </label>
            </div>

            {/* Pallet Mode (if adding to pallet) */}
            {(targetDestination === 'pallet_only' || targetDestination === 'both') && (
              <div className="flex items-center gap-2 border-t md:border-t-0 md:border-l border-zinc-700/60 pt-2 md:pt-0 md:pl-3">
                <span className="text-zinc-400 text-[11px]">Palet Ekleme Modu:</span>
                <label className="flex items-center gap-1 text-[11px] text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="text-blue-600 focus:ring-0 bg-zinc-800 border-zinc-700"
                  />
                  <span>Mevcutlara ekle</span>
                </label>
                <label className="flex items-center gap-1 text-[11px] text-zinc-300 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-blue-600 focus:ring-0 bg-zinc-800 border-zinc-700"
                  />
                  <span className="text-amber-400">Mevcutları temizle</span>
                </label>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-zinc-400 text-xs">
              {targetDestination === 'catalog_only' && (
                <span>Ürünler ana kataloğa kaydedilecek; sonrasında koli eklerken listeden tek tıkla seçebileceksiniz.</span>
              )}
              {targetDestination === 'both' && (
                <span>Ürünler hem ana kataloğa kalıcı olarak eklenecek, hem de bu palet simülasyonuna yerleştirilecek.</span>
              )}
              {targetDestination === 'pallet_only' && (
                <span>Ürünler sadece bu simülasyon için koli listesine eklenecektir.</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl font-medium transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleConfirmImport}
                disabled={selectedCount === 0}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-semibold flex items-center gap-2 transition-colors shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Check size={15} />
                <span>
                  {targetDestination === 'catalog_only'
                    ? `${selectedCount} Ürünü Ana Kataloğa Kaydet`
                    : targetDestination === 'both'
                    ? `${selectedCount} Ürünü Kataloğa & Palete Aktar`
                    : `${selectedCount} Kalem Koliyi Palete Yükle`}
                </span>
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
