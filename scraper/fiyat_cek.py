"""
FiyatAvcısı — Scrapling ile E-Ticaret Fiyat Çekme Aracı
=========================================================
Trendyol, Hepsiburada, Amazon.com.tr, n11, Teknosa ve Vatan
sitelerinden ürün fiyatlarını Scrapling ile çeker.

Kullanım:
  python fiyat_cek.py "iphone 15"
  python fiyat_cek.py "samsung galaxy s24" --site trendyol
  python fiyat_cek.py "airpods pro" --all
  python fiyat_cek.py "macbook air" --json
  python fiyat_cek.py "ps5" --export sonuclar.json
  python fiyat_cek.py "laptop" --stealth          # Cloudflare bypass
"""

import sys
import json
import re
import time
import logging
import argparse
from urllib.parse import quote_plus
from datetime import datetime
from functools import wraps

from scrapling.fetchers import Fetcher, StealthyFetcher

# ────────────────────────────────────────────────────────
# Logging ayarı
# ────────────────────────────────────────────────────────
log = logging.getLogger("fiyatavcisi")
log.setLevel(logging.INFO)
_handler = logging.StreamHandler(sys.stderr)
_handler.setFormatter(logging.Formatter("  %(message)s"))
log.addHandler(_handler)

# ────────────────────────────────────────────────────────
# Bot engeli algılama sinyalleri
# ────────────────────────────────────────────────────────
BLOCKED_SIGNALS = [
    'cf-browser-verification', 'cf_chl_opt', 'challenge-platform',
    'Checking your browser', 'Just a moment', 'Lütfen bekleyin',
    'captcha', 'robot değilsiniz', 'Access Denied', 'has been blocked',
    'cf-turnstile', '_cf_chl_tk', 'ray ID',
]


def _sayfa_engellendi_mi(page) -> bool:
    """Sayfa bot koruması tarafından engellenmiş mi kontrol et."""
    try:
        html = page.html_content
    except Exception:
        html = ''
    if not html or len(html) < 2000:
        return True
    # Büyük sayfalar genellikle gerçek içerik taşır, CF scriptleri false-positive yaratır
    if len(html) > 15000:
        return False
    html_lower = html.lower()
    return any(sig.lower() in html_lower for sig in BLOCKED_SIGNALS)


# ────────────────────────────────────────────────────────
# Retry decorator
# ────────────────────────────────────────────────────────
def retry(max_tries: int = 2, delay: float = 1.0, backoff: float = 2.0):
    """Başarısız fonksiyonu yeniden deneyen decorator."""
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            last_exc = None
            current_delay = delay
            for attempt in range(1, max_tries + 1):
                try:
                    return fn(*args, **kwargs)
                except Exception as e:
                    last_exc = e
                    if attempt < max_tries:
                        log.warning(f"⚠️  {fn.__name__} deneme {attempt} başarısız: {e} — {current_delay:.1f}s sonra tekrar...")
                        time.sleep(current_delay)
                        current_delay *= backoff
            log.error(f"❌ {fn.__name__} {max_tries} denemede de başarısız: {last_exc}")
            return []  # Scraper fonksiyonları list döner
        return wrapper
    return decorator


# ────────────────────────────────────────────────────────
# Sayfa getirme — akıllı fallback
# ────────────────────────────────────────────────────────
def sayfa_getir(url: str, timeout: int = 15, stealth: bool = False):
    """Sayfayı getir. stealth=True ise StealthyFetcher, değilse Fetcher kullanır.
    Fetcher başarısız olursa (bot koruması) otomatik StealthyFetcher'a düşer."""
    if stealth:
        log.info("🥷 Stealth mod aktif...")
        return StealthyFetcher.fetch(
            url, headless=True, network_idle=True,
            timeout=timeout * 1000,
            disable_resources=True,
        )

    # Önce hızlı HTTP dene
    try:
        page = Fetcher.get(url, stealthy_headers=True, follow_redirects=True, timeout=timeout)
        if _sayfa_engellendi_mi(page):
            log.warning("⚠️  Bot koruması algılandı, stealth moda geçiliyor...")
            return StealthyFetcher.fetch(
                url, headless=True, network_idle=True,
                timeout=timeout * 1000,
                disable_resources=True,
            )
        return page
    except Exception as e:
        log.warning(f"⚠️  HTTP başarısız ({e}), stealth moda geçiliyor...")
        return StealthyFetcher.fetch(
            url, headless=True, network_idle=True,
            timeout=timeout * 1000,
            disable_resources=True,
        )


# ────────────────────────────────────────────────────────
# Yardımcı Fonksiyonlar
# ────────────────────────────────────────────────────────

def temizle_fiyat(text: str | None) -> float | None:
    """Fiyat metninden sayısal değer çıkar. Örn: '54.999,00 TL' → 54999.0

    Türk fiyat formatları:
      54.999,00 TL  →  54999.00
      47.500        →  47500     (nokta binlik ayırıcı)
      2.028,49      →  2028.49
      149,99        →  149.99
      87.49         →  87.49     (nokta ondalık)
    """
    if not text:
        return None
    text = str(text).strip()
    # TL, ₺ vb. kaldır
    text = re.sub(r'[TLtl₺\s]', '', text)
    # Sadece rakam, nokta, virgül bırak
    text = re.sub(r'[^\d.,]', '', text)
    if not text:
        return None
    # Türk format: nokta binlik, virgül ondalık
    if ',' in text and '.' in text:
        text = text.replace('.', '').replace(',', '.')
    elif ',' in text:
        text = text.replace(',', '.')
    elif '.' in text:
        parts = text.split('.')
        if len(parts) == 2 and len(parts[1]) == 3:
            text = text.replace('.', '')
        elif len(parts) > 2:
            text = ''.join(parts[:-1]) + '.' + parts[-1]
    try:
        val = float(text)
        return val if val > 0 else None
    except ValueError:
        return None


def _safe_text(el) -> str:
    """Element'ten güvenli text çek. None/hata durumunda '' döner."""
    if el is None:
        return ''
    try:
        t = el.text if hasattr(el, 'text') else str(el)
        return (t or '').strip()
    except Exception:
        return ''


def _safe_get(selectors) -> str | None:
    """Scrapling Selectors'dan güvenli .get() çağrısı."""
    if not selectors:
        return None
    try:
        return selectors.get()
    except Exception:
        return None


def _safe_attrib(el, attr: str, default: str = '') -> str:
    """Element'ten güvenli attribute çek."""
    if el is None:
        return default
    try:
        return el.attrib.get(attr, default) or default
    except Exception:
        return default


def format_fiyat(fiyat: float | None) -> str:
    """Fiyatı Türk Lirası formatında göster."""
    if fiyat is None:
        return "—"
    if fiyat >= 1000:
        return f"{fiyat:,.2f} TL".replace(',', 'X').replace('.', ',').replace('X', '.')
    return f"{fiyat:.2f} TL"


def yazdir_sonuclar(site_adi: str, urunler: list):
    """Sonuçları güzel formata yazdır."""
    print(f"\n{'='*60}")
    print(f"  🏪 {site_adi}")
    print(f"{'='*60}")
    if not urunler:
        print("  ❌ Sonuç bulunamadı veya site erişimi engellendi.")
        return
    for i, urun in enumerate(urunler[:10], 1):
        fiyat_str = format_fiyat(urun.get('fiyat'))
        print(f"\n  {i}. {urun.get('baslik', 'Başlık yok')[:80]}")
        print(f"     💰 Fiyat: {fiyat_str}")
        if urun.get('eski_fiyat') and urun.get('fiyat') and urun['eski_fiyat'] > urun['fiyat']:
            eski = format_fiyat(urun['eski_fiyat'])
            indirim = round((1 - urun['fiyat'] / urun['eski_fiyat']) * 100)
            print(f"     🏷️  Eski: {eski}  (-%{indirim})")
        if urun.get('satici'):
            print(f"     🏬 Satıcı: {urun['satici']}")
        if urun.get('puan'):
            print(f"     ⭐ Puan: {urun['puan']}")
        if urun.get('url'):
            print(f"     🔗 {urun['url'][:90]}")
    print(f"\n  📊 Toplam {len(urunler)} ürün bulundu.")


# ────────────────────────────────────────────────────────
# TRENDYOL — Inline JSON'dan ürün çekme
# ────────────────────────────────────────────────────────

@retry(max_tries=2, delay=1.0)
def cek_trendyol(arama: str, stealth: bool = False) -> list:
    """Trendyol'dan ürün fiyatlarını inline JSON state'inden çek."""
    url = f"https://www.trendyol.com/sr?q={quote_plus(arama)}"
    log.info(f"📡 Trendyol sorgulanıyor: {arama}...")

    page = sayfa_getir(url, stealth=stealth)
    urunler = []

    # ── Yöntem 1: window["__single-search-result__PROPS"] JSON ──
    for s in page.css('script'):
        txt = _safe_text(s)
        if '__single-search-result__PROPS' not in txt:
            continue

        match = re.search(
            r'window\["__single-search-result__PROPS"\]\s*=\s*({.*})',
            txt, re.DOTALL
        )
        if not match:
            continue

        try:
            raw_json = match.group(1)
            # JSON.loads unicode escape'leri (\uXXXX) otomatik çözer.
            # .encode().decode('unicode_escape') YAPMA — Türkçe UTF-8 bozar!
            data = json.loads(raw_json)
            products = data.get('data', {}).get('products', [])

            for p in products[:20]:
                price_obj = p.get('price', {})
                if not isinstance(price_obj, dict):
                    continue
                fiyat = price_obj.get('discountedPrice') or price_obj.get('current')
                eski = price_obj.get('originalPrice')
                if eski and fiyat and abs(eski - fiyat) < 1:
                    eski = None

                rating = p.get('ratingScore') or {}
                puan = rating.get('averageRating') if isinstance(rating, dict) else None
                yorum_sayisi = rating.get('totalCount', 0) if isinstance(rating, dict) else 0

                link = p.get('url', '')
                if link and not link.startswith('http'):
                    link = f"https://www.trendyol.com{link}"

                if fiyat and isinstance(fiyat, (int, float)):
                    urunler.append({
                        'baslik': p.get('name', 'Bilinmeyen Ürün'),
                        'fiyat': float(fiyat),
                        'eski_fiyat': float(eski) if eski else None,
                        'marka': p.get('brand', ''),
                        'url': link,
                        'puan': f"{puan:.1f} ({yorum_sayisi} yorum)" if puan else None,
                        'gorsel': p.get('image', ''),
                        'site': 'Trendyol'
                    })
        except json.JSONDecodeError as e:
            log.warning(f"⚠️  Trendyol JSON parse hatası: {e}")
        except Exception as e:
            log.warning(f"⚠️  Trendyol veri işleme hatası: {e}")
        break

    # ── Yöntem 2: application/json script tag fallback ──
    if not urunler:
        for s in page.css('script[type="application/json"]'):
            txt = _safe_text(s)
            if not txt or len(txt) < 100:
                continue
            try:
                data = json.loads(txt)
                # Nested data yapısında ürünleri ara
                products = None
                if isinstance(data, dict):
                    products = data.get('products') or data.get('data', {}).get('products')
                if not products:
                    continue
                for p in products[:20]:
                    if not isinstance(p, dict):
                        continue
                    price_obj = p.get('price', {})
                    fiyat = None
                    if isinstance(price_obj, dict):
                        fiyat = price_obj.get('discountedPrice') or price_obj.get('current')
                    elif isinstance(price_obj, (int, float)):
                        fiyat = price_obj
                    name = p.get('name', '')
                    if fiyat and name:
                        link = p.get('url', '')
                        if link and not link.startswith('http'):
                            link = f"https://www.trendyol.com{link}"
                        urunler.append({
                            'baslik': name,
                            'fiyat': float(fiyat),
                            'url': link,
                            'marka': p.get('brand', ''),
                            'site': 'Trendyol'
                        })
            except Exception:
                continue

    if urunler:
        log.info(f"✅ Trendyol: {len(urunler)} ürün bulundu")
    else:
        log.warning("⚠️  Trendyol: sonuç bulunamadı")
    return urunler


# ────────────────────────────────────────────────────────
# HEPSİBURADA — HTML kartlarından ürün çekme
# ────────────────────────────────────────────────────────

@retry(max_tries=2, delay=1.0)
def cek_hepsiburada(arama: str, stealth: bool = False) -> list:
    """Hepsiburada'dan ürün fiyatlarını HTML kartlarından çek."""
    url = f"https://www.hepsiburada.com/ara?q={quote_plus(arama)}"
    log.info(f"📡 Hepsiburada sorgulanıyor: {arama}...")

    page = sayfa_getir(url, stealth=stealth)
    urunler = []

    # Birden fazla selector stratejisi (CSS module hash'ler değişebilir)
    KART_SELECTORS = [
        'article[class*="productCard"]',
        '[class*="productCard-module_article"]',
        'li[class*="productListContent"]',
        '[data-test-id="product-card-item"]',
    ]
    kartlar = []
    for sel in KART_SELECTORS:
        kartlar = page.css(sel)
        if kartlar:
            break

    for kart in kartlar[:20]:
        try:
            # Başlık — birden fazla selector dene
            baslik = None
            link = None
            for link_sel in ['a[href*="-p-"]', 'a[class*="product"]', 'a[href*="hepsiburada.com"]']:
                link_el = kart.css(link_sel)
                if link_el:
                    for le in link_el:
                        txt = _safe_text(le)
                        if txt and len(txt) > 5:
                            baslik = txt
                            break
                    link = _safe_attrib(link_el[0], 'href')
                    if link and not link.startswith('http'):
                        link = f"https://www.hepsiburada.com{link}"
                    if baslik:
                        break

            # Fiyat — birden fazla selector
            fiyat = None
            for fiyat_sel in [
                '[class*="price-module_finalPrice"]',
                '[class*="productPrice"]',
                '[data-test-id="price-current-price"]',
                '[class*="price"]',
            ]:
                fiyat_tam_el = kart.css(fiyat_sel)
                if fiyat_tam_el:
                    # Kuruş parçasını da al
                    frac_el = kart.css('[class*="finalPriceFraction"]')
                    frac_text = ''
                    if frac_el:
                        frac_text = _safe_text(frac_el[0]).replace('TL', '').replace('₺', '')
                    fiyat_str = _safe_text(fiyat_tam_el[0]) + frac_text
                    fiyat = temizle_fiyat(fiyat_str)
                    if fiyat:
                        break

            # Eski fiyat
            eski_fiyat = None
            for eski_sel in ['[class*="price-module_oldPrice"]', '[class*="oldPrice"]']:
                eski_el = kart.css(eski_sel)
                if eski_el:
                    eski_fiyat = temizle_fiyat(_safe_text(eski_el[0]))
                    break

            # Puan
            puan = None
            puan_el = kart.css('[class*="rate-module_rating"]')
            yorum_el = kart.css('[class*="rate-module_count"]')
            if puan_el:
                p_text = _safe_text(puan_el[0])
                y_text = _safe_text(yorum_el[0]) if yorum_el else ''
                puan = f"{p_text} {y_text}".strip() if p_text else None

            if baslik and fiyat:
                urunler.append({
                    'baslik': baslik,
                    'fiyat': fiyat,
                    'eski_fiyat': eski_fiyat,
                    'url': link,
                    'puan': puan,
                    'site': 'Hepsiburada'
                })
        except Exception as e:
            log.debug(f"Hepsiburada kart parse hatası: {e}")
            continue

    if urunler:
        log.info(f"✅ Hepsiburada: {len(urunler)} ürün bulundu")
    else:
        log.warning("⚠️  Hepsiburada: sonuç bulunamadı")
    return urunler


# ────────────────────────────────────────────────────────
# AMAZON.COM.TR — HTML search result kartlarından ürün çekme
# ────────────────────────────────────────────────────────

@retry(max_tries=2, delay=1.5)
def cek_amazon(arama: str, stealth: bool = False) -> list:
    """Amazon.com.tr'den ürün fiyatlarını search result kartlarından çek."""
    url = f"https://www.amazon.com.tr/s?k={quote_plus(arama)}"
    log.info(f"📡 Amazon.com.tr sorgulanıyor: {arama}...")

    page = sayfa_getir(url, stealth=stealth)
    urunler = []

    KART_SELECTORS = [
        '[data-component-type="s-search-result"]',
        'div.s-result-item[data-asin]',
        '[data-asin]:not([data-asin=""])',
    ]
    kartlar = []
    for sel in KART_SELECTORS:
        kartlar = page.css(sel)
        if kartlar:
            break

    for kart in kartlar[:20]:
        try:
            # Başlık — birden fazla yol
            baslik = _safe_get(kart.css('h2 span::text'))
            if not baslik:
                h2_el = kart.css('h2')
                if h2_el:
                    baslik = _safe_text(h2_el[0])
            if not baslik:
                baslik = _safe_get(kart.css('[class*="a-text-normal"]::text'))
            if not baslik:
                continue

            # Fiyat — .a-offscreen en güvenilir
            fiyat = None
            fiyat_text = _safe_get(kart.css('.a-price .a-offscreen::text'))
            fiyat = temizle_fiyat(fiyat_text)

            if not fiyat:
                whole = _safe_get(kart.css('.a-price-whole::text'))
                frac = _safe_get(kart.css('.a-price-fraction::text'))
                if whole:
                    birlesik = whole.replace('.', '').replace(',', '')
                    if frac:
                        birlesik += '.' + frac
                    fiyat = temizle_fiyat(birlesik)

            if not fiyat:
                # Son çare: herhangi bir fiyat metni
                price_el = kart.css('[class*="a-price"]')
                if price_el:
                    fiyat = temizle_fiyat(_safe_text(price_el[0]))

            # Eski fiyat
            eski_text = _safe_get(kart.css('.a-price[data-a-strike] .a-offscreen::text'))
            eski_fiyat = temizle_fiyat(eski_text)

            # Link
            link = _safe_get(kart.css('h2 a::attr(href)'))
            if not link:
                link = _safe_get(kart.css('a.a-link-normal::attr(href)'))
            if link and not link.startswith('http'):
                link = f"https://www.amazon.com.tr{link}"

            # Puan
            puan_text = _safe_get(kart.css('.a-icon-alt::text'))
            puan = None
            if puan_text and ('yıldız' in puan_text.lower() or 'star' in puan_text.lower()):
                puan = puan_text

            # ASIN
            asin = _safe_attrib(kart, 'data-asin')

            if baslik and fiyat:
                urunler.append({
                    'baslik': baslik.strip(),
                    'fiyat': fiyat,
                    'eski_fiyat': eski_fiyat,
                    'url': link,
                    'puan': puan,
                    'asin': asin,
                    'site': 'Amazon'
                })
        except Exception as e:
            log.debug(f"Amazon kart parse hatası: {e}")
            continue

    if urunler:
        log.info(f"✅ Amazon: {len(urunler)} ürün bulundu")
    else:
        log.warning("⚠️  Amazon: sonuç bulunamadı")
    return urunler


# ────────────────────────────────────────────────────────
# N11 — HTML ürün kartlarından çekme
# ────────────────────────────────────────────────────────

@retry(max_tries=2, delay=1.0)
def cek_n11(arama: str, stealth: bool = False) -> list:
    """n11.com'dan ürün fiyatları çek."""
    url = f"https://www.n11.com/arama?q={quote_plus(arama)}"
    log.info(f"📡 n11 sorgulanıyor: {arama}...")

    page = sayfa_getir(url, stealth=stealth)
    urunler = []

    KART_SELECTORS = [
        'a.product-item',
        'li.column[class*="product"]',
        '[class*="productItem"]',
    ]
    kartlar = []
    for sel in KART_SELECTORS:
        kartlar = page.css(sel)
        if kartlar:
            break

    for kart in kartlar[:20]:
        try:
            # Başlık
            baslik = _safe_get(kart.css('.product-item-title::text'))
            if not baslik:
                baslik = _safe_get(kart.css('.product-text-area .product-item-title::text'))
            if not baslik:
                baslik = _safe_get(kart.css('h3::text'))

            # Güncel fiyat
            fiyat = temizle_fiyat(_safe_get(kart.css('.price-currency::text')))
            if not fiyat:
                fiyat = temizle_fiyat(_safe_get(kart.css('[class*="newPrice"]::text')))
            if not fiyat:
                fiyat = temizle_fiyat(_safe_get(kart.css('[class*="price"]::text')))

            # Eski fiyat
            eski_fiyat = temizle_fiyat(_safe_get(kart.css('.old-price .price::text')))
            if not eski_fiyat:
                eski_fiyat = temizle_fiyat(_safe_get(kart.css('[class*="oldPrice"]::text')))

            # Link
            link = _safe_attrib(kart, 'href')
            if not link:
                link = _safe_get(kart.css('a::attr(href)'))
            if link and not link.startswith('http'):
                link = f"https://www.n11.com{link}"

            # Puan
            puan_raw = _safe_get(kart.css('.rate-number-text::text'))
            puan = puan_raw.strip('()') if puan_raw else None

            if baslik and fiyat:
                urunler.append({
                    'baslik': baslik.strip(),
                    'fiyat': fiyat,
                    'eski_fiyat': eski_fiyat,
                    'url': link,
                    'puan': puan,
                    'site': 'n11'
                })
        except Exception as e:
            log.debug(f"n11 kart parse hatası: {e}")
            continue

    if urunler:
        log.info(f"✅ n11: {len(urunler)} ürün bulundu")
    else:
        log.warning("⚠️  n11: sonuç bulunamadı")
    return urunler


# ────────────────────────────────────────────────────────
# TEKNOSA — HTML ürün kartlarından çekme
# ────────────────────────────────────────────────────────

@retry(max_tries=2, delay=1.0)
def cek_teknosa(arama: str, stealth: bool = False) -> list:
    """Teknosa'dan ürün fiyatları çek."""
    url = f"https://www.teknosa.com/arama/?s={quote_plus(arama)}"
    log.info(f"📡 Teknosa sorgulanıyor: {arama}...")

    page = sayfa_getir(url, stealth=stealth)
    urunler = []

    # Yöntem 1: JSON-LD
    for s in page.css('script[type="application/ld+json"]'):
        try:
            raw = _safe_text(s)
            if not raw:
                continue
            data = json.loads(raw)
            items = []
            if isinstance(data, list):
                items = data
            elif isinstance(data, dict) and data.get('@type') == 'ItemList':
                items = data.get('itemListElement', [])
            for item in items[:20]:
                itm = item.get('item', item)
                offers = itm.get('offers', {})
                if isinstance(offers, list):
                    offers = offers[0] if offers else {}
                price = offers.get('price')
                if price:
                    item_url = itm.get('url', '')
                    if item_url and not item_url.startswith('http'):
                        item_url = f"https://www.teknosa.com{item_url}"
                    urunler.append({
                        'baslik': itm.get('name', 'Bilinmeyen'),
                        'fiyat': float(price),
                        'url': item_url,
                        'site': 'Teknosa'
                    })
        except (json.JSONDecodeError, ValueError, TypeError):
            continue

    # Yöntem 2: HTML fallback
    if not urunler:
        KART_SELECTORS = [
            '.product-card',
            '[class*="product-item"]',
            '[class*="ProductCard"]',
        ]
        kartlar = []
        for sel in KART_SELECTORS:
            kartlar = page.css(sel)
            if kartlar:
                break
        for kart in kartlar[:20]:
            try:
                baslik = _safe_get(kart.css('.product-name::text'))
                if not baslik:
                    baslik = _safe_get(kart.css('h3::text'))
                if not baslik:
                    baslik = _safe_get(kart.css('[class*="name"]::text'))

                fiyat = None
                for fiyat_sel in ['.product-price::text', '[class*="price"]::text']:
                    fiyat = temizle_fiyat(_safe_get(kart.css(fiyat_sel)))
                    if fiyat:
                        break

                link = _safe_get(kart.css('a::attr(href)'))
                if link and not link.startswith('http'):
                    link = f"https://www.teknosa.com{link}"
                if baslik and fiyat:
                    urunler.append({
                        'baslik': baslik.strip(),
                        'fiyat': fiyat,
                        'url': link,
                        'site': 'Teknosa'
                    })
            except Exception as e:
                log.debug(f"Teknosa kart parse hatası: {e}")
                continue

    if urunler:
        log.info(f"✅ Teknosa: {len(urunler)} ürün bulundu")
    else:
        log.warning("⚠️  Teknosa: sonuç bulunamadı")
    return urunler


# ────────────────────────────────────────────────────────
# VATAN BİLGİSAYAR — HTML ürün kartlarından çekme
# ────────────────────────────────────────────────────────

@retry(max_tries=2, delay=1.0)
def cek_vatan(arama: str, stealth: bool = False) -> list:
    """Vatan Bilgisayar'dan ürün fiyatları çek."""
    url = f"https://www.vatanbilgisayar.com/arama/{quote_plus(arama)}/"
    log.info(f"📡 Vatan Bilgisayar sorgulanıyor: {arama}...")

    page = sayfa_getir(url, stealth=stealth)
    urunler = []

    KART_SELECTORS = [
        'a.product-list-link',
        '[class*="product-list"] a',
        '.product-card',
    ]
    kartlar = []
    for sel in KART_SELECTORS:
        kartlar = page.css(sel)
        if kartlar:
            break

    for kart in kartlar[:20]:
        try:
            # Başlık
            baslik = _safe_get(kart.css('.product-list__product-name h3::text'))
            if not baslik:
                baslik = _safe_get(kart.css('h3::text'))
            if not baslik:
                baslik = _safe_get(kart.css('[class*="product-name"]::text'))

            # Fiyat
            fiyat = temizle_fiyat(_safe_get(kart.css('.product-list__price::text')))
            if not fiyat:
                fiyat = temizle_fiyat(_safe_get(kart.css('[class*="price"]::text')))

            # Link
            link = _safe_attrib(kart, 'href')
            if not link:
                link = _safe_get(kart.css('a::attr(href)'))
            if link and not link.startswith('http'):
                link = f"https://www.vatanbilgisayar.com{link}"

            # Ürün kodu
            kod = _safe_get(kart.css('.product-list__product-code::text'))

            if baslik and fiyat:
                urunler.append({
                    'baslik': baslik.strip(),
                    'fiyat': fiyat,
                    'url': link,
                    'urun_kodu': kod.strip() if kod else None,
                    'site': 'Vatan Bilgisayar'
                })
        except Exception as e:
            log.debug(f"Vatan kart parse hatası: {e}")
            continue

    if urunler:
        log.info(f"✅ Vatan Bilgisayar: {len(urunler)} ürün bulundu")
    else:
        log.warning("⚠️  Vatan Bilgisayar: sonuç bulunamadı")
    return urunler


# ────────────────────────────────────────────────────────
# Ana Fonksiyon
# ────────────────────────────────────────────────────────

SITE_MAP = {
    'trendyol': cek_trendyol,
    'hepsiburada': cek_hepsiburada,
    'amazon': cek_amazon,
    'n11': cek_n11,
    'teknosa': cek_teknosa,
    'vatan': cek_vatan,
}

# Varsayılan olarak çekilecek ana siteler
DEFAULT_SITES = ['trendyol', 'hepsiburada', 'amazon']


def enrich_query(q: str) -> str:
    """Kısa sorguya marka/seri adı ekle — e-ticaret sitelerinde daha iyi sonuç."""
    ql = q.lower().strip()
    ql_norm = re.sub(r'\+', ' plus ', ql)
    ql_norm = re.sub(r'\s+', ' ', ql_norm).strip()

    enrichments = [
        (r'(?:^|\b)(redmi|poco)', 'xiaomi', None),
        (r'(?:^|\b)(pixel)', 'google', None),
        (r'(?:^|\b)(oneplus|\bone\s*plus)', 'oneplus', None),
        (r'(?:^|\b)(mate\s*\d|p\d{2}|nova)', 'huawei', None),
        (r'(?:^|\b)(rtx|gtx)\s*\d', 'nvidia geforce', None),
        (r'(?:^|\b)(rx\s*\d)', 'amd radeon', None),
        (r'(?:^|\b)(s\d{2}|a\d{2}|z\s*fold|z\s*flip|m\d{2}|galaxy)',
         'samsung', 'galaxy'),
    ]

    for pattern, brand, series in enrichments:
        if re.search(pattern, ql_norm):
            if brand in ql_norm:
                if series and series not in ql_norm:
                    parts = q.split()
                    if parts and parts[0].lower() == brand:
                        return f"{parts[0]} {series} {' '.join(parts[1:])}"
                    return f"{series} {q}"
                return q
            # Seri adı zaten sorguda varsa sadece marka ekle
            if series and series in ql_norm:
                return f"{brand} {q}"
            prefix = f"{brand} {series}" if series else brand
            return f"{prefix} {q}"
    return q


def main():
    parser = argparse.ArgumentParser(
        description='FiyatAvcısı — Scrapling ile fiyat çekme aracı'
    )
    parser.add_argument('arama', help='Aranacak ürün adı')
    parser.add_argument('--site', '-s', choices=list(SITE_MAP.keys()),
                        help='Sadece belirli bir siteden çek')
    parser.add_argument('--sites', type=str,
                        help='Virgülle ayrılmış siteler (örn: trendyol,amazon,n11)')
    parser.add_argument('--all', '-a', action='store_true',
                        help='Tüm sitelerden çek (6 site)')
    parser.add_argument('--stealth', action='store_true',
                        help='StealthyFetcher (tarayıcı) kullan — Cloudflare bypass')
    parser.add_argument('--json', '-j', action='store_true',
                        help='Sonuçları JSON formatında çıktıla')
    parser.add_argument('--api', action='store_true',
                        help='API modu: mağaza bazlı min/max/count JSON çıktısı')
    parser.add_argument('--export', '-e', type=str,
                        help='Sonuçları JSON dosyasına kaydet')

    args = parser.parse_args()

    # Stealth parametresini thread-safe olarak geçir
    use_stealth = args.stealth

    # Orijinal sorgu (filtreleme için) ve zenginleştirilmiş sorgu (arama için)
    original_query = args.arama
    enriched_query = enrich_query(args.arama)
    if enriched_query != args.arama:
        args.arama = enriched_query

    # API modunda tüm print'leri stderr'e yönlendir, stdout sadece JSON için
    _real_stdout = sys.stdout
    if args.api:
        sys.stdout = sys.stderr
        log.setLevel(logging.WARNING)  # API modunda sadece uyarı ve üstü

    quiet = args.api
    if not quiet:
        mode_str = "🥷 STEALTH" if use_stealth else "⚡ HIZLI"
        print(f"\n🔎 FiyatAvcısı — Scrapling Fiyat Tarayıcı [{mode_str}]")
        print(f"📅 {datetime.now().strftime('%d.%m.%Y %H:%M')}")
        print(f"🔍 Aranan: \"{original_query}\"")
        if args.arama != original_query:
            print(f"🧠 Zenginleştirilmiş sorgu: \"{args.arama}\"")

    if args.site:
        siteler = {args.site: SITE_MAP[args.site]}
    elif args.sites:
        site_list = [s.strip().lower() for s in args.sites.split(',')]
        siteler = {k: SITE_MAP[k] for k in site_list if k in SITE_MAP}
    elif args.all:
        siteler = SITE_MAP
    else:
        siteler = {k: SITE_MAP[k] for k in DEFAULT_SITES}

    tum_sonuclar = []
    basarili = 0
    basarisiz = 0
    baslangic = time.time()

    if args.api and len(siteler) > 1:
        # API modunda paralel çalıştır (ThreadPool)
        from concurrent.futures import ThreadPoolExecutor, as_completed

        def _cek(site_adi, cek_fn):
            try:
                return site_adi, cek_fn(args.arama, stealth=use_stealth), None
            except Exception as e:
                return site_adi, [], e

        with ThreadPoolExecutor(max_workers=min(8, len(siteler))) as pool:
            futures = {pool.submit(_cek, k, fn): k for k, fn in siteler.items()}
            for fut in as_completed(futures):
                site_adi, sonuclar, hata = fut.result()
                if hata:
                    log.error(f"❌ {site_adi}: {hata}")
                    basarisiz += 1
                elif sonuclar:
                    tum_sonuclar.extend(sonuclar)
                    basarili += 1
                else:
                    basarisiz += 1
    else:
        for site_adi, cek_fn in siteler.items():
            try:
                sonuclar = cek_fn(args.arama, stealth=use_stealth)
                tum_sonuclar.extend(sonuclar)
                if sonuclar:
                    basarili += 1
                else:
                    basarisiz += 1
                if not args.json and not quiet:
                    yazdir_sonuclar(site_adi.upper(), sonuclar)
            except Exception as e:
                basarisiz += 1
                if not args.json and not quiet:
                    print(f"\n  ❌ {site_adi}: Hata — {e}")

    sure = time.time() - baslangic

    if args.api:
        # API modu: mağaza bazlı grupla + ilgili ürün filtresi
        SITE_KEY_MAP = {
            'Trendyol': 'TRENDYOL', 'Hepsiburada': 'HEPSIBURADA',
            'Amazon': 'AMAZON', 'n11': 'N11', 'Teknosa': 'TEKNOSA',
            'Vatan Bilgisayar': 'VATAN',
        }

        # ─── İlgili ürün filtresi ───
        aksesuar_kelimeleri = [
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
        ]

        _TR_MAP = str.maketrans('ıİöÖüÜşŞçÇğĞ', 'iioouussccgg')

        def normalize(text: str) -> str:
            t = text.lower().translate(_TR_MAP)
            t = t.replace('+', ' plus ')
            t = re.sub(r'\bpro\s*max\b', 'promax', t)
            t = re.sub(r'\blight\b', 'lite', t)
            t = re.sub(r'[^a-z0-9\s]', ' ', t)
            t = re.sub(r'\s+', ' ', t).strip()
            return t

        stop_words = {'ile', 'icin', 'veya', 've', 'en', 'iyi', 'ucuz', 'fiyat'}
        normalized_query = normalize(original_query.strip())
        query_words = [w for w in normalized_query.split() if (len(w) >= 2 or w.isdigit()) and w not in stop_words]

        kritik_kelimeler = [w for w in query_words if re.search(r'\d', w)]
        normal_kelimeler = [w for w in query_words if not re.search(r'\d', w)]

        def urun_ilgili_mi(baslik: str) -> bool:
            if not baslik:
                return False
            baslik_norm = normalize(baslik)

            for ak in aksesuar_kelimeleri:
                if ak in baslik_norm:
                    return False

            if 'uyumlu' in baslik_norm or 'compatible' in baslik_norm:
                return False

            for k in kritik_kelimeler:
                if k.isdigit():
                    if not re.search(r'\b' + re.escape(k) + r'\b', baslik_norm):
                        return False
                else:
                    if k not in baslik_norm:
                        return False

            if normal_kelimeler:
                eslesen = sum(1 for w in normal_kelimeler if w in baslik_norm)
                gerekli = max(1, len(normal_kelimeler) * 2 // 3)
                if eslesen < gerekli:
                    return False

            return True

        def medyan_filtre(fiyatlar: list) -> list:
            if len(fiyatlar) < 3:
                return fiyatlar
            sira = sorted(fiyatlar)
            medyan = sira[len(sira) // 2]
            alt_esik = medyan * 0.10
            ust_esik = medyan * 10
            return [f for f in fiyatlar if alt_esik <= f <= ust_esik]

        grouped = {}
        for urun in tum_sonuclar:
            if not urun_ilgili_mi(urun.get('baslik', '')):
                continue
            key = SITE_KEY_MAP.get(urun.get('site'), urun.get('site', 'UNKNOWN'))
            if key not in grouped:
                grouped[key] = {'prices': [], 'products': []}
            if urun.get('fiyat'):
                grouped[key]['prices'].append(urun['fiyat'])
            grouped[key]['products'].append({
                'title': urun.get('baslik', ''),
                'price': urun.get('fiyat'),
                'url': urun.get('url', ''),
            })

        output = {}
        for key, data in grouped.items():
            prices = medyan_filtre(data['prices']) if data['prices'] else []
            if prices:
                min_esik = min(prices)
                filtered_products = [p for p in data['products'] if p.get('price') and p['price'] >= min_esik]
                filtered_products.sort(key=lambda x: x.get('price') or float('inf'))
                output[key] = {
                    'min': min(prices),
                    'max': max(prices),
                    'count': len(prices),
                    'products': filtered_products[:5],
                }
            else:
                output[key] = {'min': None, 'max': None, 'count': 0, 'products': []}

        _real_stdout.write(json.dumps(output, ensure_ascii=False) + '\n')
        _real_stdout.flush()
        return

    if args.json:
        print(json.dumps(tum_sonuclar, ensure_ascii=False, indent=2))

    if args.export:
        with open(args.export, 'w', encoding='utf-8') as f:
            json.dump({
                'arama': args.arama,
                'tarih': datetime.now().isoformat(),
                'toplam': len(tum_sonuclar),
                'sonuclar': tum_sonuclar
            }, f, ensure_ascii=False, indent=2)
        print(f"\n  💾 Sonuçlar kaydedildi: {args.export}")

    if not args.json and not quiet:
        fiyatlilar = [u for u in tum_sonuclar if u.get('fiyat')]

        print(f"\n{'='*60}")
        print(f"  📊 ÖZET")
        print(f"{'='*60}")
        print(f"  ⏱️  Süre: {sure:.1f}s")
        print(f"  🏪 Taranan site: {basarili + basarisiz} (✅ {basarili} başarılı, ❌ {basarisiz} boş)")
        print(f"  📦 Toplam ürün: {len(tum_sonuclar)}")

        if fiyatlilar:
            fiyatlilar.sort(key=lambda x: x['fiyat'])
            en_ucuz = fiyatlilar[0]
            en_pahali = fiyatlilar[-1]
            ortalama = sum(u['fiyat'] for u in fiyatlilar) / len(fiyatlilar)

            print(f"\n  🏆 EN UCUZ:")
            print(f"     {format_fiyat(en_ucuz['fiyat'])} — {en_ucuz['baslik'][:60]}")
            print(f"     🏪 {en_ucuz['site']}")
            if en_ucuz.get('url'):
                print(f"     🔗 {en_ucuz['url'][:90]}")

            print(f"\n  💸 EN PAHALI:")
            print(f"     {format_fiyat(en_pahali['fiyat'])} — {en_pahali['baslik'][:60]}")
            print(f"     🏪 {en_pahali['site']}")

            print(f"\n  📈 Ortalama fiyat: {format_fiyat(ortalama)}")
            print(f"  📉 Fiyat aralığı: {format_fiyat(en_ucuz['fiyat'])} — {format_fiyat(en_pahali['fiyat'])}")
        print()


if __name__ == '__main__':
    main()
