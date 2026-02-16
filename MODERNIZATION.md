# Fiyat Avcısı: Modernizasyon Yol Haritası (Teknofest 2025)

Bu belge, "Fiyat Avcısı" projesinin basit bir fiyat takip sitesinden, yapay zeka destekli bir **E-Ticaret Karar Destek Ekosistemi**'ne dönüşüm stratejisini kapsar.

## 1. Veri Bilimi (Price Intelligence)

### Gelecek Fiyat Tahmini (Price Forecasting)
Sadece geçmiş veriyi değil, piyasa dinamiklerini analiz eden hibrit bir model öneriyoruz:
- **Mimari:** XGBoost (tabüler veriler için) + LSTM (zaman serisi derinliği için).
- **Veri Seti:** Ürün fiyat geçmişi, stok durumu, özel gün (Black Friday vb.) yakınlığı, döviz kuru etkisi.
- **Model:** `PriceForecaster` sınıfı, `predict_7_days()` metodu ile %90+ doğruluk hedefi.

### Alınabilirlik Skoru (Buyability Score) - Matematiksel Formül
Bir ürünün sadece "ucuz" olması yetmez. Şu formül ile optimize edilmiş bir skor hesaplıyoruz:
$$Score = (w_1 \cdot \frac{P_{min}}{P_{curr}}) + (w_2 \cdot R_{seller}) + (w_3 \cdot \frac{1}{D_{days}})$$
- $P_{min}/P_{curr}$: Fiyat avantajı.
- $R_{seller}$: Satıcı güvenilirliği (0-1).
- $D_{days}$: Tahmini kargo süresi.

## 2. Yenilikçi Arama (AI-Driven Search)

### Semantic Search & Vector DB
- **Altyapı:** Pinecone veya Milvus.
- **Akış:** Ürün açıklamaları ve kullanıcı yorumları `sentence-transformers` (örn: `multilingual-e5`) ile vektörize edilir.
- **NLP Katmanı:** Kullanıcının niyetini anlayan bir "Query Intent Classifier".
- **Örnek Sorgu:** "Bana en uzun pil ömürlü ve öğrenci dostu laptopu bul"
  - *İşleme:* "Pil ömrü" → Teknik spesifikasyon filtresi. "Öğrenci dostu" → Fiyat/Performans ağırlıklı semantik eşleşme.

## 3. Gelişmiş UX/UI (Flutter)

### Alışveriş Dashboard
- **Kişiselleştirme:** Kullanıcının geçmiş aramalarına göre "Senin İçin Fırsatlar" bölümü.
- **Bütçe Takibi:** "Aylık tasarruf miktarı" görselleştirmesi.

### Smart Alert (Akıllı Uyarı)
- **Push Notification:** Firebase Cloud Messaging (FCM) entegrasyonu.
- **Optimizasyon:** Sadece "Dip Fiyat" veya "Anlık Stok Azalması" durumunda bildirim gönderen akıllı limitör.

## 4. Sektörel Fark: "Otopilot" (Autonomous Budget Protector)
Rakiplerden (Cimri, Akakçe) bizi ayıran **Killer Feature**:
- **Tanım:** Kullanıcının belirlediği bütçe ve ihtiyaç listesine göre, en uygun satın alma zamanını ve kombinasyonunu (örn: 3 farklı mağazadan sepet tamamlama) otomatik öneren AI asistanı.
- **SLM Entegrasyonu:** Cihaz üzerinde çalışan sSLM (Small Language Model) ile gizlilik odaklı alışveriş danışmanlığı.

---

## Neden Biz Birinci Olmalıyız? (Teknofest Argümanları)
1. **Veri Odaklılık:** Sadece listeleme değil, XGBoost/LSTM ile geleceği tahmin ediyoruz.
2. **Kullanıcı Deneyimi:** Klasik arama yerine "Doğal Dil" ile ürün bulma imkanı sağlıyoruz.
3. **Ekonomik Katkı:** "Buyability Score" ile kullanıcının yanlış kararlar vermesini (düşük puanlı satıcı, geç kargo) engelliyoruz.
4. **Yerli ve Milli:** Türkiye e-ticaret dinamiklerine (Trendyol, Hepsiburada vb.) %100 uyumlu yerel algoritmalar.
