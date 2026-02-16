# Fiyat Avcısı: Teknofest E-Ticaret Yarışması Modernizasyon ve Vizyon Belgesi

Bu döküman, "Fiyat Avcısı" projesinin Teknofest "Arama ve Alışveriş Deneyimini İyileştirme" teması kapsamında, sadece bir fiyat takipçisinden **"Yapay Zeka Destekli Akıllı Alışveriş Asistanı"**na dönüşüm yol haritasını içerir.

## 1. Stratejik Proje Geliştirme Planı (Teknofest Yol Haritası)

*   **Faz 1: Veri Madenciliği ve Konsolidasyon (Hafta 1-2):** Mevcut scraper yapısının FastAPI ile asenkron (BeautifullSoup/Playwright) hale getirilmesi. Verilerin vektörelleştirme için hazırlanması.
*   **Faz 2: Semantik Zeka Katmanı (Hafta 3-5):** Doğal dil işleme (NLP) modellerinin entegrasyonu. Pinecone/Milvus ile "Niyet Bazlı Arama" motorunun kurulması.
*   **Faz 3: Tahminleme ve Analitik (Hafta 6-9):** XGBoost ve LSTM modelleri ile fiyat dalgalanması tahmini. Talep analizi modülünün PDR/KTR raporlarına temel teşkil edecek şekilde geliştirilmesi.
*   **Faz 4: Hiper-Kişiselleştirilmiş UX (Hafta 10-12):** Flutter tabanlı "Akıllı Dashboard" ve "Alışveriş Radarı"nın hayata geçirilmesi.

## 2. Teknik Mimari Şeması (Text-Based)

```text
[ Flutter Frontend (Mobil/Web) ] <--> [ Firebase Cloud Messaging (Anlık Uyarılar) ]
           |
           v (TLS 1.3 / gRPC veya REST)
[ FastAPI Gateway (Backend) ] <------------> [ Auth & User Profile (PostgreSQL) ]
    |             |                                    |
    |             v                                    v
    |     [ Vector Engine ] <-----------> [ Pinecone / Milvus DB ]
    |     (Sentence-Transformers)         (Ürün Gömülmeleri - Embeddings)
    |
    v
[ ML Core Service ] <-------------------> [ Redis Cache ]
(XGBoost Price Predictor)                (Sık Aranan Tahminler)
(LSTM Demand Analyzer)
```

## 3. Veri Bilimi: Fiyat Tahminleme (Python / XGBoost)

Jüriyi etkileyecek olan, ürünün sadece geçmişini değil, geleceğini de söyleyebilme kabiliyetidir:

```python
import xgboost as xgb
import pandas as pd
from datetime import datetime, timedelta

def train_price_predictor(data):
    # 'data' şunları içermeli: [tarih, fiyat, kategori_id, indirim_orani, stok_durumu]
    df = pd.DataFrame(data)

    # Feature Engineering: Gecikmeli özellikler (Lag Features)
    df['prev_day_price'] = df['price'].shift(1)
    df['rolling_mean_7'] = df['price'].rolling(window=7).mean()

    X = df.drop(['price', 'date'], axis=1)
    y = df['price']

    model = xgb.XGBRegressor(objective='reg:squarederror', n_estimators=1000)
    model.fit(X, y)
    return model

# API Endpoint Örneği
@app.get("/predict/{product_id}")
async def get_prediction(product_id: str):
    # Modelden 7 günlük trend tahmini al
    # Çıktı: "Önümüzdeki 3 gün içinde %15 indirim bekleniyor. Beklemeni öneririz."
    pass
```

## 4. Akıllı Arama: Semantik Mimari (NLP)

Kullanıcı "öğrenci dostu telefon" dediğinde, sistemin bunu "uygun fiyat + yüksek batarya" olarak anlaması:

```python
from sentence_transformers import SentenceTransformer
import pinecone

# Semantik vektörleştirme (Örn: Multilingual MiniLM)
model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

def get_semantic_results(user_query):
    # 1. Sorguyu vektöre çevir
    query_embedding = model.encode(user_query).tolist()

    # 2. Vektör veritabanında (Pinecone) benzerlik araması yap
    index = pinecone.Index("shopping-assistant")
    results = index.query(vector=query_embedding, top_k=10, include_metadata=True)

    return results
```

## 5. Modern Dashboard: Alışveriş Radarı (Flutter)

Kullanıcıya özel "Fiyat/Performans Skoru" gösterimi:

```dart
// Custom Radar Chart için teknik ipucu:
// 'fl_chart' veya 'syncfusion_flutter_charts' paketleri kullanılabilir.

class ShoppingRadarWidget extends StatelessWidget {
  final Map<String, double> metrics; // {Fiyat: 0.8, Batarya: 0.9, Popülerlik: 0.6}

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        gradient: LinearGradient(colors: [Colors.blue.shade900, Colors.black]),
      ),
      child: Column(
        children: [
          Text("Ürün Skor Radarı", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          // CustomPaint ile Radar Chart çizimi veya hazır widget entegrasyonu
          SfRadarChart(
            series: <RadarSeries>[
              RadarSeries<MetricData, String>(
                dataSource: getChartData(metrics),
                xValueMapper: (MetricData data, _) => data.category,
                yValueMapper: (MetricData data, _) => data.value,
              )
            ],
          ),
        ],
      ),
    );
  }
}
```

## 6. Yarışma Raporu İçin "Vurucu Yenilik" (Killer Feature)

**Özellik Adı:** **"Fiyat Avcısı - Otonom Bütçe Koruyucu"**

*   **Nedir?** Kullanıcı bir ürüne "hedef fiyat" koymak yerine, sisteme **"Bana bu özelliklerde (örn: 12GB RAM, OLED ekran) en iyi telefonu, önümüzdeki 1 ayın en düşük fiyat noktasında otomatik rezerve et/yakala"** talimatı verir.
*   **Teknik Fark:** Sadece bir "scraping" değil; XGBoost ile fiyat tahmini, Pinecone ile semantik eşleştirme ve asenkron workerlar ile "en doğru saniyede" bildirim gönderen bir **Trading Bot** mantığıdır.
*   **Jüriye Mesaj:** "Biz kullanıcıya sadece fiyatları listelemiyoruz; ona bir finansal veri bilimci gibi danışmanlık yapıyoruz ve bütçesini otonom olarak koruyoruz."
