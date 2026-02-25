const https = require('https');

const RAPIDAPI_KEY = 'cff20d59acmsh970aa2dcb009325p1b3b3djsn0e21ab811c7f';
const HOST = 'real-time-product-search.p.rapidapi.com';

// Kabul edilen Türk mağazaları
const TR_STORES = [
  'trendyol','hepsiburada','n11','mediamarkt','vatan','teknosa',
  'itopya','incehesap','sinerji','troy','ciceksepeti','çiçeksepeti',
  'morhipo','boyner','carrefoursa','a101','gratis','watsons','sephora',
  'rossmann','kitapyurdu','idefix','d&r','bkm','toyzz','decathlon',
  'intersport','sportive','superstep','sneaks','lcwaikiki','lcw',
  'garantili','amazon','migros','peti'
];

// Aksesuar / alakasız ürün kelimeleri (tam kelime eşleşmesi yapılacaklar * ile işaretli)
const EXCLUDE_WORDS = [
  'kılıf','case','cover','koruyucu','ekran koruyucu','ekran filmi',
  'temperli cam','cam filmi','silikon','arka kapak',
  'şarj aleti','şarj kablosu','adaptör','adapter','charger',
  'askı','strap','kayış','tutucu','mount','holder',
  'kol bandı','bileklik','dock','hub',
  'temizleme','temizlik','cleaning',
  'mouse pad','mousepad'
];

// Tam kelime sınırıyla eşleşmesi gereken kelimeler (kablo ama kablosuz değil, stand ama standard değil, band ama bandı farklı)
const EXCLUDE_EXACT = ['kablo','cable','usb','stand','band'];

function matchesExcludeExact(title) {
  for (const w of EXCLUDE_EXACT) {
    // Kelimenin kendisi geçmeli ama daha uzun bir kelimenin parçası olmamalı
    const re = new RegExp('(^|[\\s,;.!?/\\-_()])' + w + '($|[\\s,;.!?/\\-_()sı])', 'i');
    if (re.test(title)) return true;
  }
  return false;
}

// Model varyant kelimeleri (uzundan kısaya sıralı)
const MODEL_VARIANTS = ['pro max','fan edition','pro','plus','max','ultra','air','edge','lite','fe'];

function isTurkishStore(storeName) {
  if (!storeName) return false;
  const s = storeName.toLowerCase();
  return TR_STORES.some(ts => s.includes(ts));
}

function isRelevant(title, query) {
  const t = title.toLowerCase();
  const q = query.toLowerCase();

  for (const w of EXCLUDE_WORDS) {
    if (t.includes(w)) return false;
  }

  if (matchesExcludeExact(t)) return false;

  // Model kesinliği: sorgu rakam içeriyorsa sorguda olmayan varyantları engelle
  const hasNumber = /\d/.test(q);
  if (hasNumber) {
    for (const v of MODEL_VARIANTS) {
      const queryHasVariant = q.includes(v);
      const titleHasVariant = t.includes(v);
      if (!queryHasVariant && titleHasVariant) return false;
    }
  }

  return true;
}

function httpsGet(path) {
  return new Promise((resolve, reject) => {
    let body = '';
    const req = https.get(
      { hostname: HOST, path, headers: { 'x-rapidapi-host': HOST, 'x-rapidapi-key': RAPIDAPI_KEY } },
      res => {
        res.on('data', c => body += c);
        res.on('end', () => resolve({ status: res.statusCode, body }));
      }
    );
    req.on('error', reject);
    req.setTimeout(9000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

exports.handler = async (event) => {
  const q = (event.queryStringParameters && event.queryStringParameters.q) || '';
  if (!q.trim()) {
    return { statusCode: 400, body: JSON.stringify({ error: 'q parametresi gerekli' }) };
  }

  const path = '/search-v2?q=' + encodeURIComponent(q) + '&country=tr&language=tr&page=1&limit=30&sort_by=BEST_MATCH&product_condition=ANY';

  try {
    const { body } = await httpsGet(path);
    const data = JSON.parse(body);
    const products = (data.data && data.data.products) || [];

    const slim = products
      .filter(p => p.offer && p.offer.offer_page_url)
      .filter(p => isTurkishStore(p.offer.store_name))
      .filter(p => isRelevant(p.product_title || '', q))
      .slice(0, 20)
      .map(p => ({
        title: p.product_title || '',
        image: (p.product_photos && p.product_photos[0]) || '',
        price: p.offer ? p.offer.price : '',
        listPrice: p.offer ? p.offer.list_price : '',
        store: p.offer ? p.offer.store_name : '',
        url: p.offer ? p.offer.offer_page_url : '',
        shipping: p.offer ? p.offer.shipping : ''
      }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600'
      },
      body: JSON.stringify({ ok: true, products: slim })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ ok: false, error: err.message })
    };
  }
};
