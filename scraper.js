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
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            });
        }
    } catch (err) {
        console.error('Failed to launch browser, retrying...', err);
        browserInstance = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
    }
    return browserInstance;
}

async function scrapeMarket(context, market, query) {
    const page = await context.newPage();
    try {
        // Optimization: Block unnecessary resources but be careful with images if we want them
        await page.route('**/*.{woff,woff2,css,font,svg}', (route) => route.abort());

        await page.goto(market.searchUrl + encodeURIComponent(query), {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Wait for results to load
        await page.waitForSelector(market.selectors.container, { timeout: 6000 }).catch(() => {});

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
                const link = linkEl ? linkEl.href : null;

                return { title, priceText, image, link };
            });
        }, market);

        await page.close();
        return results
            .filter(r => r.title && r.priceText)
            .map(r => ({ ...r, marketName: market.name }));
    } catch (e) {
        console.error(`Error scraping ${market.name}:`, e.message);
        try { await page.close(); } catch(err) {}
        return [];
    }
}

async function searchMarketplaces(query) {
    const results = [];
    const browser = await getBrowser();

    try {
        const context = await browser.newContext({
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            viewport: { width: 1280, height: 720 },
            extraHTTPHeaders: {
                'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        const scrapingPromises = MARKETS.map(market => scrapeMarket(context, market, query));
        const allScrapedResults = await Promise.all(scrapingPromises);

        allScrapedResults.flat().forEach(r => {
            // Price parsing refinement
            let cleanPrice = r.priceText.replace(/[^\d,]/g, '').replace(',', '.');
            if (cleanPrice.split('.').length > 2) {
                // Handle cases like 1.234,56 where we might have multiple dots
                const parts = r.priceText.replace(/[^\d,.]/g, '').split(/[.,]/);
                if (parts.length > 1) {
                    const decimal = parts.pop();
                    const whole = parts.join('');
                    cleanPrice = `${whole}.${decimal}`;
                }
            }

            const price = parseFloat(cleanPrice) || null;

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
        console.error('Search failed:', err.stack);
    }

    return results.sort((a, b) => a.price - b.price);
}

module.exports = { searchMarketplaces };
