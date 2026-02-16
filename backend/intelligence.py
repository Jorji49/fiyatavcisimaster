import numpy as np
from typing import List, Dict, Optional
# import xgboost as xgb  # Teknofest Sunumunda: 'pip install xgboost'
# from tensorflow.keras.models import Sequential # LSTM mimarisi için

class PriceIntelligence:
    def __init__(self, model_path: Optional[str] = None):
        self.model = self._load_model(model_path)

    def _load_model(self, path: Optional[str]):
        """
        XGBoost veya LSTM modelini yükler.
        """
        # self.xgb_model = xgb.Booster()
        # self.xgb_model.load_model('price_model.json')
        return None

    def calculate_buyability_score(self, price: float, min_price: float, seller_rating: float, delivery_days: int) -> float:
        """
        Alınabilirlik Skorunu hesaplar (0.0 - 1.0 arası)
        Formula: Score = (w1 * P_min/P_curr) + (w2 * R_seller) + (w3 * 1/D_days)
        """
        w1, w2, w3 = 0.5, 0.3, 0.2

        # Fiyat Skoru: Mevcut fiyatın tarihi min fiyata oranı
        price_score = min_price / price if price > 0 else 0

        # Satıcı Skoru: 0-10 arasını 0-1 arasına normalize eder
        rating_score = min(seller_rating / 10.0, 1.0)

        # Teslimat Skoru: Hızlı teslimat (1-3 gün) daha yüksek puan alır
        delivery_score = max(0, (7 - delivery_days) / 7.0)

        score = (w1 * price_score) + (w2 * rating_score) + (w3 * delivery_score)
        return round(min(score, 1.0), 2)

    def predict_with_xgboost(self, features: np.ndarray) -> float:
        """
        XGBoost Regressor kullanarak fiyat tahmini yapar.
        """
        # dmatrix = xgb.DMatrix(features)
        # return self.xgb_model.predict(dmatrix)
        return 1250.0 # Mock

    def predict_with_lstm(self, time_series_data: List[float]) -> float:
        """
        LSTM (Zaman Serisi) kullanarak 7 günlük trend tahmini yapar.
        """
        # Model input shape: (samples, time_steps, features)
        return sum(time_series_data) / len(time_series_data) * 0.95 # Mock Trend

# Singleton Instance
intelligence_engine = PriceIntelligence()
