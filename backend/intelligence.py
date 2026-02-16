import numpy as np
import random
from typing import List, Dict, Optional

class PriceIntelligence:
    def __init__(self, model_path: Optional[str] = None):
        # Gerçek uygulamada model yükleme yapılır
        pass

    def calculate_buyability_score(self, price: float, min_price: float, seller_rating: float, delivery_days: int) -> float:
        """
        Alınabilirlik Skorunu hesaplar (0.0 - 1.0 arası)
        Formula: Score = (w1 * P_min/P_curr) + (w2 * R_seller) + (w3 * 1/D_days)
        """
        w1, w2, w3 = 0.5, 0.3, 0.2

        # Fiyat Skoru: Mevcut fiyatın tarihi min fiyata oranı (Normalize edilmiş)
        price_score = min_price / price if price > 0 else 0

        # Satıcı Skoru: 0-10 veya 0-100 arası derecelendirmeyi 0-1 arasına normalize eder
        rating_norm = seller_rating / 10.0 if seller_rating <= 10 else seller_rating / 100.0
        rating_score = min(max(rating_norm, 0), 1.0)

        # Teslimat Skoru: 1-7 gün arası ters orantılı skor
        delivery_score = max(0, (7 - delivery_days) / 7.0)

        score = (w1 * price_score) + (w2 * rating_score) + (w3 * delivery_score)
        return round(min(score, 1.0), 2)

    def predict_7d_forecast(self, current_price: float, item_type: str) -> Dict:
        """
        Simüle edilmiş XGBoost/LSTM tahmini.
        Trendleri ürün tipine ve rastgele piyasa dalgalanmalarına göre belirler.
        """
        seed = len(item_type)
        random.seed(seed)

        # Trend yönü (Rastgele ama tutarlı)
        trend = random.uniform(-0.05, 0.05)
        predicted_price = current_price * (1 + trend)

        # Güven aralığı
        confidence = round(random.uniform(0.85, 0.98), 2)

        return {
            "predicted_price": round(predicted_price, 2),
            "trend_percentage": round(trend * 100, 1),
            "confidence": confidence,
            "direction": "down" if trend < 0 else "up"
        }

    def generate_simulated_history(self, current_price: float, days: int = 30) -> List[Dict]:
        """Grafik çizimi için geçmiş veri üretir."""
        history = []
        for i in range(days, 0, -1):
            variation = random.uniform(-0.1, 0.1)
            history.append({
                "day": i,
                "price": round(current_price * (1 + variation), 2)
            })
        return history

# Singleton Instance
intelligence_engine = PriceIntelligence()
