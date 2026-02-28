/**
 * /.netlify/functions/prices
 * SerpApi Google Shopping proxy — Türkiye fiyatlarını çeker.
 *
 * ?q=iphone+17+pro  →  [{store,title,price,url,thumbnail}, ...]
 *
 * API Key: Netlify dashboard → Site settings → Environment variables → SERPAPI_KEY
 */

const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'Accept': 'application/json' },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(8000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Mağaza adını normalize et (eşleştirme için)
function normalizeStore(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\.com\.tr|\.com|\.tr/g, '')
    .replace(/[^a-z0-9çğıöşüÇĞİÖŞÜ]/gi, '')
    .trim();
}

// Bilinen mağaza eşleştirme haritası
const STORE_MAP = {
  'amazon': 'AMAZON',
  'amazoncomtr': 'AMAZON',
  'amazontr': 'AMAZON',
  'hepsiburada': 'HEPSIBURADA',
  'trendyol': 'TRENDYOL',
  'n11': 'N11',
  'mediamarkt': 'MEDIAMARKT',
  'teknosa': 'TEKNOSA',
  'vatan': 'VATAN',
  'vatanbilgisayar': 'VATAN',
  'itopya': 'ITOPYA',
  'incehesap': 'INCEHESAP',
  'sinerji': 'SINERJI',
  'troy': 'TROY',
  'troyestore': 'TROY',
  'superstep': 'SUPERSTEP',
  'sneaksup': 'SNEAKS UP',
  'sportive': 'SPORTIVE',
  'intersport': 'INTERSPORT',
  'decathlon': 'DECATHLON',
  'boyner': 'BOYNER',
  'dr': 'D&R',
  'kitapyurdu': 'KITAPYURDU',
  'bkmkitap': 'BKM KİTAP',
  'idefix': 'İDEFİX',
  'watsons': 'WATSONS',
  'gratis': 'GRATIS',
  'rossmann': 'ROSSMANN',
  'sephora': 'SEPHORA',
  'koctas': 'KOÇTAŞ',
  'bauhaus': 'BAUHAUS',
  'ikea': 'IKEA',
  'toyzzshop': 'TOYZZ SHOP',
  'peti': 'PETİ',
};

function matchStore(source) {
  const norm = normalizeStore(source);
  // Direkt eşleşme
  if (STORE_MAP[norm]) return STORE_MAP[norm];
  // Kısmi eşleşme
  for (const [key, val] of Object.entries(STORE_MAP)) {
    if (norm.includes(key) || key.includes(norm)) return val;
  }
  return null;
}

// TL fiyatı sayıya çevir
function parseTRY(priceStr) {
  if (!priceStr) return null;
  // "12.499,00 TL" veya "₺12.499" veya "12499.00 TRY" formatlarını destekle
  const cleaned = priceStr
    .replace(/[^\d.,]/g, '')
    .replace(/\.(\d{3})/g, '$1')  // binlik ayracı kaldır
    .replace(',', '.');            // ondalık ayracı
  const num = parseFloat(cleaned);
  return (num && num > 0 && num < 10000000) ? num : null;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  const q = (event.queryStringParameters || {}).q;
  if (!q || q.trim().length < 2) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify([]),
    };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'API key not configured' }),
    };
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: q.trim(),
      location: 'Turkey',
      hl: 'tr',
      gl: 'tr',
      num: '30',
      api_key: apiKey,
    });

    const url = `https://serpapi.com/search.json?${params.toString()}`;
    const data = await httpsGet(url);

    const results = [];
    const seenStores = new Set();

    // shopping_results ana sonuçları
    const items = data.shopping_results || [];
    for (const item of items) {
      const store = matchStore(item.source || '');
      const price = parseTRY(item.extracted_price != null ? String(item.extracted_price) : item.price);

      if (price) {
        const entry = {
          store: store,
          storeName: item.source || '',
          title: (item.title || '').substring(0, 120),
          price: price,
          priceFormatted: price.toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + ' TL',
          url: item.link || '',
          thumbnail: item.thumbnail || '',
        };

        // Bilinen mağaza başına sadece en düşük fiyatı al
        if (store) {
          if (!seenStores.has(store) || results.find(r => r.store === store)?.price > price) {
            results.push(entry);
            seenStores.add(store);
          }
        } else {
          results.push(entry);
        }
      }
    }

    // Fiyata göre sırala
    results.sort((a, b) => a.price - b.price);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // 30 dakika CDN cache + 2 saat stale-while-revalidate
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=7200',
      },
      body: JSON.stringify({
        query: q.trim(),
        count: results.length,
        results: results.slice(0, 20),
        lowest: results.length > 0 ? results[0] : null,
        timestamp: Date.now(),
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'fetch_failed', results: [] }),
    };
  }
};
