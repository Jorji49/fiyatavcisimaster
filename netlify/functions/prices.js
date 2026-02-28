/**
 * /.netlify/functions/prices
 * SerpApi Google Shopping proxy — Türkiye fiyatlarını çeker.
 *
 * ?q=iphone+17+pro  →  {query, count, results:[{store,title,price,...}], lowest}
 *
 * API Key: Netlify dashboard → Site settings → Environment variables → SERPAPI_KEY
 */

const https = require('https');

// Redirect destekli HTTPS GET (SerpApi 301/302 yapabiliyor)
function httpsGet(url, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 3;
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      // Redirect kontrolü
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        if (maxRedirects <= 0) return reject(new Error('too many redirects'));
        return httpsGet(res.headers.location, maxRedirects - 1).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed: ' + data.substring(0, 200))); }
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Bilinen mağaza eşleştirme haritası — value: sitenin MARKETS dizisindeki name (BÜYÜK HARF)
const STORE_MAP = {
  'amazon': 'AMAZON',
  'amazoncomtr': 'AMAZON',
  'amazontr': 'AMAZON',
  'amazontrkiye': 'AMAZON',
  'amazontürkiye': 'AMAZON',
  'hepsiburada': 'HEPSIBURADA',
  'hepsiburadacom': 'HEPSIBURADA',
  'trendyol': 'TRENDYOL',
  'trendyolcom': 'TRENDYOL',
  'n11': 'N11',
  'n11com': 'N11',
  'mediamarkt': 'MEDIAMARKT',
  'teknosa': 'TEKNOSA',
  'vatan': 'VATAN',
  'vatanbilgisayar': 'VATAN',
  'itopya': 'ITOPYA',
  'incehesap': 'INCEHESAP',
  'ciceksepeti': 'ÇİÇEKSEPETİ',
  'superstep': 'SUPERSTEP',
  'sneaksup': 'SNEAKS UP',
  'sportive': 'SPORTIVE',
  'intersport': 'INTERSPORT',
  'decathlon': 'DECATHLON',
  'boyner': 'BOYNER',
  'dr': 'D&R',
  'kitapyurdu': 'KITAPYURDU',
  'bkmkitap': 'BKM KİTAP',
  'watsons': 'WATSONS',
  'gratis': 'GRATIS',
  'rossmann': 'ROSSMANN',
  'sephora': 'SEPHORA',
  'koctas': 'KOÇTAŞ',
  'bauhaus': 'BAUHAUS',
  'ikea': 'IKEA',
  'toyzzshop': 'TOYZZ SHOP',
  'peti': 'PETİ',
  'pttavm': 'PTTAVM',
  'apple': 'APPLE',
};

function normalizeStore(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/\.com\.tr|\.com|\.tr/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .trim();
}

function matchStore(source) {
  if (!source) return null;
  const norm = normalizeStore(source);
  // Direkt eşleşme
  if (STORE_MAP[norm]) return STORE_MAP[norm];
  // Kısmi eşleşme
  for (const [key, val] of Object.entries(STORE_MAP)) {
    if (norm.includes(key) || (key.length > 3 && key.includes(norm))) return val;
  }
  // Eşleşemedi — ham kaynağı büyük harfle döndür
  return source.toUpperCase();
}

// Fiyatı sayıya çevir — SerpApi extracted_price sayı veya string olabilir
function parsePrice(val) {
  if (val == null) return null;
  if (typeof val === 'number') return val > 0 ? val : null;
  // String: "12.499,00 TL" veya "₺12.499" veya "12,499.00"
  const s = String(val);
  // Türk formatı: nokta binlik, virgül ondalık (12.499,00)
  if (/\d{1,3}\.\d{3}/.test(s) && s.includes(',')) {
    const cleaned = s.replace(/[^\d.,]/g, '').replace(/\./g, '').replace(',', '.');
    const num = parseFloat(cleaned);
    return (num > 0 && num < 10000000) ? num : null;
  }
  // US formatı veya sadece sayı
  const cleaned = s.replace(/[^\d.]/g, '');
  const num = parseFloat(cleaned);
  return (num > 0 && num < 10000000) ? num : null;
}

// TL formatlama
function formatTRY(num) {
  return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(num) + ' TL';
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
      body: JSON.stringify({ results: [] }),
    };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'SERPAPI_KEY not configured', results: [] }),
    };
  }

  try {
    const params = new URLSearchParams({
      engine: 'google_shopping',
      q: q.trim(),
      location: 'Turkey',
      hl: 'tr',
      gl: 'tr',
      num: '40',
      api_key: apiKey,
    });

    const url = 'https://serpapi.com/search.json?' + params.toString();
    const data = await httpsGet(url);

    // SerpApi hata kontrolü
    if (data.error) {
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: data.error, results: [] }),
      };
    }

    const results = [];
    const bestPerStore = {};
    const debugSources = [];

    const items = data.shopping_results || [];
    for (const item of items) {
      const storeName = matchStore(item.source || '');
      const price = parsePrice(item.extracted_price) || parsePrice(item.price);

      debugSources.push({ src: item.source, mapped: storeName, rawPrice: item.extracted_price || item.price });
      if (!price) continue;

      const entry = {
        store: storeName,
        source: item.source || '',
        title: (item.title || '').substring(0, 120),
        price: price,
        priceFormatted: formatTRY(price),
        url: item.link || item.product_link || '',
        thumbnail: item.thumbnail || '',
      };

      // Mağaza başına en düşük fiyatı tut
      if (storeName) {
        if (!bestPerStore[storeName] || bestPerStore[storeName].price > price) {
          bestPerStore[storeName] = entry;
        }
      }
      results.push(entry);
    }

    // Fiyata göre sırala
    results.sort((a, b) => a.price - b.price);
    // Mağaza başına en iyileri de sırala
    const storeResults = Object.values(bestPerStore).sort((a, b) => a.price - b.price);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=1800, stale-while-revalidate=7200',
      },
      body: JSON.stringify({
        query: q.trim(),
        count: results.length,
        totalFromApi: items.length,
        results: results.slice(0, 25),
        storeResults: storeResults,
        lowest: results.length > 0 ? results[0] : null,
        sources: debugSources.slice(0, 15),
        timestamp: Date.now(),
      }),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'fetch_failed: ' + err.message, results: [] }),
    };
  }
};
