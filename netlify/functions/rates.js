/**
 * /.netlify/functions/rates
 * Döviz kuru proxy — fawazahmed0 API'den çeker, Netlify CDN'de 1 saat önbellekte tutar.
 * Frontend'in tarayıcıdan direkt çağırması yerine bu uç noktayı kullanması daha güvenilir:
 *  - CORS sorunu yok
 *  - Netlify CDN edge'de önbelleğe alınır → çok daha hızlı
 *  - Kaynak API çökerse son geçerli veriyi döndürebilir
 */

const https = require('https');

const SOURCE =
  'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json';

const FALLBACK = { usd_try: 38.5, eur_try: 41.8, gbp_try: 49.2 };

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'Accept': 'application/json' } }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('JSON parse failed')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(4000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { 'Access-Control-Allow-Origin': '*' }, body: '' };
  }

  try {
    const d = await httpsGet(SOURCE);
    const rates = {
      usd_try: parseFloat(d.usd.try.toFixed(4)),
      eur_try: parseFloat(((1 / d.usd.eur) * d.usd.try).toFixed(4)),
      gbp_try: parseFloat(((1 / d.usd.gbp) * d.usd.try).toFixed(4)),
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // Netlify CDN'de 1 saat önbellekle, 24 saat stale-while-revalidate
        'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
      },
      body: JSON.stringify(rates),
    };
  } catch (err) {
    // API çökerse sabit fallback döndür
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
      },
      body: JSON.stringify(FALLBACK),
    };
  }
};
