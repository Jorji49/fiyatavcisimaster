from fastapi import FastAPI, Query
from typing import List, Optional
from pydantic import BaseModel
import uvicorn

app = FastAPI(title="Fiyat Avcısı API", version="2.0.0")

class Product(BaseModel):
    id: str
    name: str
    price: float
    store: str
    buyability_score: float
    predicted_price_7d: float

@app.get("/")
async def root():
    return {"message": "Fiyat Avcısı Modernize API'sine Hoşgeldiniz", "status": "active"}

@app.get("/search", response_model=List[Product])
async def search(q: str = Query(..., min_length=2)):
    # Bu endpoint daha sonra search.py ve intelligence.py modüllerini kullanacak
    return [
        {
            "id": "1",
            "name": f"{q} için örnek sonuç",
            "price": 1500.0,
            "store": "Trendyol",
            "buyability_score": 0.85,
            "predicted_price_7d": 1450.0
        }
    ]

@app.get("/autopilot")
async def get_autopilot_strategy(items: str, budget: float):
    from .autopilot import autopilot_engine
    item_list = items.split(",")
    return autopilot_engine.optimize_shopping_list(item_list, budget)

@app.get("/health")
async def health_check():
    return {"status": "OK"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
