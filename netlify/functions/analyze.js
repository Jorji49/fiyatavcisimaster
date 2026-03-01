/**
 * /.netlify/functions/analyze
 * E-ticaret Güvenlik & NLP Analisti
 *
 * POST body: { url: string, reviews: string }
 *
 * Görevler:
 *  1. URL Siber Güvenlik Analizi — phishing, typosquatting, şüpheli TLD
 *  2. Türkçe Duygu Analizi (Sentiment) — pozitif/negatif odak tespiti
 *  3. Kronik Sorun & Bot Yorum Tespiti
 *  4. Nihai Tavsiye Kararı (sonuc_karari)
 *
 * Çıktı: Sadece JSON (açıklama veya markdown yok)
 */

// ─── Güvenilir Türk E-ticaret Domainleri ────────────────────────────────────
const LEGIT_DOMAINS = [
  'amazon.com.tr','amazon.com','hepsiburada.com','trendyol.com','n11.com',
  'gittigidiyor.com','ciceksepeti.com','mediamarkt.com.tr','teknosa.com',
  'vatanbilgisayar.com','vatan.com','boyner.com.tr','zara.com',
  'migros.com.tr','a101.com.tr','bim.com.tr','lcw.com','defacto.com.tr',
  'koton.com','watsons.com.tr','gratis.com.tr','rossmann.com.tr',
  'sephora.com.tr','idefix.com','kitapyurdu.com','bkmkitap.com','dr.com.tr',
  'sinerji.gen.tr','itopya.com','incehesap.com','akakce.com','cimri.com',
  'epey.com','superstep.com.tr','sportive.com.tr','intersport.com.tr',
  'decathlon.com.tr','koctas.com.tr','bauhaus.com.tr','ikea.com.tr',
  'toyzzshop.com','peti.com.tr','shopier.com','etsy.com','ebay.com',
  'apple.com','samsung.com','xiaomi.com','nike.com','adidas.com',
  'monsternotebook.com.tr','lenovo.com','asus.com','msi.com','logitech.com',
  'dyson.com.tr','philips.com.tr','troyestore.com','sneaksup.com',
  'morhipo.com','vivense.com','toyzz.com'
];

// ─── Şüpheli TLD'ler ─────────────────────────────────────────────────────────
const SUSPICIOUS_TLDS = [
  '.xyz','.info','.biz','.tk','.ml','.ga','.cf','.gq','.pw',
  '.cc','.top','.click','.link','.online','.site','.store','.shop'
];

// ─── Bilinen Marka Phishing Kalıpları ────────────────────────────────────────
const PHISHING_PATTERNS = [
  {
    legit: 'trendyol',
    bad: ['trendy0l','trendyyol','trendyool','tr3ndyol','trendyol-indirim',
          'indirimtrendyol','trendyol.net','trendyol.info','trendyol.biz']
  },
  {
    legit: 'hepsiburada',
    bad: ['hepsib0rada','hepsiburadaa','hepsi-burada','hepsiburade',
          'hepsibur4da','hepsiburada.net','hepsiburada.info']
  },
  {
    legit: 'amazon',
    bad: ['arnazon','amazom','amazonn','arnaz0n','amaz0n','amazon-tr',
          'amazonn.com','amazon.net','amazon-kampanya','amazon-fiyat']
  },
  {
    legit: 'n11',
    bad: ['nll.com','n-11.com','n11-indirim','n1l.com','nl1.com']
  },
  {
    legit: 'gittigidiyor',
    bad: ['gittigidiyorr','gittigidiy0r','gitti-gidiyor']
  }
];

// ─── URL Kısaltıcılar ─────────────────────────────────────────────────────────
const URL_SHORTENERS = [
  'bit.ly','tinyurl.com','ow.ly','goo.gl','shorturl.at','cutt.ly','t.co','rb.gy'
];

// ─── Türkçe Pozitif Anahtar Kelimeler (ağırlıklı) ────────────────────────────
const POSITIVE_KEYWORDS = {
  'orijinal':3,'orjinal':3,'gerçek ürün':4,'orjinal ürün':4,'orijinal ürün':4,
  'harika':3,'mükemmel':3,'süper':2,'muhteşem':3,'olağanüstü':3,
  'kaliteli':3,'kalite':2,'sağlam':2,'dayanıklı':2,
  'hızlı kargo':3,'hızlı teslimat':3,'zamanında geldi':3,'dakik teslimat':3,
  'fotoğraftaki gibi':4,'açıklamaya uygun':4,'aynen göründüğü gibi':3,
  'memnun':2,'memnunum':3,'tavsiye ederim':3,'kesinlikle alın':3,
  'güzel':2,'beğendim':2,'iyi':1,'fiyatına göre iyi':2,'paranın değeri':2,
  'uygun fiyat':2,'kullanışlı':2,'pratik':2,'kolay kurulum':2,
  'çok iyi':3,'tam puan':3,'5 yıldız':3,'beş yıldız':3
};

// ─── Türkçe Negatif Anahtar Kelimeler (ağırlıklı) ────────────────────────────
const NEGATIVE_KEYWORDS = {
  'sahte':5,'çakma':5,'taklit':5,'replika':4,'kopya ürün':5,'fake':5,
  'kırık geldi':4,'kırık':3,'hasar':3,'hasarlı':4,'çizik':3,
  'bozuk':4,'arızalı':4,'çalışmıyor':4,
  'iade ettim':4,'iade sorunu':4,'iade yapamadım':5,'iade reddedildi':5,
  'iade':3,'para iadesi':3,
  'geç kargo':3,'kargo problemi':4,'geç geldi':3,'gecikmeli':3,'kayboldu':4,
  'dolandırıcı':5,'dolandırıldım':5,'dolandırma':5,
  'berbat':4,'kötü':3,'rezalet':5,'korkunç':4,
  'açıklama farklı':4,'fotoğraf farklı':4,'yanıltıcı':4,
  'müşteri hizmetleri kötü':3,'çözüm yok':3,'ilgilenilmedi':3,
  'parça eksik':4,'eksik geldi':4,'yanlış ürün':4
};

// ─── Kronik Sorun Tetikleyiciler ─────────────────────────────────────────────
const CHRONIC_TRIGGERS = [
  'iade','sahte','çakma','kırık','bozuk','dolandı','geç kargo',
  'kargo problemi','hasarlı','fotoğraf farklı','açıklama farklı',
  'sahte ürün','kopya','replika'
];

// ─── Bot Yorum Kalıpları ──────────────────────────────────────────────────────
const BOT_PATTERNS = [
  /^(çok güzel|harika|teşekkürler?|mükemmel|süper)[.!]?$/i,
  /^(5 yıldız|beş yıldız|tam puan)[.!]?$/i,
  /^(iyi|güzel|ok|okay|tamam)[.!]?$/i,
  /^(teşekkür(ler)?|sağ ol(un)?)[.!]?$/i,
  /^(aldım|geldi|güzel geldi)[.!]?$/i
];

// ─── Yardımcı: Levenshtein Mesafesi ──────────────────────────────────────────
function levenshtein(a, b) {
  const dp = Array.from({ length: b.length + 1 }, (_, i) => [i]);
  for (let j = 0; j <= a.length; j++) dp[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      dp[i][j] = b[i-1] === a[j-1]
        ? dp[i-1][j-1]
        : Math.min(dp[i-1][j-1]+1, dp[i][j-1]+1, dp[i-1][j]+1);
    }
  }
  return dp[b.length][a.length];
}

// ─── Yardımcı: Domain Çıkart ─────────────────────────────────────────────────
function extractDomain(rawUrl) {
  try {
    const u = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return rawUrl.toLowerCase()
      .replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split('?')[0];
  }
}

// ─── 1. URL Güvenlik Analizi ──────────────────────────────────────────────────
function analyzeUrl(rawUrl) {
  const warnings = [];
  let score = 50;

  if (!rawUrl || rawUrl.trim().length < 4) {
    return {
      guven_skoru: 50,
      risk_seviyesi: 'Orta',
      guvenlik_uyarilari: ['URL girilmedi veya geçersiz, analiz tamamlanamadı.']
    };
  }

  const domain   = extractDomain(rawUrl.trim());
  const tldMatch = domain.match(/(\.[a-z]{2,6})+$/);
  const tld      = tldMatch ? tldMatch[0] : '';
  const domainName = domain.replace(/(\.[a-z]{2,6})+$/, '');

  // A) Whitelist kontrolü
  const isWhitelisted = LEGIT_DOMAINS.includes(domain)
    || LEGIT_DOMAINS.some(d => domain === d || domain.endsWith('.'+d));

  if (isWhitelisted) {
    score += 40;
  } else {
    warnings.push(`"${domain}" adresi bilinen güvenilir Türk e-ticaret domainleri listesinde bulunamadı.`);
    score -= 5;
  }

  // B) Şüpheli TLD
  if (SUSPICIOUS_TLDS.some(st => tld.endsWith(st))) {
    warnings.push(`Şüpheli alan adı uzantısı tespit edildi (${tld}). Bu uzantılar sıklıkla sahte sitelerde kullanılır.`);
    score -= 30;
  }

  // C) IP adresi
  if (/^\d{1,3}(\.\d{1,3}){3}/.test(domain)) {
    warnings.push('Alan adı yerine IP adresi kullanılıyor. Bu ciddi bir oltalama (phishing) işaretidir!');
    score -= 40;
  }

  // D) Phishing kalıp eşleşmesi
  for (const pp of PHISHING_PATTERNS) {
    if (pp.bad.some(p => domain.includes(p.split('.')[0]) && !domain.includes(pp.legit))) {
      warnings.push(`"${pp.legit}" markasını taklit eden oltalama adresi tespit edildi: "${domain}"`);
      score -= 50;
      break;
    }
  }

  // E) Typosquatting tespiti (Levenshtein)
  const knownBrands = ['amazon','hepsiburada','trendyol','n11','gittigidiyor','mediamarkt','teknosa'];
  const domainBase = domainName.split('-')[0];
  for (const brand of knownBrands) {
    const dist = levenshtein(domainBase.toLowerCase(), brand);
    if (dist > 0 && dist <= 2 && domainBase.length >= brand.length - 2) {
      warnings.push(`"${brand}" markasına çok benzeyen şüpheli domain: "${domain}" (tipografik hata riski).`);
      score -= 35;
      break;
    }
  }

  // F) URL kısaltıcı
  if (URL_SHORTENERS.some(s => domain.includes(s))) {
    warnings.push('Kısaltılmış URL tespit edildi. Gerçek hedef adresi görülemiyor, dikkatli olun!');
    score -= 20;
  }

  // G) Aşırı tire
  const hyphens = (domainName.match(/-/g) || []).length;
  if (hyphens >= 2) {
    warnings.push(`Alan adında çok fazla tire (-) işareti var: "${domain}". Sahte sitelerde yaygın bir taktiktir.`);
    score -= 15;
  }

  // H) Kandırmaya yönelik kelimeler
  const trapWords = ['indirim','kampanya','ucuz','bedava','satisonline','giveaway','ozel-teklif'];
  const foundTrap = trapWords.find(w => domainName.toLowerCase().includes(w));
  if (foundTrap) {
    warnings.push(`Domain adında "${foundTrap}" kelimesi var. Meşru firmalar resmi URL'lerine bu kelimeleri eklemez.`);
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));

  let risk;
  if      (score >= 75) risk = 'Düşük';
  else if (score >= 50) risk = 'Orta';
  else if (score >= 25) risk = 'Yüksek';
  else                  risk = 'Kritik';

  return { guven_skoru: score, risk_seviyesi: risk, guvenlik_uyarilari: warnings };
}

// ─── 2. Duygu & NLP Analizi ──────────────────────────────────────────────────
function analyzeReviews(reviewsText) {
  const empty = {
    olumlu_odak: [],
    olumsuz_odak: [],
    kronik_sorun_var_mi: false,
    bot_yorum_suphesi: false
  };

  if (!reviewsText || reviewsText.trim().length < 10) return empty;

  // Pozitif skor hesapla
  const posScores = {};
  for (const [kw, w] of Object.entries(POSITIVE_KEYWORDS)) {
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    const m = (reviewsText.match(re) || []).length;
    if (m > 0) posScores[kw] = m * w;
  }

  // Negatif skor hesapla
  const negScores = {};
  for (const [kw, w] of Object.entries(NEGATIVE_KEYWORDS)) {
    const re = new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    const m = (reviewsText.match(re) || []).length;
    if (m > 0) negScores[kw] = m * w;
  }

  const topPos = Object.entries(posScores).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);
  const topNeg = Object.entries(negScores).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([k])=>k);

  // Kronik sorun tespiti
  let chronicCount = 0;
  for (const trigger of CHRONIC_TRIGGERS) {
    const re = new RegExp(trigger.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'), 'gi');
    if ((reviewsText.match(re) || []).length >= 2) chronicCount++;
  }
  const kronik = chronicCount >= 2;

  // Bot tespiti
  const lines = reviewsText.split('\n').filter(l => l.trim().length > 0);
  let shortCount=0, botCount=0, duplicates=0;
  const seen = new Set();
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 15) shortCount++;
    if (BOT_PATTERNS.some(p => p.test(t))) botCount++;
    const norm = t.toLowerCase().replace(/\s+/g,' ');
    if (seen.has(norm)) duplicates++;
    else seen.add(norm);
  }
  const botSuspicion = lines.length > 0 && (
    (shortCount / lines.length > 0.5) ||
    (botCount / lines.length > 0.4)   ||
    (duplicates >= 2)
  );

  return {
    olumlu_odak: topPos,
    olumsuz_odak: topNeg,
    kronik_sorun_var_mi: kronik,
    bot_yorum_suphesi: botSuspicion
  };
}

// ─── 3. Nihai Karar ───────────────────────────────────────────────────────────
function buildVerdict(urlAnalysis, reviewAnalysis) {
  const { guven_skoru: score, risk_seviyesi: risk, guvenlik_uyarilari: warnings } = urlAnalysis;
  const { kronik_sorun_var_mi: kronik, bot_yorum_suphesi: bot } = reviewAnalysis;

  const isPhishing = warnings.some(w =>
    w.toLowerCase().includes('oltalama') ||
    w.toLowerCase().includes('phishing') ||
    w.toLowerCase().includes('taklit')
  );

  if (isPhishing || score < 25) {
    return 'Bu URL yüksek riskli oltalama (phishing) belirtileri taşıdığından ödeme bilgilerinizi KESİNLİKLE paylaşmayın ve bu kaynaktan satın ALMAYIN.';
  }
  if (risk === 'Kritik') {
    return 'URL ve satıcı analizi kritik güvenlik riskleri gösteriyor; bu platform üzerinden alışveriş yapmanızı önermiyoruz.';
  }
  if (risk === 'Yüksek' && kronik) {
    return 'Hem satıcı güvenilirliği hem de kronik müşteri şikayetleri yüksek risk işaret ediyor; bu satıcıdan alışveriş yapmamanızı öneriyoruz.';
  }
  if (risk === 'Yüksek') {
    return 'Satıcı güvenilirliği düşük görünüyor; güvenilir ve tanınmış bir platformdan satın almayı değerlendirin.';
  }
  if (kronik && bot) {
    return 'Kronik ürün sorunları ve sahte yorum şüphesi mevcut; başka satıcı ve platformları araştırmanızı kesinlikle tavsiye ederiz.';
  }
  if (kronik) {
    return 'Müşteri yorumlarında kronik sorunlar (iade/sahtecilik/hasar) gözlemleniyor; alışveriş öncesi daha fazla kaynak araştırmanızı öneririz.';
  }
  if (bot) {
    return 'Yorumların önemli bir kısmı bot/sahte görünüyor; yalnızca bu yorumlara güvenmeyerek başka platformlardaki değerlendirmeleri de inceleyin.';
  }
  if (score >= 75) {
    return 'Satıcı ve URL güvenilir görünüyor, alışverişinizi güvenle tamamlayabilirsiniz.';
  }
  return 'Satıcı orta düzeyde güvenilir; resmi platformlarla fiyat karşılaştırması yaparak alışveriş yapmanızı öneririz.';
}

// ─── Rate Limiting (in-memory, per IP, 15 istek/dk) ─────────────────────────
const _rl = new Map();
function checkRateLimit(ip) {
  const now = Date.now();
  const WINDOW = 60000;
  const LIMIT = 15;
  const rec = _rl.get(ip);
  if (!rec || now > rec.reset) { _rl.set(ip, { count: 1, reset: now + WINDOW }); return true; }
  if (rec.count >= LIMIT) return false;
  rec.count++;
  return true;
}

// ─── Lambda Handler ───────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: ''
    };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  const clientIp = ((event.headers['x-forwarded-for'] || '').split(',')[0].trim())
                || event.headers['client-ip'] || 'unknown';
  if (!checkRateLimit(clientIp)) {
    return { statusCode: 429, headers: corsHeaders, body: JSON.stringify({ error: 'Çok fazla istek. Lütfen bir dakika bekleyin.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Geçersiz JSON gövdesi.' }) };
  }

  const { url = '', reviews = '' } = body;

  const urlResult    = analyzeUrl(url);
  const reviewResult = analyzeReviews(reviews);
  const verdict      = buildVerdict(urlResult, reviewResult);

  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify({
      satici_analizi:       urlResult,
      urun_yorumlari_ozeti: reviewResult,
      sonuc_karari:         verdict
    })
  };
};
