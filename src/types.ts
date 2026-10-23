export interface ProductCatalogItem {
  id: string;
  materialCode: string; // malzeme kodu (örn: MLZ-001)
  materialName: string; // malzeme adı
  innerQuantity: number; // koli içi adet (koli başına ürün sayısı)
  width: number; // in cm
  height: number; // in cm
  depth: number; // in cm
  weight: number; // in kg (koli brüt ağırlığı)
  category?: string;
}

export const DEFAULT_MASTER_CATALOG: ProductCatalogItem[] = [
  {
    id: 'cat-1',
    materialCode: 'MLZ-101',
    materialName: 'Otomotiv Filtre Takımı A',
    innerQuantity: 12,
    width: 40,
    depth: 30,
    height: 25,
    weight: 7.5,
    category: 'Otomotiv'
  },
  {
    id: 'cat-2',
    materialCode: 'MLZ-102',
    materialName: 'Elektrikli El Aletleri Çantası',
    innerQuantity: 6,
    width: 45,
    depth: 35,
    height: 30,
    weight: 14.0,
    category: 'Hırdavat'
  },
  {
    id: 'cat-3',
    materialCode: 'MLZ-103',
    materialName: 'Hassas Elektronik Sensör Modülü',
    innerQuantity: 48,
    width: 30,
    depth: 20,
    height: 18,
    weight: 3.2,
    category: 'Elektronik'
  },
  {
    id: 'cat-4',
    materialCode: 'MLZ-104',
    materialName: 'Hidrolik Bağlantı Rakor Grubu',
    innerQuantity: 24,
    width: 38,
    depth: 28,
    height: 22,
    weight: 18.5,
    category: 'Sanayi'
  },
  {
    id: 'cat-5',
    materialCode: 'MLZ-105',
    materialName: 'Endüstriyel Conta & Sızdırmazlık Kiti',
    innerQuantity: 100,
    width: 25,
    depth: 25,
    height: 15,
    weight: 4.0,
    category: 'Yedek Parça'
  },
  {
    id: 'cat-6',
    materialCode: 'MLZ-106',
    materialName: 'Ağır Hizmet Rulman Grubu',
    innerQuantity: 4,
    width: 50,
    depth: 40,
    height: 35,
    weight: 26.0,
    category: 'Ağır Sanayi'
  },
  {
    id: 'cat-7',
    materialCode: 'MLZ-107',
    materialName: 'LED Aydınlatma Armatürü 60x60',
    innerQuantity: 8,
    width: 62,
    depth: 62,
    height: 20,
    weight: 12.0,
    category: 'Aydınlatma'
  },
  {
    id: 'cat-8',
    materialCode: 'MLZ-108',
    materialName: 'Fren Balatası Takımı',
    innerQuantity: 16,
    width: 32,
    depth: 24,
    height: 16,
    weight: 9.8,
    category: 'Otomotiv'
  }
];

export interface Box {
  id: string;
  name: string;
  materialCode?: string; // malzeme kodu (örn: MLZ-001)
  materialName?: string; // malzeme adı
  innerQuantity?: number; // koli içi adet (koli başına ürün sayısı)
  targetPieceCount?: number; // hedeflenen toplam ürün/parça adedi
  width: number; // in cm
  height: number; // in cm
  depth: number; // in cm
  color: string;
  quantity: number; // palete yüklenecek koli adedi
  weight?: number; // in kg (koli brüt ağırlığı)
  allowRotateX?: boolean; // Tilt sideways
  allowRotateY?: boolean; // Horizontal 90-deg turn
  allowRotateZ?: boolean; // Tilt forward/backward
  stackable?: boolean; // Can other boxes be placed on top of this one?
  mustBeBottom?: boolean; // Must be placed directly on the pallet floor
}

export interface PackedBox extends Box {
  x: number; // in cm
  y: number; // in cm
  z: number; // in cm
  rotated: boolean;
  layerIndex?: number;
  sequenceNumber?: number;
}

export interface Pallet {
  width: number; // in cm
  height: number; // in cm (max loading height)
  depth: number; // in cm
  maxWeight?: number; // in kg
  tareWeight?: number; // in kg (empty weight)
}

export interface CenterOfGravity {
  x: number; // cm
  y: number; // cm
  z: number; // cm
  idealX: number;
  idealZ: number;
  xOffset: number; // cm
  zOffset: number; // cm
  deviationPercent: number;
  status: 'perfect' | 'good' | 'warning' | 'critical';
  statusLabel: string;
}

export interface Margins {
  left: number; // mm
  right: number; // mm
  front: number; // mm
  back: number; // mm
  isXBalanced: boolean;
  isZBalanced: boolean;
}

export interface PalletResult {
  id: string;
  pallet: Pallet;
  packedBoxes: PackedBox[];
  efficiency: number;
  actualWeight: number; // in kg
  chargeableWeight: number; // in kg (volumetric / desi)
  totalLoadedVolume: number; // in cm3
  maxPackedHeight: number; // in cm
  centerOfGravity: CenterOfGravity;
  margins: Margins;
  layerCount: number;
}

export interface PackingResult {
  pallets: PalletResult[];
  unpackedBoxes: Box[];
  totalEfficiency: number;
  totalWeight: number;
  totalBoxesPacked: number;
  totalBoxesRemaining: number;
}

export interface PalletPreset {
  id: string;
  name: string;
  code: string;
  width: number; // cm
  depth: number; // cm
  height: number; // cm
  maxWeight: number; // kg
  description: string;
}

export const PALLET_PRESETS: PalletPreset[] = [
  {
    id: 'euro_epal1',
    name: 'Euro Palet (EPAL 1)',
    code: '1200 × 800 mm',
    width: 120,
    depth: 80,
    height: 180,
    maxWeight: 1500,
    description: 'Avrupa standart lojistik paleti'
  },
  {
    id: 'industrial_epal2',
    name: 'Sanayi Paleti (EPAL 2 / ISO)',
    code: '1200 × 1000 mm',
    width: 120,
    depth: 100,
    height: 180,
    maxWeight: 1500,
    description: 'Ağır sanayi & kimya sektörü paleti'
  },
  {
    id: 'us_gma',
    name: 'Kuzey Amerika (GMA)',
    code: '1219 × 1016 mm (48×40")',
    width: 121.9,
    depth: 101.6,
    height: 190,
    maxWeight: 1400,
    description: 'ABD & Kanada standart paleti'
  },
  {
    id: 'half_pallet',
    name: 'Yarım Palet (EPAL 6 / Display)',
    code: '800 × 600 mm',
    width: 80,
    depth: 60,
    height: 150,
    maxWeight: 750,
    description: 'Perakende teşhir ve dar alan paleti'
  },
  {
    id: 'container_high',
    name: 'Deniz Konteyneri Yüksekliği',
    code: '1200 × 800 × 2200 mm',
    width: 120,
    depth: 80,
    height: 220,
    maxWeight: 1800,
    description: 'Standart Dry/HC konteyner yükleme'
  }
];

export const BOX_PRESETS = [
  {
    name: 'Standart İhracat Kolisi',
    width: 40,
    height: 30,
    depth: 30,
    weight: 8,
    color: '#3b82f6',
    quantity: 20
  },
  {
    name: 'Ağır Yedek Parça',
    width: 50,
    height: 35,
    depth: 40,
    weight: 22,
    color: '#f59e0b',
    quantity: 8
  },
  {
    name: 'Küçük Aksesuar Kolisi',
    width: 25,
    height: 20,
    depth: 25,
    weight: 3,
    color: '#10b981',
    quantity: 36
  },
  {
    name: 'Yüksek Tekstil Kolisi',
    width: 60,
    height: 45,
    depth: 40,
    weight: 12,
    color: '#ec4899',
    quantity: 12
  }
];
