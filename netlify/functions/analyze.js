/**
 * /.netlify/functions/analyze  (v3  2026-03)
 * E-ticaret Güvenlik, Yorum Otomatik Çekme & NLP Analisti
 *
 * POST body: { url: string }
 *
 * Özellikler:
 *  1. URL Siber Güvenlik Analizi  phishing, typosquatting, HTTPS kontrolü
 *  2. Otomatik Yorum Çekme      Trendyol, Hepsiburada, n11, generic JSON-LD
 *  3. Türkçe Duygu Analizi      sentiment %, konu etiketleri, puan dağılımı
 *  4. Bot Yorum Tespiti         yineleme, kısa yorum, kalıp bazlı
 *  5. Nihai Tavsiye Kararı      güven skoru + yorum kalitesi birleşimi
 */

const LEGIT_DOMAINS = [
  'amazon.com.tr','amazon.com','hepsiburada.com','trendyol.com','n11.com',
  'gittigidiyor.com','ciceksepeti.com','mediamarkt.com.tr','teknosa.com',
  'vatanbilgisayar.com','vatan.com','boyner.com.tr','zara.com',
  'migros.com.tr','a101.com.tr','bim.com.tr','lcw.com','defacto.com.tr',
  'koton.com','watsons.com.tr','gratis.com.tr','rossmann.com.tr',
  'sephora.com.tr','idefix.com','kitapyurdu.com','bkmkitap.com','dr.com.tr',
  'itopya.com','incehesap.com','akakce.com','cimri.com','epey.com',
  'superstep.com.tr','sportive.com.tr','intersport.com.tr',
  'decathlon.com.tr','koctas.com.tr','bauhaus.com.tr','ikea.com.tr',
  'toyzzshop.com','peti.com.tr','shopier.com','etsy.com','ebay.com',
  'apple.com','samsung.com','xiaomi.com','nike.com','adidas.com',
  'monsternotebook.com.tr','lenovo.com','asus.com','msi.com','logitech.com',
  'dyson.com.tr','philips.com.tr','morhipo.com','vivense.com','toyzz.com',
  'banabi.com','getir.com','temu.com','shein.com','aliexpress.com',
  'beymen.com','network.com.tr','flo.com.tr','puma.com','mango.com',
  // Resmi kısaltma servisleri
  'ty.gl','amzn.to','amzn.eu','hb.com.tr'
];

// Resmi marka kısaltma linkleri — şüpheli değil, yönlendirme takip edilmeli
const OFFICIAL_SHORTENERS = {
  'ty.gl':     'trendyol',
  'amzn.to':   'amazon',
  'amzn.eu':   'amazon',
  'hb.com.tr': 'hepsiburada'
};

const SUSPICIOUS_TLDS = [
  '.xyz','.info','.biz','.tk','.ml','.ga','.cf','.gq','.pw',
  '.cc','.top','.click','.link','.online','.site','.store','.shop'
];

const PHISHING_PATTERNS = [
  { legit:'trendyol', bad:['trendy0l','trendyyol','trendyool','tr3ndyol','trendyol-indirim','indirimtrendyol','trendyol.net','trendyol.info','trendyol.biz'] },
  { legit:'hepsiburada', bad:['hepsib0rada','hepsiburadaa','hepsi-burada','hepsiburade','hepsibur4da','hepsiburada.net','hepsiburada.info'] },
  { legit:'amazon', bad:['arnazon','amazom','amazonn','arnaz0n','amaz0n','amazon-tr','amazonn.com','amazon.net','amazon-kampanya','amazon-fiyat'] },
  { legit:'n11', bad:['nll.com','n-11.com','n11-indirim','n1l.com','nl1.com'] },
  { legit:'gittigidiyor', bad:['gittigidiyorr','gittigidiy0r','gitti-gidiyor'] }
];

// Yalnızca üçüncü taraf, hedefi gizleyen kısaltıcılar — resmi marka kısaltıcıları değil
const URL_SHORTENERS = ['bit.ly','tinyurl.com','ow.ly','goo.gl','shorturl.at','cutt.ly','t.co','rb.gy'];

const POSITIVE_KEYWORDS = {
  'orijinal':4,'orjinal':3,'gerçek ürün':5,'orijinal ürün':5,'orjinal ürün':5,
  'harika':3,'mükemmel':3,'süper':2,'muhteşem':3,'olağanüstü':3,'kusursuz':3,
  'kaliteli':3,'kalite':2,'sağlam':3,'dayanıklı':3,'şık':2,'güzel':2,
  'hızlı kargo':4,'hızlı teslimat':4,'zamanında geldi':4,'dakik teslimat':3,
  'aynı gün':3,'ertesi gün':3,
  'fotoğraftaki gibi':5,'açıklamaya uygun':5,'aynen göründüğü gibi':4,'birebir aynı':4,
  'memnun':2,'memnunum':3,'tavsiye ederim':4,'kesinlikle alın':4,'pişman değilim':4,
  'beğendim':2,'iyi':1,'fiyatına göre iyi':3,'paranın değeri':3,'fiyat performans':3,
  'uygun fiyat':2,'kullanışlı':2,'pratik':2,'kolay kurulum':2,
  'çok iyi':3,'tam puan':4,'5 yıldız':4,'beş yıldız':4,'5/5':4,
  'satıcı ilgili':3,'hızlı çözüm':3,'iyi iletişim':3,'satıcı yardımcı':3,
  'paketleme güzel':2,'özenli paketleme':3,'güvenli paket':2,
  'tekrar alırım':4,'yeniden alacağım':4,'ikinci kez aldım':3,'her zaman alıyorum':3,
  'çok beğendim':3,'gayet güzel':3,'süper geldi':3,'tam istediğim gibi':4,
  'hızla geldi':3,'süper paketlenmiş':3,'hiç sorun yok':3,'sorunsuz':2,
  'fiyatı uygun':2,'gayet iyi':2,'tam beklediğim gibi':4,'son derece memnun':4,
  'güvenilir satıcı':4,'çok hızlı':3,'eksiksiz geldi':3,'sıfır sorun':3,
  'ikinci kez sipariş verdim':4,'üçüncü alışveriş':4,'her zaman güveniyorum':4
};

const NEGATIVE_KEYWORDS = {
  'sahte':6,'çakma':6,'taklit':6,'replika':5,'kopya ürün':6,'fake':6,'garanti yok':4,
  'kırık geldi':5,'kırık':3,'hasar':3,'hasarlı':5,'çizik':3,'ezilmiş':4,
  'bozuk':4,'arızalı':5,'çalışmıyor':5,'açılmıyor':4,
  'iade ettim':5,'iade sorunu':5,'iade yapamadım':6,'iade reddedildi':6,'iade':3,
  'geç kargo':4,'kargo problemi':5,'geç geldi':4,'gecikmeli':4,'kayboldu':5,'kargo kayıp':5,
  'dolandırıcı':6,'dolandırıldım':6,'dolandırma':6,'vurgun':5,
  'berbat':5,'kötü':3,'rezalet':6,'korkunç':5,
  'açıklama farklı':5,'fotoğraf farklı':5,'yanıltıcı':5,'aldatıcı':5,
  'müşteri hizmetleri kötü':4,'çözüm yok':4,'ilgilenilmedi':4,'cevap yok':3,
  'parça eksik':5,'eksik geldi':5,'yanlış ürün':5,'farklı ürün geldi':5,
  'para kayboldu':5,'gelmedi':4,'kullanılmış':4,'ikinci el':4,'sıfır değil':4,
  'kalitesiz':4,'çöp':5,'saçmalık':4,'para israfı':5,'pişman oldum':5,
  'tavsiye etmem':4,'almayın':5,'kaçının':5,'kesinlikle almayın':6,
  'paket açık geldi':4,'kutu hasar':4,'ambalaj bozuk':3,'ezilmiş kutu':3,
  'ürün geldi ama':3,'faturasız':3,'belgesiz':3,'garantisiz':4,
  'müşteriye saygısız':4,'kaba':3,'ilgisiz':3,'kayıt yaptırmıyor':4,
  'ucuz malzeme':3,'çabuk bozuldu':4,'dayanıksız':4,'kısa sürede':3
};

const TOPIC_KEYWORDS = {
  'Kalite': ['kalite','kaliteli','sağlam','dayanıklı','bozuk','arızalı','kırık','sahte'],
  'Kargo':  ['kargo','teslimat','geldi','gelmedi','geç','hızlı','paketleme','paket','kayboldu'],
  'İade':   ['iade','para iadesi','iade sorunu','iade reddedildi'],
  'Dolandırıcılık': ['sahte','çakma','dolandırıcı','dolandırıldım','taklit','fake','replika'],
  'Satıcı': ['satıcı','müşteri hizmetleri','iletişim','cevap','çözüm'],
  'Fiyat':  ['fiyat','ucuz','pahalı','uygun','değer','paranın'],
  'Ürün Uyumu': ['fotoğraftaki gibi','açıklamaya uygun','farklı geldi','birebir','yanıltıcı']
};

const CHRONIC_TRIGGERS = [
  'iade','sahte','çakma','kırık','bozuk','dolandı','geç kargo',
  'kargo problemi','hasarlı','fotoğraf farklı','açıklama farklı','sahte ürün',
  'kopya','replika','çalışmıyor','gelmedi','kayboldu'
];

const BOT_PATTERNS = [
  /^(çok güzel|harika|teşekkürler?|mükemmel|süper)[.!]?$/i,
  /^(5 yıldız|beş yıldız|tam puan)[.!]?$/i,
  /^(iyi|güzel|ok|okay|tamam)[.!]?$/i,
  /^(teşekkür(ler)?|sağ ol(un)?)[.!]?$/i,
  /^(aldım|geldi|güzel geldi)[.!]?$/i
];

// ─── Resmi kısa URL'leri takip ederek çöz ────────────────────────────────────
async function resolveUrl(url) {
  try {
    const controller = new AbortController();
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    const finalUrl = res.url;
    if (finalUrl && finalUrl !== url) return finalUrl;

    // HEAD bazı sunucularda çalışmaz, GET ile tekrar dene
    const res2 = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(5000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    return res2.url || url;
  } catch {
    return url;
  }
}

function isOfficialShortener(domain) {
  return Object.keys(OFFICIAL_SHORTENERS).some(s => domain === s || domain.endsWith('.' + s));
}

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

function extractDomain(rawUrl) {
  try {
    const u = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return rawUrl.toLowerCase().replace(/^https?:\/\//,'').replace(/^www\./,'').split('/')[0].split('?')[0];
  }
}

function detectPlatform(domain) {
  if (domain === 'ty.gl' || domain.endsWith('.ty.gl'))                  return 'trendyol';
  if (domain === 'hb.com.tr' || domain.endsWith('.hb.com.tr'))          return 'hepsiburada';
  if (domain === 'amzn.to' || domain === 'amzn.eu')                     return 'amazon';
  if (domain.includes('trendyol'))    return 'trendyol';
  if (domain.includes('hepsiburada')) return 'hepsiburada';
  if (domain.includes('n11'))         return 'n11';
  if (domain.includes('amazon'))      return 'amazon';
  if (domain.includes('gittigidiyor'))return 'gittigidiyor';
  if (domain.includes('ciceksepeti')) return 'ciceksepeti';
  if (domain.includes('teknosa'))     return 'teknosa';
  return 'generic';
}

function platformLabel(key) {
  const map = { trendyol:'Trendyol', hepsiburada:'Hepsiburada', n11:'n11', amazon:'Amazon TR', gittigidiyor:'GittiGidiyor', ciceksepeti:'ÇiçekSepeti', teknosa:'Teknosa', generic:'Web' };
  return map[key] || 'Web';
}

//  Trendyol 
async function fetchTrendyolReviews(url) {
  let contentId = null;
  // Pattern 1: -p-12345678 veya /p-12345678
  const pm1 = url.match(/[-\/]p-(\d{6,})/i);
  if (pm1) contentId = pm1[1];
  // Pattern 2: contentId= sorgu parametresi
  if (!contentId) { const pm2 = url.match(/[?&]contentId=(\d{5,})/i); if (pm2) contentId = pm2[1]; }
  // Pattern 3: URL'de 8+ haneli sayı segment
  if (!contentId) { const pm3 = url.match(/\/([1-9]\d{6,})(?:[?#\/]|$)/); if (pm3) contentId = pm3[1]; }
  // Pattern 4: HTML sayfasından çıkar
  if (!contentId) {
    try {
      const hRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(6000)
      });
      if (hRes.ok) {
        const html = await hRes.text();
        const hm = html.match(/"contentId"\s*:\s*(\d+)/) || html.match(/"productContentId"\s*:\s*(\d+)/) || html.match(/"id"\s*:\s*(\d{7,})/g);
        if (hm) contentId = Array.isArray(hm) ? hm[0].match(/(\d{7,})/)[1] : hm[1];
      }
    } catch {}
  }
  if (!contentId) return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'Trendyol', fetchError:'Ürün ID bulunamadı — doğrudan ürün sayfası URL\'sini girin' };

  const apiUrl = `https://public-mdc.trendyol.com/discovery-web-socialgw-service/api/review/product/${contentId}?storefrontId=1&culture=tr-TR&page=0&pageSize=30`;
  let res;
  try {
    res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.trendyol.com/',
        'Origin': 'https://www.trendyol.com'
      },
      signal: AbortSignal.timeout(7000)
    });
  } catch {
    return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'Trendyol', fetchError:'Trendyol bağlantısı kurulamadı' };
  }
  if (!res.ok) return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'Trendyol', fetchError:`Trendyol API ${res.status}` };
  const data = await res.json();
  const result    = data?.result || data;
  const reviews   = result?.productReviews?.content || result?.reviews || result?.content || [];
  const avgRating = result?.ratingScore?.averageRating ?? result?.averageRating ?? null;
  const totalCount= result?.productReviews?.totalElements ?? result?.totalCount ?? reviews.length;
  return {
    reviewItems: reviews.slice(0,30).map(r => ({
      text:    (r.comment || r.commentText || '').trim(),
      rating:  r.rate ?? r.rating ?? null,
      date:    r.createdDate || null,
      helpful: r.helpful ?? 0
    })).filter(r => r.text.length > 3),
    count: reviews.length, totalCount, avgRating, platform:'Trendyol'
  };
}

//  Hepsiburada 
async function fetchHepsiburadaReviews(url) {
  let sku = null;
  // Pattern 1: HB...[büyük harf+rakam] URL path içinde
  const pm1 = url.match(/\b(HB[A-Z0-9]{6,})/i);
  if (pm1) sku = pm1[1].toUpperCase();
  // Pattern 2: -HB... veya /p-HB...
  if (!sku) { const pm2 = url.match(/[-\/]p?-?(HB[^?&#\/\s]{5,})/i); if (pm2) sku = pm2[1].toUpperCase(); }
  // Pattern 3: HTML'den çıkar
  if (!sku) {
    try {
      const hRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(6000)
      });
      if (hRes.ok) {
        const html = await hRes.text();
        const hm = html.match(/"sku"\s*:\s*"(HB[A-Z0-9]+)"/i) || html.match(/data-sku="(HB[A-Z0-9]+)"/i) || html.match(/"productCode"\s*:\s*"(HB[A-Z0-9]+)"/i);
        if (hm) sku = hm[1].toUpperCase();
      }
    } catch {}
  }
  if (!sku) return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'Hepsiburada', fetchError:'Ürün SKU bulunamadı — doğrudan ürün sayfası URL\'sini girin' };

  const apiUrl = `https://www.hepsiburada.com/product-reviews/sku/${sku}?size=25&page=0`;
  let res;
  try {
    res = await fetch(apiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.hepsiburada.com/'
      },
      signal: AbortSignal.timeout(7000)
    });
  } catch {
    return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'Hepsiburada', fetchError:'Hepsiburada bağlantısı kurulamadı' };
  }
  if (!res.ok) return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'Hepsiburada', fetchError:`Hepsiburada API ${res.status}` };
  const data = await res.json();
  const reviews    = data?.reviews || data?.result || data?.data || [];
  const avgRating  = data?.averageRating ?? null;
  const totalCount = data?.totalCount ?? reviews.length;
  return {
    reviewItems: reviews.slice(0,30).map(r => ({
      text:   (r.userText || r.text || r.comment || '').trim(),
      rating: r.rating ?? r.rate ?? null,
      date:   r.createdAt || null
    })).filter(r => r.text.length > 3),
    count: reviews.length, totalCount, avgRating, platform:'Hepsiburada'
  };
}

//  n11 
async function fetchN11Reviews(url) {
  let productId = null;
  // URL'den ID çıkarmayı dene
  const pm = url.match(/\/([1-9]\d{6,})(?:[?#\/]|$)/) || url.match(/productId[=\/](\d+)/i);
  if (pm) productId = pm[1];
  // HTML'den çıkarmayı dene
  if (!productId) {
    try {
      const hRes = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
        signal: AbortSignal.timeout(7000)
      });
      if (!hRes.ok) return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'n11' };
      const html = await hRes.text();
      const hm = html.match(/"productId"\s*:\s*"?(\d+)"?/) || html.match(/data-product-id="(\d+)"/i);
      if (hm) productId = hm[1];
      else return await fetchGenericReviews(url, 'n11');
    } catch {
      return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'n11' };
    }
  }
  if (!productId) return await fetchGenericReviews(url, 'n11');
  try {
    const apiRes = await fetch(`https://www.n11.com/api/v1/product/comment/list?productId=${productId}&page=0&size=30`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://www.n11.com/' },
      signal: AbortSignal.timeout(6000)
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      const reviews = data?.data?.commentList || data?.result?.comments || data?.comments || [];
      const avg   = data?.data?.averageScore ?? data?.averageScore ?? null;
      const total = data?.data?.totalCount ?? data?.totalCount ?? reviews.length;
      if (reviews.length > 0) return {
        reviewItems: reviews.map(r => ({
          text:   (r.comment || r.commentText || r.text || '').trim(),
          rating: r.score ?? r.starCount ?? r.rating ?? null,
          date:   r.createdDate || r.date || null
        })).filter(r => r.text.length > 3),
        count: reviews.length, totalCount: total, avgRating: avg, platform: 'n11'
      };
    }
  } catch {}
  return await fetchGenericReviews(url, 'n11');
}

//  ÇiçekSepeti 
async function fetchCicekSepetiReviews(url) {
  let productId = null;
  let html = '';
  try {
    const hRes = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' },
      signal: AbortSignal.timeout(8000)
    });
    if (!hRes.ok) return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'ÇiçekSepeti' };
    html = await hRes.text();
  } catch {
    return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'ÇiçekSepeti' };
  }
  // JSON-LD'yi doğrudan dene
  const jsonLd = await fetchGenericReviews(url, 'ÇiçekSepeti');
  if (jsonLd.count > 0) return jsonLd;
  // Sayfadan productId çıkar
  const pidM = html.match(/"productCode"\s*:\s*"?(\w+)"?/) || html.match(/"ProductId"\s*:\s*"?(\d+)"?/) || html.match(/"productId"\s*:\s*"?(\d+)"?/);
  if (pidM) productId = pidM[1];
  if (!productId) return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'ÇiçekSepeti' };
  try {
    const apiRes = await fetch(`https://www.ciceksepeti.com/product-review/reviews?productId=${productId}&pageIndex=1&pageSize=20`, {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Referer': 'https://www.ciceksepeti.com/' },
      signal: AbortSignal.timeout(6000)
    });
    if (apiRes.ok) {
      const data = await apiRes.json();
      const reviews = data?.data?.reviews || data?.reviews || [];
      return {
        reviewItems: reviews.map(r => ({
          text:   (r.comment || r.review || r.text || '').trim(),
          rating: r.starCount ?? r.rating ?? null,
          date:   r.createdAt || null
        })).filter(r => r.text.length > 3),
        count: reviews.length, totalCount: data?.data?.totalCount ?? reviews.length, avgRating: data?.data?.averageRating ?? null, platform:'ÇiçekSepeti'
      };
    }
  } catch {}
  return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'ÇiçekSepeti' };
}

//  Generic JSON-LD / HTML 
async function fetchGenericReviews(url, platformName) {
  let res;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(9000)
    });
  } catch {
    return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform: platformName };
  }
  // 4xx/5xx → sessizce boş döndür
  if (!res.ok) return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform: platformName };
  const html  = await res.text();
  const items = [];
  let avgRating = null;

  const jsonLdRe = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = jsonLdRe.exec(html)) !== null) {
    try {
      const d = JSON.parse(m[1]);
      const arr = Array.isArray(d) ? d : [d];
      for (const item of arr) {
        if (item?.aggregateRating?.ratingValue) avgRating = parseFloat(item.aggregateRating.ratingValue);
        const revs = item?.review || item?.reviews || [];
        for (const r of (Array.isArray(revs)?revs:[revs])) {
          const txt = (r?.reviewBody || r?.description || '').trim();
          if (txt.length > 5) items.push({ text: txt, rating: parseFloat(r?.reviewRating?.ratingValue)||null, date: r?.datePublished||null });
        }
      }
    } catch {}
  }
  return { reviewItems: items, count: items.length, totalCount: items.length, avgRating, platform: platformName };
}

//  Dispatcher 
async function fetchReviewsFromURL(url) {
  const domain = extractDomain(url);
  // Resmi kısa URL ise önce çöz, sonra gerçek platforma göre dağıt
  let workUrl = url;
  if (isOfficialShortener(domain)) {
    workUrl = await resolveUrl(url);
  }
  const finalDomain = extractDomain(workUrl);
  const plat   = detectPlatform(finalDomain);
  const label  = platformLabel(plat);
  try {
    if (plat === 'trendyol')    return await fetchTrendyolReviews(workUrl);
    if (plat === 'hepsiburada') return await fetchHepsiburadaReviews(workUrl);
    if (plat === 'n11')         return await fetchN11Reviews(workUrl);
    if (plat === 'ciceksepeti') return await fetchCicekSepetiReviews(workUrl);
    return await fetchGenericReviews(workUrl, label);
  } catch (err) {
    return { reviewItems:[], count:0, totalCount:0, avgRating:null, platform:label };
  }
}

//  URL Güvenlik Analizi 
function analyzeUrl(rawUrl, resolvedFrom) {
  const warnings = [];
  let score = 50;

  if (!rawUrl || rawUrl.trim().length < 4) {
    return { guven_skoru:50, risk_seviyesi:'Orta', guvenlik_uyarilari:['URL geçersiz.'], https:false };
  }

  const normalized = rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl;
  const ssl        = /^https:\/\//i.test(normalized);
  const domain     = extractDomain(normalized);
  const tldMatch   = domain.match(/(\.[a-z]{2,6})+$/);
  const tld        = tldMatch ? tldMatch[0] : '';
  const domainName = domain.replace(/(\.[a-z]{2,6})+$/, '');

  if (!ssl) {
    warnings.push('Bağlantı şifrelenmemiş (HTTP). Ödeme bilgilerini girerken dikkatli olun!');
    score -= 20;
  } else { score += 5; }

  // Resmi kısa bağlantıdan geldiyse not ekle, penalize etme
  if (resolvedFrom) {
    warnings.push(`"${resolvedFrom}" resmi kısa link servisi — yönlendirme takip edilerek analiz tamamlandı: ${domain}`);
  }

  const isWhitelisted = LEGIT_DOMAINS.some(d => domain === d || domain.endsWith('.'+d));
  if (isWhitelisted) { score += 40; }
  else { warnings.push(`"${domain}" bilinen güvenilir Türk e-ticaret sitelerinde bulunamadı.`); score -= 5; }

  if (SUSPICIOUS_TLDS.some(st => tld.endsWith(st))) {
    warnings.push(`Şüpheli alan adı uzantısı tespit edildi (${tld}). Bu uzantılar sahte sitelerde sık kullanılır.`);
    score -= 30;
  }

  if (/^\d{1,3}(\.\d{1,3}){3}/.test(domain)) {
    warnings.push('Alan adı yerine IP adresi kullanılıyor  ciddi phishing işareti!');
    score -= 40;
  }

  for (const pp of PHISHING_PATTERNS) {
    if (pp.bad.some(p => domain.includes(p.split('.')[0]) && !domain.includes(pp.legit))) {
      warnings.push(`"${pp.legit}" markasını taklit eden oltalama adresi: "${domain}"`);
      score -= 50; break;
    }
  }

  const knownBrands = ['amazon','hepsiburada','trendyol','n11','gittigidiyor','mediamarkt','teknosa'];
  const domainBase  = domainName.split('-')[0];
  for (const brand of knownBrands) {
    const dist = levenshtein(domainBase.toLowerCase(), brand);
    if (dist > 0 && dist <= 2 && domainBase.length >= brand.length - 2) {
      warnings.push(`"${brand}" markasına çok benzeyen şüpheli domain: "${domain}" (yazım hatası riski).`);
      score -= 35; break;
    }
  }

  if (URL_SHORTENERS.some(s => domain.includes(s))) {
    warnings.push('Kısaltılmış URL  gerçek hedef görülemiyor, dikkatli olun!');
    score -= 20;
  }

  if ((domainName.match(/-/g)||[]).length >= 2) {
    warnings.push(`Alan adında çok fazla tire: "${domain}". Sahte sitelerde yaygın.`);
    score -= 15;
  }

  const trapWords = ['indirim','kampanya','ucuz','bedava','satisonline','giveaway','ozel-teklif','anlik-firsat'];
  const foundTrap = trapWords.find(w => domainName.toLowerCase().includes(w));
  if (foundTrap) {
    warnings.push(`Domain adında "${foundTrap}" kelimesi var. Meşru firmalar resmi URL'lerine bu kelimeleri koymaz.`);
    score -= 15;
  }

  score = Math.max(0, Math.min(100, score));
  const risk = score >= 75 ? 'Düşük' : score >= 50 ? 'Orta' : score >= 25 ? 'Yüksek' : 'Kritik';
  return { guven_skoru:score, risk_seviyesi:risk, guvenlik_uyarilari:warnings, https:ssl };
}

//  NLP Analizi 
function analyzeReviews(reviewItems) {
  if (!reviewItems || reviewItems.length === 0) {
    return { olumlu_odak:[], olumsuz_odak:[], konular:[], pozitif_yuzde:0, negatif_yuzde:0, notr_yuzde:0, kronik_sorun_var_mi:false, bot_yorum_suphesi:false, ortalama_puan:null, puan_dagilimi:null, kalite_skoru:0, toplam_yorum:0 };
  }

  const lines = reviewItems.map(r => r.text).filter(t => t && t.trim().length > 2);
  const allText = lines.join('\n').toLowerCase();

  const perReview = lines.map(line => {
    const low = line.toLowerCase();
    let ps = 0, ns = 0;
    for (const [kw, w] of Object.entries(POSITIVE_KEYWORDS)) {
      ps += (low.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length * Number(w);
    }
    for (const [kw, w] of Object.entries(NEGATIVE_KEYWORDS)) {
      ns += (low.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length * Number(w);
    }
    return { posScore:ps, negScore:ns };
  });

  const total = perReview.length || 1;
  const pozitif_yuzde = Math.round(perReview.filter(r => r.posScore > r.negScore && r.posScore > 0).length / total * 100);
  const negatif_yuzde = Math.round(perReview.filter(r => r.negScore > r.posScore && r.negScore > 0).length / total * 100);
  const notr_yuzde    = Math.max(0, 100 - pozitif_yuzde - negatif_yuzde);

  const posScores = {}, negScores = {};
  for (const [kw, w] of Object.entries(POSITIVE_KEYWORDS)) {
    const m = (allText.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length;
    if (m > 0) posScores[kw] = m * Number(w);
  }
  for (const [kw, w] of Object.entries(NEGATIVE_KEYWORDS)) {
    const m = (allText.match(new RegExp(kw.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length;
    if (m > 0) negScores[kw] = m * Number(w);
  }
  const topPos = Object.entries(posScores).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>k);
  const topNeg = Object.entries(negScores).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>k);

  const konular = Object.entries(TOPIC_KEYWORDS)
    .filter(([,kws]) => kws.some(kw => allText.includes(kw.toLowerCase())))
    .map(([topic]) => topic);

  let chronicCount = 0;
  for (const trigger of CHRONIC_TRIGGERS) {
    if ((allText.match(new RegExp(trigger.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'gi'))||[]).length >= 2) chronicCount++;
  }
  const kronik = chronicCount >= 2;

  let shortCount = 0, botCount = 0, duplicates = 0;
  const seen = new Set();
  for (const line of lines) {
    const t = line.trim();
    if (t.length < 15) shortCount++;
    if (BOT_PATTERNS.some(p => p.test(t))) botCount++;
    const norm = t.toLowerCase().replace(/\s+/g,' ');
    if (seen.has(norm)) duplicates++;
    else seen.add(norm);
  }
  const bot = lines.length > 0 && (
    shortCount / lines.length > 0.5 ||
    botCount   / lines.length > 0.4 ||
    duplicates >= 2
  );

  const puanlar = reviewItems.map(r => r.rating).filter(r => r !== null && r > 0);
  let ortalama_puan = null, puan_dagilimi = null;
  if (puanlar.length > 0) {
    ortalama_puan = parseFloat((puanlar.reduce((a,b)=>a+b,0)/puanlar.length).toFixed(1));
    puan_dagilimi = [5,4,3,2,1].map(s => ({ yildiz:s, sayi:puanlar.filter(p=>Math.round(p)===s).length }));
  }

  const avgLen     = lines.reduce((a,b)=>a+b.length,0) / (lines.length||1);
  const kalite_skoru = Math.round((1 - duplicates/(lines.length||1)) * (1 - botCount/(lines.length||1)) * Math.min(avgLen/100,1) * 100);

  // Özgünlük skoru: Kısa yorum, bot ve kopya yorum oranına göre
  const totalR = lines.length || 1;
  const botRatio  = botCount  / totalR;
  const dupRatio  = duplicates / totalR;
  const shortRatio = shortCount / totalR;
  const ozgunluk_skoru = Math.round(Math.max(0, 100 - botRatio*40 - dupRatio*30 - shortRatio*20 - (kronik?10:0)));

  return { olumlu_odak:topPos, olumsuz_odak:topNeg, konular, pozitif_yuzde, negatif_yuzde, notr_yuzde, kronik_sorun_var_mi:kronik, bot_yorum_suphesi:bot, ortalama_puan, puan_dagilimi, kalite_skoru, ozgunluk_skoru, toplam_yorum:lines.length };
}

//  Verdict 
function buildVerdict(urlR, revR) {
  const { guven_skoru:score, risk_seviyesi:risk, guvenlik_uyarilari:warnings } = urlR;
  const { kronik_sorun_var_mi:kronik, bot_yorum_suphesi:bot, negatif_yuzde, pozitif_yuzde } = revR;
  const isPhishing = warnings.some(w => w.includes('oltalama') || w.includes('taklit'));

  if (isPhishing || score < 25) return { mesaj:'Bu URL yüksek riskli oltalama (phishing) belirtileri taşıdığından ödeme bilgilerinizi KESİNLİKLE paylaşmayın ve bu kaynaktan satın ALMAYIN.', renk:'kritik' };
  if (risk === 'Kritik')         return { mesaj:'URL ve satıcı analizi kritik güvenlik riskleri gösteriyor; bu platform üzerinden alışveriş yapmanızı önermiyoruz.', renk:'kritik' };
  if (risk === 'Yüksek' && kronik) return { mesaj:'Hem satıcı güvenilirliği hem de kronik müşteri şikayetleri yüksek risk işaret ediyor; bu satıcıdan alışveriş yapmamanızı öneriyoruz.', renk:'yuksek' };
  if (risk === 'Yüksek')          return { mesaj:'Satıcı güvenilirliği düşük görünüyor; tanınmış bir platformdan satın almayı değerlendirin.', renk:'yuksek' };
  if (kronik && bot)              return { mesaj:'Kronik ürün sorunları ve sahte yorum şüphesi mevcut; başka satıcı ve platformları araştırmanızı kesinlikle tavsiye ederiz.', renk:'orta' };
  if (kronik)                     return { mesaj:'Müşteri yorumlarında kronik sorunlar (iade/sahtecilik/hasar) gözlemleniyor; alışveriş öncesinde daha fazla kaynak araştırmanızı öneririz.', renk:'orta' };
  if (bot)                        return { mesaj:'Yorumların önemli kısmı bot/sahte görünüyor; başka platformlardaki değerlendirmeleri de inceleyin.', renk:'orta' };
  if (negatif_yuzde > 40)         return { mesaj:`Yorumların %${negatif_yuzde}\'i olumsuz içerik barındırıyor; ek araştırma yapmanızı öneririz.`, renk:'orta' };
  if (score >= 75 && pozitif_yuzde >= 60) return { mesaj:`Satıcı ve URL güvenilir; yorumların %${pozitif_yuzde}'i olumlu. Alışverişinizi güvenle tamamlayabilirsiniz.`, renk:'dusuk' };
  if (score >= 75) return { mesaj:'Satıcı ve URL güvenilir görünüyor. Alışverişinizi tamamlayabilirsiniz.', renk:'dusuk' };
  return { mesaj:'Satıcı orta düzeyde güvenilir; resmi platformlarla karşılaştırma yaparak alışveriş yapmanızı öneririz.', renk:'orta' };
}

//  Rate Limit 
const _rl = new Map();
function checkRateLimit(ip) {
  const now = Date.now(), WINDOW = 60000, LIMIT = 15;
  const rec = _rl.get(ip);
  if (!rec || now > rec.reset) { _rl.set(ip, { count:1, reset:now+WINDOW }); return true; }
  if (rec.count >= LIMIT) return false;
  rec.count++; return true;
}

//  Handler 
exports.handler = async (event) => {
  const cors = { 'Access-Control-Allow-Origin':'*', 'Content-Type':'application/json' };
  if (event.httpMethod === 'OPTIONS') return { statusCode:204, headers:{...cors,'Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type'}, body:'' };
  if (event.httpMethod !== 'POST') return { statusCode:405, headers:cors, body:JSON.stringify({error:'Method Not Allowed'}) };

  const ip = ((event.headers['x-forwarded-for']||'').split(',')[0].trim()) || 'unknown';
  if (!checkRateLimit(ip)) return { statusCode:429, headers:cors, body:JSON.stringify({error:'Çok fazla istek. Lütfen bir dakika bekleyin.'}) };

  let body;
  try { body = JSON.parse(event.body||'{}'); }
  catch { return { statusCode:400, headers:cors, body:JSON.stringify({error:'Geçersiz JSON.'}) }; }

  const { url = '' } = body;
  if (!url || url.trim().length < 5) return { statusCode:400, headers:cors, body:JSON.stringify({error:'Geçerli bir URL giriniz.'}) };

  const normalizedUrl = url.startsWith('http') ? url : 'https://' + url;
  const inputDomain   = extractDomain(normalizedUrl);

  // Resmi kısa URL ise önce çöz, güvenlik analizini çözülmüş URL üzerinde yap
  let analysisUrl = normalizedUrl;
  let resolvedFrom = null;
  if (isOfficialShortener(inputDomain)) {
    const resolved = await resolveUrl(normalizedUrl);
    if (resolved !== normalizedUrl) {
      analysisUrl  = resolved;
      resolvedFrom = inputDomain;
    }
  }

  const [urlResult, reviewFetch] = await Promise.all([
    Promise.resolve(analyzeUrl(analysisUrl, resolvedFrom)),
    fetchReviewsFromURL(normalizedUrl).catch(() => ({ reviewItems:[], count:0, totalCount:0, avgRating:null, platform:'Web' }))
  ]);

  const reviewResult = analyzeReviews(reviewFetch.reviewItems || []);
  const verdict      = buildVerdict(urlResult, reviewResult);

  return {
    statusCode: 200,
    headers: cors,
    body: JSON.stringify({
      satici_analizi:       urlResult,
      yorum_cekme: {
        platform:    reviewFetch.platform,
        sayi:        reviewFetch.count,
        toplam_sayi: reviewFetch.totalCount,
        ort_puan:    reviewFetch.avgRating,
        hata:        reviewFetch.fetchError || null,
        onizleme:    (reviewFetch.reviewItems||[]).slice(0,5).map(r => ({
          text:   r.text.length > 160 ? r.text.slice(0,160)+'' : r.text,
          rating: r.rating,
          date:   r.date
        }))
      },
      urun_yorumlari_ozeti: reviewResult,
      sonuc_karari:         verdict
    })
  };
};