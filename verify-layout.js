import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Collect console messages
  const consoleMessages = [];
  page.on('console', msg => {
    consoleMessages.push({
      type: msg.type(),
      text: msg.text()
    });
  });

  // Collect errors
  const errors = [];
  page.on('pageerror', error => {
    errors.push(error.message);
  });

  try {
    // Navigate to the URL
    console.log('Navigating to URL...');
    await page.goto('https://tripbot.ngrok.io/itineraries/f6f505b6-0408-4841-b305-050f40e490b3', {
      waitUntil: 'networkidle',
      timeout: 30000
    });

    // Wait a bit for any dynamic content to load
    await page.waitForTimeout(2000);

    // Take screenshot
    console.log('Taking screenshot...');
    await page.screenshot({
      path: '/Users/masa/Projects/itinerizer-ts/layout-verification.png',
      fullPage: false
    });

    // Get page title
    const title = await page.title();
    console.log(`Page title: ${title}`);

    // Check for main layout elements
    const leftPane = await page.locator('[class*="itinerary-list"], [class*="sidebar"], aside, nav').first().count();
    const rightPane = await page.locator('[class*="detail"], [class*="content"], main').first().count();

    console.log(`\n=== Layout Analysis ===`);
    console.log(`Left pane elements found: ${leftPane}`);
    console.log(`Right pane elements found: ${rightPane}`);

    // Check for any chat sidebar
    const chatElements = await page.locator('[class*="chat"]').count();
    console.log(`Chat elements found: ${chatElements}`);

    // Output console errors
    console.log(`\n=== Console Errors ===`);
    const errorLogs = consoleMessages.filter(m => m.type === 'error');
    if (errorLogs.length > 0) {
      errorLogs.forEach(log => console.log(`ERROR: ${log.text}`));
    } else {
      console.log('No console errors found');
    }

    // Output page errors
    if (errors.length > 0) {
      console.log(`\n=== Page Errors ===`);
      errors.forEach(err => console.log(`ERROR: ${err}`));
    }

    console.log('\nScreenshot saved to: layout-verification.png');

  } catch (error) {
    console.error('Error during verification:', error.message);
  } finally {
    await browser.close();
  }
})();
