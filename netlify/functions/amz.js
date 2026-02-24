/**
 * Netlify Function: /.netlify/functions/amz
 * Amazon Product Advertising API v5 (PA API) proxy
 *
 * Query params:
 *   kw  — search keyword (required)
 *
 * Env vars (set in Netlify dashboard → Site configuration → Environment variables):
 *   AMZ_ACCESS_KEY   — PA API access key ID
 *   AMZ_SECRET_KEY   — PA API secret access key
 *   AMZ_PARTNER_TAG  — Associates store ID (e.g. fiyatavcisi-21)
 */

const crypto = require('crypto');
const https = require('https');

const REGION = 'eu-west-1';
const HOST = 'webservices.amazon.com.tr';
const MARKETPLACE = 'www.amazon.com.tr';
const PATH = '/paapi5/searchitems';
const TARGET = 'com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems';
const SERVICE = 'ProductAdvertisingAPI';
const CACHE_TTL = 3600; // 1 hour browser cache

/* ── AWS Signature V4 helpers ─────────────────────────────── */
const hmac = (key, data, enc) =>
  crypto.createHmac('sha256', key).update(data, 'utf8').digest(enc);

const sha256 = (data) =>
  crypto.createHash('sha256').update(data, 'utf8').digest('hex');

function buildSignedHeaders(accessKey, secretKey, payload) {
  const now = new Date();
  // Format: 20260224T120000Z
  const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateStamp = amzDate.substring(0, 8);

  const reqHeaders = {
    'content-encoding': 'amz-1.0',
    'content-type': 'application/json; charset=utf-8',
    'host': HOST,
    'x-amz-date': amzDate,
    'x-amz-target': TARGET,
  };

  // Sort header keys alphabetically (required by Sig V4)
  const sortedKeys = Object.keys(reqHeaders).sort();
  const canonicalHeaders = sortedKeys.map(k => `${k}:${reqHeaders[k]}\n`).join('');
  const signedHeaders = sortedKeys.join(';');

  const payloadHash = sha256(payload);

  const canonicalRequest = [
    'POST', PATH, '',
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');

  // Derive signing key
  const kDate    = hmac(Buffer.from('AWS4' + secretKey), dateStamp);
  const kRegion  = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  const kSigning = hmac(kService, 'aws4_request');
  const signature = hmac(kSigning, stringToSign, 'hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  return { ...reqHeaders, 'Authorization': authorization };
}

/* ── HTTPS helper ─────────────────────────────────────────── */
function httpsPost(host, path, headers, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, path, method: 'POST', headers },
      (res) => {
        let data = '';
        res.on('data', c => (data += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
          catch (e) { reject(new Error(`JSON parse error: ${data.substring(0, 200)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/* ── Handler ──────────────────────────────────────────────── */
exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  const kw = (event.queryStringParameters || {}).kw;
  if (!kw || kw.trim().length < 1) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing kw param' }) };
  }

  const ACCESS_KEY  = process.env.AMZ_ACCESS_KEY;
  const SECRET_KEY  = process.env.AMZ_SECRET_KEY;
  const PARTNER_TAG = process.env.AMZ_PARTNER_TAG;

  if (!ACCESS_KEY || !SECRET_KEY || !PARTNER_TAG) {
    return {
      statusCode: 503,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'API credentials not configured' }),
    };
  }

  const requestBody = JSON.stringify({
    Keywords: kw.trim(),
    Marketplace: MARKETPLACE,
    PartnerTag: PARTNER_TAG,
    PartnerType: 'Associates',
    Resources: [
      'ItemInfo.Title',
      'Offers.Listings.Price',
      'Images.Primary.Medium',
      'DetailPageURL',
    ],
    SearchIndex: 'All',
    ItemCount: 5,
  });

  try {
    const signedHeaders = buildSignedHeaders(ACCESS_KEY, SECRET_KEY, requestBody);
    const response = await httpsPost(HOST, PATH, signedHeaders, requestBody);

    if (response.status !== 200) {
      const errMsg = response.body?.Errors?.[0]?.Message || `HTTP ${response.status}`;
      return {
        statusCode: 502,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ error: errMsg }),
      };
    }

    const items = (response.body.SearchResult?.Items || []).map(item => ({
      asin:  item.ASIN,
      title: item.ItemInfo?.Title?.DisplayValue || '',
      price: item.Offers?.Listings?.[0]?.Price?.DisplayAmount || null,
      image: item.Images?.Primary?.Medium?.URL || null,
      url:   item.DetailPageURL || `https://www.amazon.com.tr/s?k=${encodeURIComponent(kw)}&tag=${PARTNER_TAG}`,
    }));

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        // Cache 1 hour on CDN, 30 min revalidation
        'Cache-Control': `public, max-age=${CACHE_TTL}, stale-while-revalidate=1800`,
      },
      body: JSON.stringify(items),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message }),
    };
  }
};
