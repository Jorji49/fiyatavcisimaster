/**
 * /.netlify/functions/prices
 * Fiyat Çekme — Node.js (cheerio) ile gerçek fiyat çeker.
 *
 * ?q=iphone+16            →  {"TRENDYOL":{"min":...,"max":...,"count":...,"products":[...]},...}
 * ?stores=TRENDYOL,AMAZON →  sadece belirtilen mağazalar
 */

const cheerio = require('cheerio');

// ─── Sabitler ──────────────────────────────────────────
const STORE_TO_SITE = {
  TRENDYOL: 'trendyol',
  HEPSIBURADA: 'hepsiburada',
  AMAZON: 'amazon',
  N11: 'n11',
  TEKNOSA: 'teknosa',
  VATAN: 'vatan',
};

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

// ─── Yardımcı Fonksiyonlar ────────────────────────────
function temizleFiyat(text) {
  if (!text) return null;
  text = String(text).trim();
  text = text.replace(/[TLtl₺\s]/g, '');
  text = text.replace(/[^\d.,]/g, '');
  if (!text) return null;
  if (text.includes(',') && text.includes('.')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (text.includes(',')) {
    text = text.replace(',', '.');
  } else if (text.includes('.')) {
    const parts = text.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      text = text.replace('.', '');
    } else if (parts.length > 2) {
      text = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
  }
  const val = parseFloat(text);
  return val > 0 ? val : null;
}

async function sayfaGetir(url, extraHeaders = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...extraHeaders },
      signal: controller.signal,
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const html = await res.text();
    if (!html || html.length < 2000) return null;
    return html;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ─── TRENDYOL (JSON API) ───────────────────────────────
async function cekTrendyol(query) {
  const url = `https://apigw.trendyol.com/discovery-web-searchgw-service/v2/api/infinite-scroll/sr?q=${encodeURIComponent(query)}&pi=1&culture=tr-TR&userGenderId=1&pId=0&scoringAlgorithmId=2&categoryRelevancyEnabled=false&isLegalRequirementConfirmed=false&searchStrategyType=DEFAULT&productStampType=TypeA`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'application/json, text/plain, */*',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Origin': 'https://www.trendyol.com',
        'Referer': 'https://www.trendyol.com/',
      },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    const products = (data.result || {}).products || [];
    const urunler = [];
    for (const p of products.slice(0, 20)) {
      const priceObj = p.price || {};
      if (typeof priceObj !== 'object') continue;
      let fiyat = priceObj.discountedPrice || priceObj.sellingPrice || priceObj.originalPrice;
      let eski = priceObj.originalPrice;
      if (eski && fiyat && Math.abs(eski - fiyat) < 1) eski = null;

      let link = p.url || '';
      if (link && !link.startsWith('http')) link = `https://www.trendyol.com${link}`;

      if (fiyat && typeof fiyat === 'number') {
        urunler.push({
          baslik: p.name || 'Bilinmeyen Ürün',
          fiyat,
          eski_fiyat: eski || null,
          url: link,
          site: 'Trendyol',
        });
      }
    }
    return urunler;
  } catch {
    clearTimeout(timer);
    return [];
  }
}

// ─── HEPSİBURADA ──────────────────────────────────────
async function cekHepsiburada(query) {
  const url = `https://www.hepsiburada.com/ara?q=${encodeURIComponent(query)}`;
  const html = await sayfaGetir(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const urunler = [];

  // JSON-LD varsa dene
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      const items = Array.isArray(data) ? data : (data.itemListElement || []);
      for (const item of items.slice(0, 20)) {
        const itm = item.item || item;
        const offers = Array.isArray(itm.offers) ? itm.offers[0] : (itm.offers || {});
        const price = parseFloat(offers.price);
        if (price > 0 && itm.name) {
          let link = itm.url || '';
          if (link && !link.startsWith('http')) link = `https://www.hepsiburada.com${link}`;
          urunler.push({ baslik: itm.name, fiyat: price, url: link, site: 'Hepsiburada' });
        }
      }
    } catch { /* ignore */ }
  });
  if (urunler.length) return urunler;

  // HTML kart fallback
  const kartSelectors = [
    'article[class*="productCard"]',
    '[class*="productCard-module_article"]',
    'li[class*="productListContent"]',
    '[data-test-id="product-card-item"]',
  ];
  let kartlar = $([]);
  for (const sel of kartSelectors) {
    kartlar = $(sel);
    if (kartlar.length) break;
  }

  kartlar.slice(0, 20).each((_, kart) => {
    const k = $(kart);
    let baslik = null, link = null;
    for (const linkSel of ['a[href*="-p-"]', 'a[class*="product"]', 'a[href*="hepsiburada.com"]']) {
      const linkEl = k.find(linkSel);
      if (linkEl.length) {
        baslik = linkEl.attr('title') || linkEl.text().trim();
        if (!baslik || baslik.length <= 5) baslik = linkEl.text().trim();
        link = linkEl.attr('href') || '';
        if (link && !link.startsWith('http')) link = `https://www.hepsiburada.com${link}`;
        if (baslik && baslik.length > 5) break;
      }
    }

    let fiyat = null;
    for (const fSel of ['[class*="price-module_finalPrice"]', '[class*="productPrice"]', '[data-test-id="price-current-price"]', '[class*="price"]']) {
      const fEl = k.find(fSel);
      if (fEl.length) {
        fiyat = temizleFiyat(fEl.first().text());
        if (fiyat) break;
      }
    }

    if (baslik && fiyat) {
      urunler.push({ baslik, fiyat, url: link, site: 'Hepsiburada' });
    }
  });

  return urunler;
}

// ─── AMAZON.COM.TR ─────────────────────────────────────
async function cekAmazon(query) {
  const url = `https://www.amazon.com.tr/s?k=${encodeURIComponent(query)}`;
  const html = await sayfaGetir(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const urunler = [];

  const kartSelectors = [
    '[data-component-type="s-search-result"]',
    'div.s-result-item[data-asin]',
    '[data-asin]:not([data-asin=""])',
  ];
  let kartlar = $([]);
  for (const sel of kartSelectors) {
    kartlar = $(sel);
    if (kartlar.length) break;
  }

  kartlar.slice(0, 20).each((_, kart) => {
    const k = $(kart);
    let baslik = k.find('h2 span').first().text().trim();
    if (!baslik) baslik = k.find('h2').first().text().trim();
    if (!baslik) baslik = k.find('[class*="a-text-normal"]').first().text().trim();
    if (!baslik) return;

    let fiyat = temizleFiyat(k.find('.a-price .a-offscreen').first().text());
    if (!fiyat) {
      const whole = k.find('.a-price-whole').first().text().replace(/[.,]/g, '');
      const frac = k.find('.a-price-fraction').first().text();
      if (whole) fiyat = temizleFiyat(whole + (frac ? '.' + frac : ''));
    }
    if (!fiyat) {
      const priceEl = k.find('[class*="a-price"]').first();
      if (priceEl.length) fiyat = temizleFiyat(priceEl.text());
    }

    let link = k.find('h2 a').attr('href') || k.find('a.a-link-normal').attr('href') || '';
    if (link && !link.startsWith('http')) link = `https://www.amazon.com.tr${link}`;

    if (baslik && fiyat) {
      urunler.push({ baslik, fiyat, url: link, site: 'Amazon' });
    }
  });

  return urunler;
}

// ─── N11 ───────────────────────────────────────────────
async function cekN11(query) {
  const url = `https://www.n11.com/arama?q=${encodeURIComponent(query)}`;
  const html = await sayfaGetir(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const urunler = [];

  const kartSelectors = ['a.product-item', 'li.column[class*="product"]', '[class*="productItem"]'];
  let kartlar = $([]);
  for (const sel of kartSelectors) {
    kartlar = $(sel);
    if (kartlar.length) break;
  }

  kartlar.slice(0, 20).each((_, kart) => {
    const k = $(kart);
    let baslik = k.find('.product-item-title').first().text().trim();
    if (!baslik) baslik = k.find('h3').first().text().trim();

    let fiyat = temizleFiyat(k.find('.price-currency').first().text());
    if (!fiyat) fiyat = temizleFiyat(k.find('[class*="newPrice"]').first().text());
    if (!fiyat) fiyat = temizleFiyat(k.find('[class*="price"]').first().text());

    let link = k.attr('href') || k.find('a').attr('href') || '';
    if (link && !link.startsWith('http')) link = `https://www.n11.com${link}`;

    if (baslik && fiyat) {
      urunler.push({ baslik, fiyat, url: link, site: 'n11' });
    }
  });

  return urunler;
}

// ─── TEKNOSA ───────────────────────────────────────────
async function cekTeknosa(query) {
  const url = `https://www.teknosa.com/arama/?s=${encodeURIComponent(query)}`;
  const html = await sayfaGetir(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const urunler = [];

  // Yöntem 1: JSON-LD
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html());
      let items = [];
      if (Array.isArray(data)) items = data;
      else if (data && data['@type'] === 'ItemList') items = data.itemListElement || [];
      for (const item of items.slice(0, 20)) {
        const itm = item.item || item;
        let offers = itm.offers || {};
        if (Array.isArray(offers)) offers = offers[0] || {};
        const price = parseFloat(offers.price);
        if (price > 0) {
          let itemUrl = itm.url || '';
          if (itemUrl && !itemUrl.startsWith('http')) itemUrl = `https://www.teknosa.com${itemUrl}`;
          urunler.push({ baslik: itm.name || 'Bilinmeyen', fiyat: price, url: itemUrl, site: 'Teknosa' });
        }
      }
    } catch { /* ignore */ }
  });
  if (urunler.length) return urunler;

  // Yöntem 2: HTML fallback
  const kartSelectors = ['.product-card', '[class*="product-item"]', '[class*="ProductCard"]'];
  let kartlar = $([]);
  for (const sel of kartSelectors) {
    kartlar = $(sel);
    if (kartlar.length) break;
  }

  kartlar.slice(0, 20).each((_, kart) => {
    const k = $(kart);
    let baslik = k.find('.product-name').first().text().trim();
    if (!baslik) baslik = k.find('h3').first().text().trim();
    if (!baslik) baslik = k.find('[class*="name"]').first().text().trim();

    let fiyat = temizleFiyat(k.find('.product-price').first().text());
    if (!fiyat) fiyat = temizleFiyat(k.find('[class*="price"]').first().text());

    let link = k.find('a').attr('href') || '';
    if (link && !link.startsWith('http')) link = `https://www.teknosa.com${link}`;

    if (baslik && fiyat) {
      urunler.push({ baslik, fiyat, url: link, site: 'Teknosa' });
    }
  });

  return urunler;
}

// ─── VATAN BİLGİSAYAR ─────────────────────────────────
async function cekVatan(query) {
  const url = `https://www.vatanbilgisayar.com/arama/${encodeURIComponent(query)}/`;
  const html = await sayfaGetir(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const urunler = [];

  const kartSelectors = ['a.product-list-link', '[class*="product-list"] a', '.product-card'];
  let kartlar = $([]);
  for (const sel of kartSelectors) {
    kartlar = $(sel);
    if (kartlar.length) break;
  }

  kartlar.slice(0, 20).each((_, kart) => {
    const k = $(kart);
    let baslik = k.find('.product-list__product-name h3').first().text().trim();
    if (!baslik) baslik = k.find('h3').first().text().trim();
    if (!baslik) baslik = k.find('[class*="product-name"]').first().text().trim();

    let fiyat = temizleFiyat(k.find('.product-list__price').first().text());
    if (!fiyat) fiyat = temizleFiyat(k.find('[class*="price"]').first().text());

    let link = k.attr('href') || k.find('a').attr('href') || '';
    if (link && !link.startsWith('http')) link = `https://www.vatanbilgisayar.com${link}`;

    if (baslik && fiyat) {
      urunler.push({ baslik, fiyat, url: link, site: 'Vatan Bilgisayar' });
    }
  });

  return urunler;
}

// ─── Site haritası ─────────────────────────────────────
const SITE_FN = {
  trendyol: cekTrendyol,
  hepsiburada: cekHepsiburada,
  amazon: cekAmazon,
  n11: cekN11,
  teknosa: cekTeknosa,
  vatan: cekVatan,
};

// ─── Query Enrichment ──────────────────────────────────
function enrichQuery(q) {
  const ql = q.toLowerCase().trim();
  const qlNorm = ql.replace(/\+/g, ' plus ').replace(/\s+/g, ' ').trim();

  const enrichments = [
    [/(?:^|\b)(redmi|poco)/i, 'xiaomi', null],
    [/(?:^|\b)(pixel)/i, 'google', null],
    [/(?:^|\b)(oneplus|\bone\s*plus)/i, 'oneplus', null],
    [/(?:^|\b)(mate\s*\d|p\d{2}|nova)/i, 'huawei', null],
    [/(?:^|\b)(rtx|gtx)\s*\d/i, 'nvidia geforce', null],
    [/(?:^|\b)(rx\s*\d)/i, 'amd radeon', null],
    [/(?:^|\b)(s\d{2}|a\d{2}|z\s*fold|z\s*flip|m\d{2}|galaxy)/i, 'samsung', 'galaxy'],
  ];

  for (const [pattern, brand, series] of enrichments) {
    if (pattern.test(qlNorm)) {
      if (qlNorm.includes(brand)) {
        if (series && !qlNorm.includes(series)) {
          const parts = q.split(/\s+/);
          if (parts[0] && parts[0].toLowerCase() === brand) {
            return `${parts[0]} ${series} ${parts.slice(1).join(' ')}`;
          }
          return `${series} ${q}`;
        }
        return q;
      }
      if (series && qlNorm.includes(series)) return `${brand} ${q}`;
      const prefix = series ? `${brand} ${series}` : brand;
      return `${prefix} ${q}`;
    }
  }
  return q;
}

// ─── Aksesuar / İlgisiz Ürün Filtresi ─────────────────
const AKSESUAR_KELIMELERI = [
  'kilif', 'kapak', 'koruyucu', 'cam ', 'temperli',
  'kablo', 'sarj kablosu', 'adaptor', 'adapter',
  'kordon', 'aski', 'lens', 'kalem', 'tutucu', 'stand',
  'mount', 'case', 'cover', 'protector', 'charger', 'cable',
  'powerbank', 'power bank', 'canta', 'armor',
  'magsafe', 'wireless sarj', 'kulaklik kilif', 'airpods kilif',
  'sticker', 'skin', 'wrap', 'bant', 'yapistirici', 'temizleyici',
  'silikon', 'rubber', 'bumper', 'anti', 'aparatli',
  'ekran koruyucu', 'screen protector', 'crystal clear',
  'tam koruma', 'full protection',
];

const TR_MAP = { '\u0131': 'i', '\u0130': 'i', '\u00f6': 'o', '\u00d6': 'o', '\u00fc': 'u', '\u00dc': 'u', '\u015f': 's', '\u015e': 's', '\u00e7': 'c', '\u00c7': 'c', '\u011f': 'g', '\u011e': 'g' };

function normalize(text) {
  let t = text.toLowerCase();
  for (const [k, v] of Object.entries(TR_MAP)) t = t.replaceAll(k, v);
  t = t.replace(/\+/g, ' plus ');
  t = t.replace(/\bpro\s*max\b/g, 'promax');
  t = t.replace(/\blight\b/g, 'lite');
  t = t.replace(/[^a-z0-9\s]/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

const STOP_WORDS = new Set(['ile', 'icin', 'veya', 've', 'en', 'iyi', 'ucuz', 'fiyat']);

function buildFilter(originalQuery) {
  const normalizedQuery = normalize(originalQuery.trim());
  const queryWords = normalizedQuery.split(' ').filter(w => (w.length >= 2 || /^\d+$/.test(w)) && !STOP_WORDS.has(w));
  const kritikKelimeler = queryWords.filter(w => /\d/.test(w));
  const normalKelimeler = queryWords.filter(w => !/\d/.test(w));

  return function urunIlgiliMi(baslik) {
    if (!baslik) return false;
    const bn = normalize(baslik);

    for (const ak of AKSESUAR_KELIMELERI) {
      if (bn.includes(ak)) return false;
    }
    if (bn.includes('uyumlu') || bn.includes('compatible')) return false;

    for (const k of kritikKelimeler) {
      if (/^\d+$/.test(k)) {
        if (!new RegExp('\\b' + k + '\\b').test(bn)) return false;
      } else {
        if (!bn.includes(k)) return false;
      }
    }

    if (normalKelimeler.length) {
      const eslesen = normalKelimeler.filter(w => bn.includes(w)).length;
      const gerekli = Math.max(1, Math.floor(normalKelimeler.length * 2 / 3));
      if (eslesen < gerekli) return false;
    }

    return true;
  };
}

function medyanFiltre(fiyatlar) {
  if (fiyatlar.length < 3) return fiyatlar;
  const sira = [...fiyatlar].sort((a, b) => a - b);
  const medyan = sira[Math.floor(sira.length / 2)];
  return fiyatlar.filter(f => f >= medyan * 0.10 && f <= medyan * 10);
}

// ─── HANDLER ──────────────────────────────────────────
const SITE_KEY_MAP = {
  'Trendyol': 'TRENDYOL',
  'Hepsiburada': 'HEPSIBURADA',
  'Amazon': 'AMAZON',
  'n11': 'N11',
  'Teknosa': 'TEKNOSA',
  'Vatan Bilgisayar': 'VATAN',
};

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  const q = (event.queryStringParameters || {}).q || '';
  if (!q || q.trim().length < 2) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({}),
    };
  }

  const storeParam = (event.queryStringParameters || {}).stores || '';
  const requestedStores = storeParam
    ? storeParam.split(',').map(s => s.trim().toUpperCase()).filter(s => STORE_TO_SITE[s])
    : Object.keys(STORE_TO_SITE);

  const originalQuery = q.trim();
  const enriched = enrichQuery(originalQuery);
  const isIlgili = buildFilter(originalQuery);

  // Paralel olarak tüm siteleri çek
  const results = await Promise.allSettled(
    requestedStores.map(async (storeName) => {
      const siteName = STORE_TO_SITE[storeName];
      const fn = SITE_FN[siteName];
      if (!fn) return { store: storeName, products: [] };
      try {
        const products = await fn(enriched);
        return { store: storeName, products };
      } catch (err) {
        console.error(`${storeName} scraper error:`, err.message);
        return { store: storeName, products: [] };
      }
    })
  );

  // Sonuçları grupla, filtrele
  const output = {};
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const { store, products } = r.value;

    const filtered = products.filter(p => isIlgili(p.baslik));
    const prices = filtered.map(p => p.fiyat).filter(Boolean);
    const cleanPrices = medyanFiltre(prices);

    if (cleanPrices.length) {
      const minPrice = Math.min(...cleanPrices);
      const prods = filtered
        .filter(p => p.fiyat && p.fiyat >= minPrice)
        .sort((a, b) => (a.fiyat || Infinity) - (b.fiyat || Infinity))
        .slice(0, 5)
        .map(p => ({ title: p.baslik, price: p.fiyat, url: p.url }));

      output[store] = {
        min: Math.min(...cleanPrices),
        max: Math.max(...cleanPrices),
        count: cleanPrices.length,
        products: prods,
      };
    } else {
      output[store] = { min: null, max: null, count: 0, products: [] };
    }
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
    body: JSON.stringify(output),
  };
};
