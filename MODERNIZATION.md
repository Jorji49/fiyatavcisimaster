# Fiyat Avcısı Modernizasyon Stratejisi (Trendyol & T3 Vakfı Yarışması)

Bu döküman, "Fiyat Avcısı" projesinin e-ticaret yarışması hedefleri doğrultusunda modernize edilmesi için hazırlanan teknik yol haritasını ve mimari detayları içerir.

## 1. Stratejik Yol Haritası

*   **Faz 1: Veri ve Altyapı (1-4 Hafta):** Mevcut Node.js yapısının Python (FastAPI) tabanlı bir mikroservis mimarisine taşınması. PostgreSQL ve Pinecone (Vector DB) kurulumu.
*   **Faz 2: Zeka Katmanı (4-8 Hafta):** Prophet ve XGBoost modellerinin entegrasyonu. Semantic search motorunun devreye alınması.
*   **Faz 3: Modern UI/UX (8-12 Hafta):** Flutter ile mobil ve web arayüzlerinin geliştirilmesi. "Akıllı Dashboard" özelliklerinin implementasyonu.
*   **Faz 4: Ölçekleme ve Globalizasyon (12+ Hafta):** Çoklu dil desteği ve global pazar yeri entegrasyonları.

## 2. Teknik Mimari Şeması (Text-Based)

```text
[ Flutter Frontend (Mobile/Web) ]
           |
           v (REST API / JSON)
[ FastAPI Backend (Python) ] <------> [ Sentence-Transformers (Embedding) ]
    |             |                           |
    |             v                           v
    |     [ PostgreSQL ] <-----------> [ Pinecone Vector DB ]
    |     (Metadata/History)           (Semantic Product Vectors)
    |
    v
[ ML Service (Prophet/XGBoost) ]
(Price Prediction & Demand Analysis)
```

## 3. Tahminleme Modülü (Python/Prophet)

Aşağıdaki kod, bir ürünün geçmiş fiyat verilerini kullanarak önümüzdeki 7 gün için fiyat tahmini yapar:

```python
from fastapi import FastAPI
from prophet import Prophet
import pandas as pd

app = FastAPI()

@app.post("/predict-price")
async def predict_price(price_history: list):
    # Not: Gerçek senaryoda model eğitimi asenkron bir worker (Celery/Redis)
    # üzerinden yapılmalı veya önceden eğitilmiş bir model yüklenmelidir.
    df = pd.DataFrame(price_history)

    model = Prophet(daily_seasonality=True, changepoint_prior_scale=0.05)
    model.fit(df) # Eğitim büyük veri setlerinde zaman alabilir

    future = model.make_future_dataframe(periods=7)
    forecast = model.predict(future)

    return forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(7).to_dict(orient="records")
```

## 4. Akıllı Arama (Semantic Search)

Kullanıcının "iPhone gibi kaliteli telefonlar" aramasını anlayan yapı:

```python
from sentence_transformers import SentenceTransformer
import pinecone

# Pinecone & Model Init
pc = pinecone.Pinecone(api_key="YOUR_API_KEY")
index = pc.Index("products")
model = SentenceTransformer('all-MiniLM-L6-v2')

def semantic_search(query: str):
    # Sorguyu vektöre çevir
    query_vector = model.encode(query).tolist()

    # Pinecone'da benzer ürünleri ara
    results = index.query(
        vector=query_vector,
        top_k=5,
        include_metadata=True
    )
    return results
```

## 5. Kullanıcı Dostu Önyüz (Flutter - Akıllı Dashboard)

"Fiyat/Performans Radarı" için örnek Flutter widget yapısı:

```dart
class PriceRadarChart extends StatelessWidget {
  final List<double> values; // [Fiyat, Performans, Popülerlik, Güven, Garanti]

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Column(
        children: [
          Text("Ürün Skor Radarı", style: TextStyle(fontWeight: FontWeight.bold)),
          // Not: RadarChart için 'fl_chart' paketi kullanılabilir.
          RadarChart(
            data: values,
            labels: ["Fiyat", "Performans", "Popülerlik", "Güven", "Garanti"],
            color: Colors.blueAccent,
          ),
          ElevatedButton(
            onPressed: () => print("En uygun zaman: Haftaya Salı!"),
            child: Text("Satın Alma Analizi"),
          )
        ],
      ),
    );
  }
}
```

## 6. Vurucu Özellik (Killer Feature): "Fiyat Avcısı - Otopilot"

**Özellik:** Sadece fiyat takibi değil, **"AI-Negotiator"** entegrasyonu.
**Detay:** Kullanıcı bir bütçe belirler. Sistem, ürünün fiyat tahminleme modeline göre en düşük seviyeye ulaşacağı anı (örn: "Haftaya Salı saat 03:00") tahmin eder ve eğer pazar yeri API'ları destekliyorsa (veya kullanıcı yetkisiyle) otomatik satın alma veya "Sepete At & Bildir" işlemini gerçekleştirir.
**Jüriye Mesaj:** "Biz sadece fiyatı göstermiyoruz, veriyi aksiyona dönüştürüp kullanıcının parasını ve zamanını otopilotta yönetiyoruz."
