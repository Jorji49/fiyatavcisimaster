/**
 * /.netlify/functions/search
 * FiyatAvcisi - SerpApi Google Shopping TR Arama Fonksiyonu
 *
 * Parametreler:
 * q: aranacak kelime (örn: "iphone 17")
 */

const https = require('https');

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
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
    const apiKey = process.env.SERPAPI_KEY;

    if (!apiKey) {
      console.warn("SERPAPI_KEY is not defined in environment variables. Returning empty array.");
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: "API Key missing", results: [] }),
      };
    }

    const url = `https://serpapi.com/search.json?engine=google_shopping&q=${encoded}&hl=tr&gl=tr&api_key=${apiKey}`;

    const parsed = await httpsGet(url);

    // Extract shopping results
    const results = (parsed.shopping_results || []).map(item => ({
      title: item.title,
      link: item.link,
      source: item.source,
      price: item.price,
      extracted_price: item.extracted_price,
      thumbnail: item.thumbnail,
      rating: item.rating || null,
      reviews: item.reviews || null,
      delivery: item.delivery || null
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
      body: JSON.stringify({ results }),
    };
  } catch (err) {
    console.error("Search function error:", err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: "Failed to fetch prices", details: err.message, results: [] }),
    };
  }
};
