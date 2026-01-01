import { chromium, type Browser, type Page } from 'playwright';

/**
 * Interactive Trip Designer Test
 *
 * This test will:
 * 1. Login and navigate to an itinerary
 * 2. Send a message to add a restaurant
 * 3. Verify the segment appears in the UI
 * 4. Try to add the same restaurant again (duplicate detection)
 * 5. Verify duplicate is blocked
 */

const TEST_ITINERARY_ID = '00b95722-3268-42d6-92ac-edd29ee635ab';
const BASE_URL = 'http://localhost:5176';
const TEST_EMAIL = 'qa@test.com';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function loginUser(page: Page) {
  console.log('🔐 Logging in...');
  await page.goto(`${BASE_URL}/login`);
  await sleep(1000);

  await page.fill('input[type="email"]', TEST_EMAIL);
  await sleep(300);

  const passwordField = page.locator('input[type="password"]');
  if (await passwordField.count() > 0) {
    await passwordField.fill('test123');
  }

  await page.click('button[type="submit"]');
  await sleep(2000);
  console.log('✅ Login complete\n');
}

async function countSegments(page: Page): Promise<number> {
  // Look for segment cards in the detail view
  const segments = await page.locator('.segment-card, [class*="segment-item"], article').count();
  return segments;
}

async function sendChatMessage(page: Page, message: string) {
  const chatInput = page.locator('textarea').first();
  await chatInput.fill(message);
  await sleep(500);

  // Press Enter to send (not Shift+Enter)
  await chatInput.press('Enter');
  console.log(`💬 Sent message: "${message}"`);
}

async function waitForResponse(page: Page, timeoutMs = 30000) {
  console.log('⏳ Waiting for AI response...');

  // Wait for streaming to complete - look for the input to be re-enabled
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const chatInput = page.locator('textarea').first();
    const isDisabled = await chatInput.isDisabled();

    if (!isDisabled) {
      console.log('✅ Response complete');
      return true;
    }

    await sleep(500);
  }

  console.log('⚠️  Timeout waiting for response');
  return false;
}

async function runTest() {
  let browser: Browser | null = null;

  try {
    console.log('🚀 Starting Interactive Trip Designer Test\n');
    console.log('=' .repeat(60));
    console.log('Testing Recent Fixes:');
    console.log('1. segmentId extraction from tool results');
    console.log('2. Sequential tool execution (no race conditions)');
    console.log('3. Duplicate detection in SegmentService');
    console.log('=' .repeat(60));
    console.log();

    // Launch browser
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 }
    });
    const page = await context.newPage();

    // Track console messages
    const consoleMessages: string[] = [];
    page.on('console', msg => {
      const text = msg.text();
      consoleMessages.push(text);

      // Log important messages
      if (text.includes('segment') || text.includes('duplicate') || text.includes('error')) {
        console.log(`  📝 Console: ${text}`);
      }
    });

    // Track network requests
    const apiCalls: Array<{ method: string; url: string; status: number }> = [];
    page.on('response', async response => {
      if (response.url().includes('/api/')) {
        const req = {
          method: response.request().method(),
          url: response.url().replace(BASE_URL, ''),
          status: response.status()
        };
        apiCalls.push(req);

        if (req.url.includes('/segments')) {
          console.log(`  🌐 API: ${req.method} ${req.url} [${req.status}]`);
        }
      }
    });

    // Login
    await loginUser(page);

    // Navigate to itinerary
    console.log(`📍 Navigating to itinerary ${TEST_ITINERARY_ID}...\n`);
    await page.goto(`${BASE_URL}/itineraries/${TEST_ITINERARY_ID}`);
    await sleep(3000);

    // Count initial segments
    const initialSegmentCount = await countSegments(page);
    console.log(`📊 Initial segment count: ${initialSegmentCount}\n`);

    await page.screenshot({ path: '/tmp/interactive-01-before.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/interactive-01-before.png\n');

    // TEST 1: Add a new restaurant
    console.log('─'.repeat(60));
    console.log('TEST 1: Add a New Restaurant');
    console.log('─'.repeat(60));

    const restaurantMessage = 'Add a reservation at Sukiyabashi Jiro in Tokyo for dinner on March 16';
    await sendChatMessage(page, restaurantMessage);

    const responded = await waitForResponse(page, 60000);
    if (!responded) {
      console.log('⚠️  No response received, continuing anyway...');
    }

    await sleep(3000); // Wait for UI to update

    const segmentCountAfterAdd = await countSegments(page);
    console.log(`📊 Segment count after add: ${segmentCountAfterAdd}`);

    if (segmentCountAfterAdd > initialSegmentCount) {
      console.log('✅ TEST 1 PASSED: Segment was added and UI updated!');
    } else {
      console.log('❌ TEST 1 FAILED: Segment count did not increase');
    }

    await page.screenshot({ path: '/tmp/interactive-02-after-add.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/interactive-02-after-add.png\n');

    // TEST 2: Try to add the same restaurant (duplicate detection)
    console.log('─'.repeat(60));
    console.log('TEST 2: Duplicate Detection');
    console.log('─'.repeat(60));

    const duplicateMessage = 'Add a reservation at Sukiyabashi Jiro for dinner on March 16';
    await sendChatMessage(page, duplicateMessage);

    await waitForResponse(page, 60000);
    await sleep(3000);

    const segmentCountAfterDuplicate = await countSegments(page);
    console.log(`📊 Segment count after duplicate: ${segmentCountAfterDuplicate}`);

    if (segmentCountAfterDuplicate === segmentCountAfterAdd) {
      console.log('✅ TEST 2 PASSED: Duplicate was blocked, count unchanged!');
    } else {
      console.log('❌ TEST 2 FAILED: Duplicate was not blocked');
    }

    // Check if there's a message about duplicate
    const chatMessages = await page.locator('.message, [class*="chat-message"]').allTextContents();
    const hasDuplicateMessage = chatMessages.some(msg =>
      msg.toLowerCase().includes('already') ||
      msg.toLowerCase().includes('duplicate') ||
      msg.toLowerCase().includes('exists')
    );

    if (hasDuplicateMessage) {
      console.log('✅ TEST 2 BONUS: Helpful duplicate message shown to user!');
    }

    await page.screenshot({ path: '/tmp/interactive-03-after-duplicate.png', fullPage: true });
    console.log('📸 Screenshot: /tmp/interactive-03-after-duplicate.png\n');

    // Summary
    console.log('═'.repeat(60));
    console.log('TEST SUMMARY');
    console.log('═'.repeat(60));
    console.log(`Initial segments: ${initialSegmentCount}`);
    console.log(`After add: ${segmentCountAfterAdd} (expected: ${initialSegmentCount + 1})`);
    console.log(`After duplicate: ${segmentCountAfterDuplicate} (expected: ${segmentCountAfterAdd})`);
    console.log();
    console.log(`API calls made: ${apiCalls.filter(c => c.url.includes('/segments')).length}`);
    console.log(`Console messages: ${consoleMessages.length}`);
    console.log();

    const test1Pass = segmentCountAfterAdd > initialSegmentCount;
    const test2Pass = segmentCountAfterDuplicate === segmentCountAfterAdd;

    if (test1Pass && test2Pass) {
      console.log('🎉 ALL TESTS PASSED!');
    } else {
      console.log('⚠️  SOME TESTS FAILED - Review screenshots and logs');
    }
    console.log('═'.repeat(60));

    // Keep browser open
    console.log('\n⏸️  Browser will remain open for 60 seconds for inspection...');
    await sleep(60000);

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Run the test
runTest().catch(console.error);
