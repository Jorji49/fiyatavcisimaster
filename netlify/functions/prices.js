/**
 * /.netlify/functions/prices
 * Fiyat Çekme — Scrapling Python tarayıcısı ile gerçek fiyat çeker.
 *
 * ?q=iphone+16  →  {"TRENDYOL":{"min":104999,"max":149949,"count":19,"products":[...]},...}
 * ?stores=TRENDYOL,AMAZON  →  sadece belirtilen mağazalar
 *
 * Tüm fiyatlar Scrapling kütüphanesi ile çekilir (aksesuar filtreleme dahil).
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');

// ─── Python yolu + Scraper yolu ───────────────────────
// Lokal: .venv\Scripts\python.exe   |  Prod: python3
function getPythonCmd() {
  const venvPy = path.join(__dirname, '..', '..', '.venv', 'Scripts', 'python.exe');
  try { fs.accessSync(venvPy); return venvPy; } catch { /* */ }
  const venvPyUnix = path.join(__dirname, '..', '..', '.venv', 'bin', 'python');
  try { fs.accessSync(venvPyUnix); return venvPyUnix; } catch { /* */ }
  // Netlify Linux runtime fallback sırası
  return process.env.PYTHON_BIN || 'python3';
}

function getPythonPath() {
  const depsDir = path.join(__dirname, '..', '..', 'python_deps');
  try {
    fs.accessSync(depsDir);
    return depsDir;
  } catch {
    return '';
  }
}

const SCRAPER_PATH = path.join(__dirname, '..', '..', 'scraper', 'fiyat_cek.py');

// Mağaza adı → Python scraper site adı
const STORE_TO_SITE = {
  TRENDYOL: 'trendyol',
  HEPSIBURADA: 'hepsiburada',
  AMAZON: 'amazon',
  N11: 'n11',
  TEKNOSA: 'teknosa',
  VATAN: 'vatan',
};

// ─── Python scraper çalıştır ──────────────────────────
function runScraper(query, sites, timeoutMs = 25000) {
  return new Promise((resolve, reject) => {
    const pythonCmd = getPythonCmd();
    const args = [SCRAPER_PATH, query, '--sites', sites, '--api'];

    const proc = execFile(pythonCmd, args, {
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,  // 5MB
      encoding: 'utf8',
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
        PYTHONPATH: [getPythonPath(), process.env.PYTHONPATH || ''].filter(Boolean).join(path.delimiter),
      },
    }, (err, stdout, stderr) => {
      // stdout'da JSON varsa başarılı say (stderr'de log olabilir)
      if (stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('{')) {
            try {
              const data = JSON.parse(trimmed);
              resolve(data);
              return;
            } catch { /* sonraki satıra bak */ }
          }
        }
      }
      // JSON bulunamadı
      if (err) {
        reject(new Error(`Scraper hata: ${err.message}`));
      } else {
        reject(new Error(`Scraper JSON çıktısı bulunamadı`));
      }
    });
  });
}

// ─── HANDLER ──────────────────────────────────────────
exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: '',
    };
  }

  const q = (event.queryStringParameters || {}).q || '';
  if (!q || q.trim().length < 2) {
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({}),
    };
  }

  // Hangi mağazalar istenmiş?
  const storeParam = (event.queryStringParameters || {}).stores || '';
  const requestedStores = storeParam
    ? storeParam.split(',').map((s) => s.trim().toUpperCase()).filter((s) => STORE_TO_SITE[s])
    : Object.keys(STORE_TO_SITE);

  // Python site isimlerine çevir
  const siteNames = requestedStores.map((s) => STORE_TO_SITE[s]).join(',');

  try {
    const data = await runScraper(q.trim(), siteNames);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    console.error('Prices scraper error:', err.message);
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ _error: err.message }),
    };
  }
};
