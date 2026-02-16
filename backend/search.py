from typing import List, Dict, Any
import random

class SemanticSearch:
    def __init__(self, provider: str = "pinecone"):
        # Bilgi: Gerçek projede SentenceTransformer ve Vektör DB burada yüklenir.
        self.mock_data = [
            {"id": "l1", "name": "MacBook Air M3", "tags": ["laptop", "apple", "öğrenci", "pil"], "base_price": 45000, "specs": "18 Saat Pil Ömrü"},
            {"id": "l2", "name": "ASUS Zenbook 14", "tags": ["laptop", "windows", "öğrenci", "hafif"], "base_price": 32000, "specs": "Ultra Hafif"},
            {"id": "p1", "name": "iPhone 16 Pro", "tags": ["telefon", "apple", "kamera"], "base_price": 75000, "specs": "A18 Pro Chip"},
            {"id": "h1", "name": "Dyson V15", "tags": ["ev", "süpürge", "temizlik"], "base_price": 28000, "specs": "Lazer Aydınlatma"},
        ]

    async def hybrid_search(self, query: str, top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Niyet analizi yapan simüle edilmiş semantik arama.
        """
        query_lower = query.lower()
        results = []

        for item in self.mock_data:
            score = 0
            # Basit semantik/anahtar kelime eşleşmesi simülasyonu
            if any(tag in query_lower for tag in item["tags"]):
                score += 0.5
            if item["name"].lower() in query_lower or any(word in item["name"].lower() for word in query_lower.split()):
                score += 0.4

            # "Niyet" bazlı bonuslar
            if "öğrenci" in query_lower and "öğrenci" in item["tags"]:
                score += 0.3
            if "ucuz" in query_lower or "fiyat" in query_lower:
                score += 0.1

            if score > 0:
                results.append({
                    "item": item,
                    "relevance_score": round(min(score, 1.0), 2)
                })

        # Skora göre sırala
        results.sort(key=lambda x: x["relevance_score"], reverse=True)
        return results[:top_k]

# Singleton Instance
search_engine = SemanticSearch()
