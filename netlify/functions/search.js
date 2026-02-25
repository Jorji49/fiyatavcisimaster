const https = require('https');

const RAPIDAPI_KEY = 'cff20d59acmsh970aa2dcb009325p1b3b3djsn0e21ab811c7f';
const HOST = 'real-time-product-search.p.rapidapi.com';

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

  const path = `/search-v2?q=${encodeURIComponent(q)}&country=tr&language=tr&page=1&limit=10&sort_by=BEST_MATCH&product_condition=ANY`;

  try {
    const { status, body } = await httpsGet(path);
    const data = JSON.parse(body);

    // Sadece gerekli alanları döndür (response boyutunu küçült)
    const products = (data.data && data.data.products) || [];
    const slim = products.slice(0, 8).map(p => ({
      title: p.product_title || '',
      image: (p.product_photos && p.product_photos[0]) || '',
      price: p.offer ? p.offer.price : (p.typical_price_range ? p.typical_price_range[0] : ''),
      listPrice: p.offer ? p.offer.list_price : '',
      store: p.offer ? p.offer.store_name : '',
      url: p.offer ? p.offer.offer_page_url : '',
      shipping: p.offer ? p.offer.shipping : '',
      condition: p.offer ? p.offer.condition : 'NEW'
    })).filter(p => p.url);

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
