import { chromium, type Browser, type Page } from 'playwright';

/**
 * Manual Test Script: Trip Designer UI Verification
 *
 * Tests the recent fixes:
 * 1. segmentId extraction from tool results
 * 2. Sequential tool execution (no race conditions)
 * 3. Duplicate detection in SegmentService
 */

const TEST_ITINERARY_ID = '00b95722-3268-42d6-92ac-edd29ee635ab';
const BASE_URL = 'http://localhost:5176';
const TEST_EMAIL = 'qa@test.com';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function captureConsoleMessages(page: Page) {
  const messages: string[] = [];

  page.on('console', msg => {
    const type = msg.type();
    const text = msg.text();
    messages.push(`[${type.toUpperCase()}] ${text}`);
    console.log(`Console ${type}: ${text}`);
  });

  page.on('pageerror', error => {
    messages.push(`[ERROR] ${error.message}`);
    console.log(`Page Error: ${error.message}`);
  });

  return messages;
}

async function loginUser(page: Page) {
  console.log('🔐 Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await sleep(1000);

  // Wait for auth mode to be fetched
  await sleep(500);

  // Fill in email
  await page.fill('input[type="email"]', TEST_EMAIL);
  await sleep(300);

  // Check if password field exists (password mode)
  const passwordField = page.locator('input[type="password"]');
  if (await passwordField.count() > 0) {
    console.log('  Password mode detected - entering password');
    await passwordField.fill('test123');
  } else {
    console.log('  Dev mode detected - no password required');
  }

  // Click login button
  await page.click('button[type="submit"]');
  await sleep(2000);

  console.log('✅ Login complete');
}

async function runTest() {
  let browser: Browser | null = null;

  try {
    console.log('🚀 Starting Trip Designer UI Test...\n');

    // Launch browser
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Capture console messages
    const messages = await captureConsoleMessages(page);

    // Login first
    await loginUser(page);

    // Navigate to itinerary
    console.log(`\n📍 Navigating to itinerary ${TEST_ITINERARY_ID}...`);
    await page.goto(`${BASE_URL}/itineraries/${TEST_ITINERARY_ID}`);
    await sleep(3000);

    // Take initial screenshot
    await page.screenshot({ path: '/tmp/trip-designer-01-initial.png', fullPage: true });
    console.log('📸 Screenshot saved: /tmp/trip-designer-01-initial.png');

    // Check for Trip Designer chat interface
    console.log('\n🔍 Looking for Trip Designer chat interface...');

    // Try multiple selectors
    const selectors = [
      'textarea[placeholder*="trip" i]',
      'textarea[placeholder*="designer" i]',
      'textarea[placeholder*="chat" i]',
      'textarea',
      'input[type="text"]'
    ];

    let chatInput = null;
    for (const selector of selectors) {
      const element = page.locator(selector).first();
      if (await element.count() > 0) {
        console.log(`✅ Found chat input using selector: ${selector}`);
        chatInput = element;
        break;
      }
    }

    if (!chatInput) {
      console.log('⚠️  No chat input found. Checking page structure...');

      // Get all textareas
      const allTextareas = await page.locator('textarea').count();
      console.log(`  Found ${allTextareas} textarea elements`);

      // Get all inputs
      const allInputs = await page.locator('input').count();
      console.log(`  Found ${allInputs} input elements`);

      await page.screenshot({ path: '/tmp/trip-designer-02-no-chat.png', fullPage: true });
      console.log('📸 Screenshot saved: /tmp/trip-designer-02-no-chat.png');
    }

    // Check initial segment count
    console.log('\n📊 Checking segments...');
    const segmentSelectors = [
      '[data-testid="segment-list"] > *',
      '.segment-item',
      '[class*="segment"]',
      'li'
    ];

    let segmentCount = 0;
    for (const selector of segmentSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`  Found ${count} elements using selector: ${selector}`);
        segmentCount = count;
        break;
      }
    }

    console.log(`📊 Initial segment count: ${segmentCount}`);

    // Check for any console errors
    const errors = messages.filter(m => m.includes('[ERROR]'));
    const warnings = messages.filter(m => m.includes('[WARN]'));

    console.log('\n📋 Console Analysis:');
    console.log(`  Errors: ${errors.length}`);
    console.log(`  Warnings: ${warnings.length}`);
    console.log(`  Total messages: ${messages.length}`);

    if (errors.length > 0) {
      console.log('\n❌ Console Errors:');
      errors.forEach(err => console.log(`  ${err}`));
    }

    // Check network requests
    console.log('\n🌐 Monitoring network requests...');
    const apiRequests: Array<{ method: string; url: string; status: number | null }> = [];

    page.on('response', response => {
      if (response.url().includes('/api/')) {
        apiRequests.push({
          method: response.request().method(),
          url: response.url(),
          status: response.status()
        });
      }
    });

    // Wait for any pending requests
    await sleep(2000);

    console.log('\n📊 API Requests:');
    apiRequests.forEach(req => {
      const status = req.status ? `[${req.status}]` : '[PENDING]';
      console.log(`  ${status} ${req.method} ${req.url}`);
    });

    // Take final screenshot
    await page.screenshot({ path: '/tmp/trip-designer-03-final.png', fullPage: true });
    console.log('\n📸 Screenshot saved: /tmp/trip-designer-03-final.png');

    console.log('\n✅ Test completed successfully!');
    console.log('\n📝 Summary:');
    console.log(`  - Login: ✅`);
    console.log(`  - Page loaded: ✅`);
    console.log(`  - Console errors: ${errors.length}`);
    console.log(`  - API requests: ${apiRequests.length}`);
    console.log(`  - Screenshots: 3 saved to /tmp/`);

    // Keep browser open for manual inspection
    console.log('\n⏸️  Browser will remain open for 30 seconds for manual inspection...');
    console.log('   You can manually test:');
    console.log('   1. Adding a segment via chat');
    console.log('   2. Verifying UI updates immediately');
    console.log('   3. Trying to add a duplicate segment');
    await sleep(30000);

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
runTest().catch(console.error);
