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
                ]
            });
        }
    } catch (err) {
        console.error('Browser launch error:', err);
        browserInstance = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return browserInstance;
}

async function scrapeMarket(context, market, query) {
    let page;
    try {
        page = await context.newPage();
        // Block fonts and other heavy stuff
        await page.route('**/*.{woff,woff2,font,svg}', (route) => route.abort());

        await page.goto(market.searchUrl + encodeURIComponent(query), {
            waitUntil: 'domcontentloaded',
            timeout: 10000
        });

        await page.waitForSelector(market.selectors.container, { timeout: 4000 }).catch(() => {});

        const results = await page.evaluate((m) => {
            const items = Array.from(document.querySelectorAll(m.selectors.container)).slice(0, 3);
            return items.map(el => {
                const titleEl = el.querySelector(m.selectors.title);
                const priceEl = el.querySelector(m.selectors.price);
                const imageEl = el.querySelector(m.selectors.image);
                const linkEl = el.querySelector(m.selectors.link);

                const title = titleEl ? titleEl.innerText.trim() : null;
                const priceText = priceEl ? priceEl.innerText.trim() : null;
                const image = imageEl ? (imageEl.src || imageEl.getAttribute('data-src') || imageEl.getAttribute('src')) : null;
                const link = linkEl ? (linkEl.href.startsWith('http') ? linkEl.href : window.location.origin + linkEl.getAttribute('href')) : null;

                return { title, priceText, image, link };
            });
        }, market);

        await page.close();
        return results
            .filter(r => r.title && r.priceText)
            .map(r => ({ ...r, marketName: market.name }));
    } catch (e) {
        console.error(`Scrape error (${market.name}):`, e.message);
        if (page) await page.close().catch(() => {});
        return [];
    }
}

async function searchMarketplaces(query) {
    const results = [];
    let browser;
    try {
        browser = await getBrowser();
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 800 }
        });

        const scrapingPromises = MARKETS.map(market => scrapeMarket(context, market, query));
        const allScrapedResults = await Promise.all(scrapingPromises);

        allScrapedResults.flat().forEach(r => {
            if (!r) return;
            const price = parseFloat(r.priceText.replace(/[^\d]/g, '')) || null;
            if (price) {
                results.push({
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
        console.error('Search engine error:', err);
    }

    // Fallback if NO results found
    if (results.length === 0) {
        console.log('No live results found, using fallback for query:', query);
        const stores = ['AMAZON', 'TRENDYOL', 'HEPSIBURADA', 'N11', 'MEDIAMARKT'];
        const basePrices = {
            'iphone': 45000, 'samsung': 30000, 'nike': 3000, 'adidas': 2500, 'dyson': 15000, 'macbook': 50000
        };

        let base = 5000;
        for (let k in basePrices) {
            if (query.toLowerCase().includes(k)) { base = basePrices[k]; break; }
        }

        stores.slice(0, 4).forEach(store => {
            const p = base * (0.9 + Math.random() * 0.2);
            results.push({
                name: store,
                productTitle: `${query} (Tahmini Sonuç)`,
                price: p,
                priceFormatted: p.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' }),
                url: `https://www.google.com/search?q=${encodeURIComponent(query + ' ' + store)}`,
                image: null,
                type: 'DEMO'
            });
        });
    }

    return results.sort((a, b) => a.price - b.price);
}

module.exports = { searchMarketplaces };
