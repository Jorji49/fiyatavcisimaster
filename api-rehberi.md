# FiyatAvcısı — API Entegrasyon Rehberi

Bu rehber, gerçek fiyat verisi çekmek için başvurulabilecek API'leri ve nasıl alınacağını adım adım açıklar.

---

## 1. Trendyol Entegrasyon API (En Kolay)

**Ne yapar:** Fiyat, stok, ürün resmi ve açıklama verisi.  
**Kimler için:** Satıcı olmana **gerek yok**, içerik/yayıncı (affiliate) hesabıyla da erişim var.

### Nasıl Alınır
1. https://partner.trendyol.com adresine git
2. "Entegrasyon Başvurusu" → "İçerik Üretici / Yayıncı" seç
3. Siteyi, aylık ziyaretçi sayısını ve kullanım amacını yaz
4. Onay süresi: **3–10 iş günü**

### API Endpoint (Onaylandıktan sonra)
```
GET https://api.trendyol.com/sapigw/products?q=iphone+17&size=10
Authorization: Basic {Base64(api_key:api_secret)}
```

### Dönen Veri
```json
{
  "content": [
    {
      "name": "Apple iPhone 17 256GB",
      "salePrice": 54999.00,
      "originalPrice": 59999.00,
      "images": ["https://cdn.trendyol.com/..."],
      "url": "https://www.trendyol.com/..."
    }
  ]
}
```

---

## 2. Hepsiburada İçerik API

**Ne yapar:** Ürün arama, fiyat ve stok verisi.  
**Not:** Hepsiburada'nın affiliate programı açık, API'ye entegrasyon üzerinden erişim mümkün.

### Nasıl Alınır
1. https://www.hepsiburada.com/hepsibahcesi/icerik-uretici adresine git
2. "Başvuru Formu" doldur → blog/site URL, kategori, ziyaretçi
3. Onaylandıktan sonra **HepsiBahçe Portal** üzerinden API key verilir
4. Onay süresi: **5–15 iş günü**

### Kullanım
```
GET https://api.hepsiburada.com/v1/products/search?q=iphone&channel=web
X-Api-Key: {api_key}
```

---

## 3. Amazon Product Advertising API (PA API 5.0)

**Ne yapar:** Amazon.com.tr'deki fiyat, görsel, yorum sayısı, "En Çok Satan" rozeti.  
**Zorunluluk:** Amazon Associates hesabın **aktif satış üretmiş** olması gerekiyor (ilk 180 gün içinde 3 satış).

### Nasıl Alınır
1. https://affiliate-program.amazon.com.tr → "Hesap Oluştur"
2. Siteyi ekle: `fiyatavcisi.com.tr`
3. İlk 180 gün içinde affiliate linklerden **3 nitelikli satış** gerçekleştir  
   *(Şu an sitendeki affiliate kartlar bu süreci başlatıyor)*
4. Hesap aktif olduktan sonra: Associates Central → Araçlar → **Product Advertising API** → Key al

### Endpoint
```
POST https://webservices.amazon.com.tr/paapi5/searchitems
{
  "Keywords": "iphone 17",
  "Resources": ["Offers.Listings.Price", "Images.Primary.Large", "ItemInfo.Title"]
}
```

---

## 4. Pazarama / Çiçeksepeti API

**Ne yapar:** Geniş kategori yelpazesi, fiyat ve stok.

### Nasıl Alınır
1. https://pazarama.com/entegrasyon → Mağaza hesabı **zorunlu değil**, içerik API için ayrı başvuru var
2. İletişim: entegrasyon@pazarama.com — "Fiyat Karşılaştırma Sitesi" amacını belirt
3. Çiçeksepeti için: https://entegrasyon.ciceksepeti.com → genellikle satıcı hesabı isterler

---

## 5. İdeal Entegrasyon Mimarisi (Netlify Functions ile)

Mağaza API'lerini tarayıcıdan değil, **Netlify Function üzerinden** çağırman şart — hem API key güvenliği hem de CORS için.

```
[Kullanıcı Araması]
      ↓
[index.html → fetch('/api/search?q=iphone')]
      ↓
[netlify/functions/search.js]
      ├── Trendyol API çağrısı
      ├── Hepsiburada API çağrısı
      └── Amazon PA API çağrısı
      ↓
[Birleşik fiyat listesi → index.html]
```

**`netlify/functions/search.js` iskelet:**
```js
const https = require('https');

exports.handler = async (event) => {
  const q = event.queryStringParameters.q;
  
  // Paralel çağrı
  const [trendyol, hepsi] = await Promise.allSettled([
    fetchTrendyol(q),
    fetchHepsiburada(q),
  ]);

  const results = [
    ...(trendyol.value || []),
    ...(hepsi.value || []),
  ].sort((a, b) => a.price - b.price); // En ucuzdan pahalıya sırala

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300', // 5 dk cache
    },
    body: JSON.stringify(results),
  };
};
```

---

## 6. Ücretsiz Alternatif: Google Shopping RSS (Geçici)

Resmi API yokken test için kullanılabilir, **production'da önerilmez** (Terms of Service ihlali riski).

```
https://www.google.com/search?q=iphone+17&tbm=shop&output=rss
```

---

## 7. Fiyat Geçmişi İçin Mevcut Çözüm

Kendi veritabanı kurulmadan **CamelCamelCamel API** kullanılabilir (Amazon ürünleri için):
- https://camelcamelcamel.com/api — Ücretsiz, kayıt gerekiyor
- Amazon ASIN ile fiyat geçmişi JSON olarak döner
- Siteye halihazırda CamelCamelCamel bağlantısı var (Amazon kart üzerindeki "Fiyat Geçmişi" linki)

---

## 8. Öncelik Sırası

| Öncelik | API | Süre | Zorluk |
|---------|-----|------|--------|
| 🥇 1 | Trendyol İçerik API | 3–10 gün | Kolay |
| 🥈 2 | Hepsiburada HepsiBahçe | 5–15 gün | Kolay |
| 🥉 3 | Amazon PA API | Hat aktif olduktan sonra anında | Orta |
| 4 | CamelCamelCamel (fiyat geçmişi) | Hemen | Kolay |

---

*Son güncelleme: Şubat 2026*
