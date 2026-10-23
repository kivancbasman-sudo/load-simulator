# Paletify: Sadeleştirilmiş 2D & 3D Palet Yerleşim Stüdyosu

Kullanıcı talebi doğrultusunda otomatik yükleme (algoritma/otomatik paketleme) motoru ve karmaşık sekmeler tamamen kaldırılarak, uygulama doğrudan, hızlı ve modern bir **Tek Ekran Manuel Paletleme & Koli Planlama Stüdyosu** olarak yeniden yapılandırılmaktadır.

> [!IMPORTANT]
> **Kritik Karar Özeti:**
> - **Otomatik Yükleme Çöpe Atıldı:** `Packer.pack()`, karmaşık algoritma ayarları, otomatik paletleme simülatörü ve oto-yükleme modu tamamen kaldırılıyor.
> - **Tek Ekran Odaklı Stüdyo Mimarisi:** Karmaşık üst sekmeler ve mod anahtarları yerine; sol panelde koli/ürün ekleme, merkezde interaktif 3D & 2D katman çalışma alanı, sağ panelde canlı palet metrikleri (ağırlık, hacim, yükseklik, denge) yer alacak.
> - **Gereksiz Telemetri ve Göstergeler Temizlendi:** Sahte skorlar, karmaşık araç çubukları, kalabalık durum bildirimleri kaldırılarak arayüz sade, ferah ve profesyonel hale getiriliyor.

---

## 1. Genel Bakış ve Temel Konsept

- **Ne Yapıyor?**: Kullanıcıların palet tipini (Euro Palet, Standart vb.) seçip, ürün kataloğundan veya özel ölçülerle koli ekleyerek 2D katman planı ve 3D interaktif palet üzerinde hassas, mıknatıslı ve çakışmasız yerleşim yapmasını sağlayan yalın bir paletleme aracı.
- **Hedef Kitle**: Depo sorumluları, lojistik ve ihracat uzmanları, paketleme mühendisleri.
- **Temel Değer**: Otomasyon hatalarıyla veya karmaşık algoritmalarla vakit kaybetmeden, istenen katman dizilimini doğrudan ekranda kurup anında katman raporu ve PDF/yazdırma çıktısı alabilmek.

---

## 2. Kullanıcı Deneyimi ve Görsel Tasarım

### Ana Kullanıcı Akışı
1. **Üst Bar (Yalın & Hızlı)**: Palet türü seçimi (Euro Palet EPAL 1 vb.), ölçü bilgisi, Rapor Al (PDF/Yazdır) ve Ürün Kataloğu butonları.
2. **Sol Panel (Koli Ekleme & Liste)**: 
   - Katalogdan arayarak veya adet/koli içi adet belirterek koli ekleme.
   - Eklenen koli tiplerinin renkli kartları ve kalan koli sayısı.
   - Tek tıkla palete gönderme (`+ Ekle`) veya sürükleme.
3. **Merkez Alan (3D & 2D Görünüm)**:
   - Üstte katman değiştirici (Katman 1, 2, 3...) ve görünüm modu (3D, 2D veya İkili).
   - 2D planda koli seçimi, taşınması ve katman temizliği (istenmeyen koli spawn'ı olmadan).
   - 3D sahnede kamera açıları (İzometrik, Üst, Ön, Yan), mıknatıslı yapışma (5/10/25/50 mm) ve çakışma kontrolü.
4. **Sağ Panel (Canlı Durum ve Seçili Koli Ayarı)**:
   - Seçili koli varsa: Döndürme, 1 cm hassas kaydırma butonları, katman değiştirme veya silme.
   - Seçili koli yoksa: Palet doluluk oranı (%), toplam ağırlık (kg), istif yüksekliği (mm) ve ağırlık merkezi (CoG) dengesi.

### Görsel Kimlik ve Tasarım Kuralları
- **Renk Paleti**: %60 derin nötr kanvas (`bg-zinc-950`), %30 yapısal yüzeyler (`bg-zinc-900`, `border-zinc-800`), %10 odak vurguları (`emerald-500`, `amber-500`, `blue-500`).
- **Tipografi**: Temiz, modern sans-serif hiyerarşi, tüm sayısal verilerde hizalama için `font-mono tabular-nums`.
- **Hafiflik & Sadeliği Koruma**: Rozet kirliliği, yanıp sönen noktalar ve gereksiz çerçeveler kaldırılacak; ferah ve net butonlar kullanılacaktır.

---

## 3. Temel Ürün Kararları & Tercihler

### Karar 1: Otomatik Paketleme Algoritmasının Kaldırılması
- **Uygulama**: `src/lib/packer.ts` motoru çağrıları ve oto-yükleme sekmesi tamamen devreden çıkarılacak.
- **Neden**: Kullanıcılar pratikte algoritmanın ürettiği dağınık dizilimler yerine, gerçek depolama kurallarına uygun katmanları kendileri elle dizmek istiyor.

### Karar 2: Tek Sayfada Entegre 2D + 3D Stüdyo
- **Uygulama**: Mod geçişleri (`mode === 'auto' | 'manual'`) kaldırılıp tüm uygulama tek ve akıcı bir stüdyo ekranı haline getirilecek.
- **Neden**: Kullanıcı 2D'de kutu kutu katman planı çizerken aynı anda 3D'de paletin nasıl yükseldiğini canlı görebilecek.

### Karar 3: Katalog ve Koli Ekleme Sadeleştirmesi
- **Uygulama**: Koli arama, adet / koli içi hesaplama ve palete ekleme akışı tek bir minimal sol panel kartında toplanacak.
- **Neden**: Hem adet bazlı hem koli bazlı giriş korunurken form kalabalığı ortadan kaldırılacak.

---

## 4. Teknik Mimari ve Bileşen Hiyerarşisi

```
┌────────────────────────────────────────────────────────────────────────┐
│                          ÜST NAVİGASYON BARI                           │
│  [Paletify Logo]  ·  [Palet Seçimi: Euro EPAL1 ▼]  ·  [Katalog] [Rapor]│
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
┌─────────────────────────┬──────────┴─────────────────┬─────────────────┐
│       SOL PANEL         │        MERKEZ PANEL        │    SAĞ PANEL    │
│  (Koli & Katalog Ekle)  │   (2D & 3D Palet Görünümü) │(Metrik & Ayar)  │
│                         │                            │                 │
│ ┌─────────────────────┐ │ ┌────────────────────────┐ │ ┌─────────────┐ │
│ │ Hızlı Koli Ekle     │ │ │ Katman: [K1][K2][K3][+]│ │ │ Doluluk: %78│ │
│ │ (Adet / Koli İçi)   │ │ ├────────────┬───────────┤ │ │ Ağırlık:    │ │
│ ├─────────────────────┤ │ │ 2D Katman  │ 3D Palet  │ │ │  640 kg     │ │
│ │ Paletteki Koli      │ │ │ Planı      │ Görünümü  │ │ │ Yükseklik:  │ │
│ │ Tipleri ve Kalanlar │ │ │ (SVG)      │ (ThreeJS) │ │ │  1450 mm    │ │
│ └─────────────────────┘ │ └────────────┴───────────┘ │ └─────────────┘ │
└─────────────────────────┴────────────────────────────┴─────────────────┘
```

### Temizlenecek ve Sadeleştirilecek Dosyalar
1. `src/App.tsx`: 1950 satırlık karmaşık oto-yükleme mantığı, simülasyon kodları ve sekmeler temizlenecek; doğrudan `ManualPlacementStudio` ve sol/sağ sade panellere bağlanacak.
2. `src/types.ts`: Kullanılmayan otomatik optimizasyon tipleri sadeleştirilecek, temiz paletleme arayüzü kalacak.
3. Raporlama Modal'ı (`src/components/ReportModal.tsx`): Mevcut manuel palet dizilimini doğrudan katman katman gösterip yazdırabilecek şekilde güncellenecek.
