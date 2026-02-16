from fastapi import FastAPI, Query
from typing import List, Optional, Dict, Any
import os
from pydantic import BaseModel
import uvicorn
from .intelligence import intelligence_engine
from .search import search_engine
from .autopilot import autopilot_engine

app = FastAPI(title="Fiyat Avcısı API v3", version="3.0.0")

class Product(BaseModel):
    id: str
    name: str
    price: float
    store: str
    buyability_score: float
    forecast: Dict[str, Any]

@app.get("/")
async def root():
    return {"message": "Fiyat Avcısı AI Decision Engine Active", "version": "3.0.0"}

@app.get("/search")
async def search(q: str = Query(..., min_length=2)):
    # Simüle edilmiş hibrit arama ve zeka entegrasyonu
    search_results = await search_engine.hybrid_search(q)

    products = []
    for res in search_results:
        item = res["item"]
        price = item["base_price"]

        # Zeka katmanı hesaplamaları
        score = intelligence_engine.calculate_buyability_score(
            price=price,
            min_price=price * 0.9, # Simüle edilmiş min fiyat
            seller_rating=9.5,
            delivery_days=2
        )

        forecast = intelligence_engine.predict_7d_forecast(price, item["name"])

        products.append({
            "id": item["id"],
            "name": item["name"],
            "price": price,
            "store": "Teknofest Store",
            "buyability_score": score,
            "forecast": forecast,
            "specs": item["specs"]
        })

    return products

@app.get("/autopilot")
async def get_autopilot_strategy(items: str, budget: float):
    item_list = items.split(",")
    return autopilot_engine.optimize_shopping_list(item_list, budget)

@app.get("/personalized-offers")
async def get_offers():
    return [
        {
            "name": "iPhone 16 Pro",
            "badge": "DİP FİYAT",
            "price": 48500.0,
            "forecast": {"trend": "-2.5%", "direction": "down"}
        },
        {
            "name": "Sony WH-1000XM5",
            "badge": "%15 FIRSAT",
            "price": 12400.0,
            "forecast": {"trend": "+1.2%", "direction": "up"}
        },
        {
            "name": "Dyson V15 Detect",
            "badge": "STOK AZALDI",
            "price": 24900.0,
            "forecast": {"trend": "Sabit", "direction": "stable"}
        }
    ]

@app.get("/health")
async def health_check():
    return {"status": "OK"}

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
