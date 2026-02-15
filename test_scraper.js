const { searchMarketplaces } = require('./scraper');

async function test() {
  console.log('Testing scraper for "iPhone 15"...');
  const results = await searchMarketplaces('iPhone 15');
  console.log(`Found ${results.length} results.`);
  results.forEach(r => {
    console.log(`[${r.name}] (${r.type}) ${r.productTitle}: ${r.priceFormatted}`);
  });
}

test();
