const { chromium } = require('playwright');
const path = require('path');

async function testIntegration() {
    console.log('Starting Integration Test...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        bypassCSP: true,
        ignoreHTTPSErrors: true
    });
    const page = await context.newPage();

    await page.goto('http://localhost:3000/index.html');

    // Log console messages from the page
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('Searching for "iPhone"...');
    await page.fill('#queryInput', 'iPhone');
    await page.click('#searchBtn');

    console.log('Waiting for results...');
    try {
        await page.waitForSelector('.link-card', { timeout: 45000 });
        const resultsCount = await page.locator('.link-card').count();
        console.log(`Found ${resultsCount} results on page.`);

        const firstPrice = await page.locator('.link-card').first().locator('.text-xl').innerText();
        console.log(`First item price: ${firstPrice}`);

        await page.screenshot({ path: 'integration_test_result.png' });
        console.log('Integration Test PASSED');
    } catch (e) {
        console.error('Timeout or Error:', e.message);
        await page.screenshot({ path: 'integration_test_error.png' });
        process.exit(1);
    }

    await browser.close();
}

testIntegration().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
});
