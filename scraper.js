const { chromium } = require('playwright');

const MARKETS = [
  {
    name: 'AMAZON',
    searchUrl: 'https://www.amazon.com.tr/s?k=',
    selectors: {
      container: '.s-result-item[data-component-type="s-search-result"]',
      title: 'h2 a span',
      price: '.a-price-whole',
      image: '.s-image',
      link: 'h2 a'
    }
  },
  {
    name: 'TRENDYOL',
    searchUrl: 'https://www.trendyol.com/sr?q=',
    selectors: {
      container: '.p-card-wrppr',
      title: '.prdct-desc-cntnr-name',
      price: '.prc-box-dscntd',
      image: '.p-card-img',
      link: 'a'
    }
  },
  {
    name: 'HEPSIBURADA',
    searchUrl: 'https://www.hepsiburada.com/ara?q=',
    selectors: {
        container: 'li[class*="productListContent"]',
        title: 'h3[data-test-id="product-card-name"]',
        price: 'div[data-test-id="price-current-price"]',
        image: 'img[data-test-id="product-image"]',
        link: 'a'
    }
  }
];

let browserInstance = null;

async function getBrowser() {
    try {
        if (!browserInstance || !browserInstance.isConnected()) {
            browserInstance = await chromium.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-dev-shm-usage'
                ]
            });
        }
    } catch (err) {
        console.error('Browser launch failed:', err.message);
        // Fallback to launch again if possible
        browserInstance = await chromium.launch({
            headless: true,
            args: ['--no-sandbox']
        });
    }
    return browserInstance;
}

function parseTurkishPrice(priceText) {
    if (!priceText) return null;
    // Remove currency symbols and non-numeric chars except , and .
    let clean = priceText.replace(/[^\d,.]/g, '');

    // Turkish: 1.234,56 -> 1234.56
    // If it has both . and ,
    if (clean.includes('.') && clean.includes(',')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    }
    // If it only has , it's likely the decimal separator
    else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }
    // If it has multiple dots like 1.234.567 (rare but possible)
    else if ((clean.match(/\./g) || []).length > 1) {
        clean = clean.replace(/\./g, '');
    }

    return parseFloat(clean) || null;
}

async function scrapeMarket(context, market, query) {
    let page;
    try {
        page = await context.newPage();
        // Block heavy resources
        await page.route('**/*.{woff,woff2,font,svg,png,jpg,jpeg,gif}', (route) => {
            // Allow images if it's the first page load to see if it works, but usually we block for speed
            route.abort();
        });

        await page.goto(market.searchUrl + encodeURIComponent(query), {
            waitUntil: 'domcontentloaded',
            timeout: 12000
        });

        await page.waitForSelector(market.selectors.container, { timeout: 5000 }).catch(() => {});

        const results = await page.evaluate((m) => {
            const items = Array.from(document.querySelectorAll(m.selectors.container)).slice(0, 4);
            return items.map(el => {
                const titleEl = el.querySelector(m.selectors.title);
                const priceEl = el.querySelector(m.selectors.price);
                const imageEl = el.querySelector(m.selectors.image);
                const linkEl = el.querySelector(m.selectors.link);

                const title = titleEl ? titleEl.innerText.trim() : null;
                const priceText = priceEl ? priceEl.innerText.trim() : null;
                const image = imageEl ? (imageEl.src || imageEl.getAttribute('data-src') || imageEl.getAttribute('src')) : null;

                let link = linkEl ? linkEl.getAttribute('href') : null;
                if (link && !link.startsWith('http')) {
                    link = window.location.origin + (link.startsWith('/') ? link : '/' + link);
                }

                return { title, priceText, image, link };
            });
        }, market);

        await page.close();
        return results
            .filter(r => r.title && r.priceText)
            .map(r => ({ ...r, marketName: market.name }));
    } catch (e) {
        console.error(`Scrape Error [${market.name}]:`, e.message);
        if (page) await page.close().catch(() => {});
        return [];
    }
}

async function searchMarketplaces(query) {
    let finalResults = [];
    let browser;

    try {
        browser = await getBrowser();
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });

        const scrapingPromises = MARKETS.map(market => scrapeMarket(context, market, query));
        const allScrapedResults = await Promise.all(scrapingPromises);

        allScrapedResults.flat().forEach(r => {
            const price = parseTurkishPrice(r.priceText);
            if (price) {
                finalResults.push({
                    name: r.marketName,
                    productTitle: r.title,
                    price: price,
                    priceFormatted: price.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
                    url: r.link,
                    image: r.image,
                    type: 'LIVE'
                });
            }
        });

        await context.close();
    } catch (err) {
        console.error('Search Strategy Error:', err.message);
    }

    // Comprehensive Fallback
    if (finalResults.length === 0) {
        console.log('Using fallback for:', query);
        const demoMarkets = ['AMAZON', 'TRENDYOL', 'HEPSIBURADA', 'MEDIAMARKT', 'VATAN'];
        const basePrices = {
            'iphone': 65000, 'samsung': 40000, 'macbook': 75000, 'rtx': 35000,
            'nike': 4500, 'adidas': 4000, 'dyson': 22000, 'lego': 3500, 'ps5': 28000
        };

        let base = 10000;
        const lowQ = query.toLowerCase();
        for (let k in basePrices) {
            if (lowQ.includes(k)) { base = basePrices[k]; break; }
        }

        demoMarkets.forEach((m, idx) => {
            const p = base * (0.85 + (idx * 0.05) + Math.random() * 0.1);
            finalResults.push({
                name: m,
                productTitle: `${query} - En Uygun Fiyat Garantisi`,
                price: p,
                priceFormatted: p.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
                url: `https://www.google.com/search?q=${encodeURIComponent(query + ' ' + m)}`,
                image: null,
                type: 'DEMO'
            });
        });
    }

    return finalResults.sort((a, b) => a.price - b.price);
}

module.exports = { searchMarketplaces };
