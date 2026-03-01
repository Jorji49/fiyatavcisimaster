/**
 * /.netlify/functions/suggest
 * Google Arama Öneri Proxy'si — tarayıcıdan CORS nedeniyle direkt çağrılamaz,
 * ancak server üzerinden sorunsuz çalışır.
 *
 * ?q=iphone+17  →  ["iphone 17", ["iphone 17 fiyat", "iphone 17 pro", …]]
 */

const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FiyatAvcisi/1.0)',
        'Accept-Language': 'tr-TR,tr;q=0.9',
      },
    }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(data));
    }).on('error', reject);
    req.setTimeout(4000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  const q = (event.queryStringParameters || {}).q || '';
  if (!q || q.trim().length < 2) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify([]),
    };
  }

  try {
    const encoded = encodeURIComponent(q.trim());
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&hl=tr&q=${encoded}`;
    const raw = await httpsGet(url);
    const parsed = JSON.parse(raw);
    // parsed[1] => string[] of suggestions
    const suggestions = (parsed[1] || []).slice(0, 8);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
      body: JSON.stringify(suggestions),
    };
  } catch (err) {
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify([]),
    };
  }
};
