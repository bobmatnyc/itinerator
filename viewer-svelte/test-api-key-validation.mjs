/**
 * Test API key validation in ChatBox
 *
 * This script simulates the timing issue where settingsStore hasn't loaded
 * from localStorage yet when ChatBox validates the API key.
 */

import { chromium } from '@playwright/test';

async function testApiKeyValidation() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  // Listen to console logs
  page.on('console', msg => {
    if (msg.text().includes('[ChatBox]')) {
      console.log('🔍', msg.text());
    }
  });

  console.log('📝 Setting up localStorage with API key...');

  // Navigate to the app
  await page.goto('http://localhost:5177');

  // Set the API key in localStorage (simulating existing user)
  await page.evaluate(() => {
    const settings = {
      firstName: 'Test',
      lastName: 'User',
      nickname: 'Tester',
      openRouterKey: 'sk-or-v1-test-key-12345',
      homeAirport: 'SFO'
    };
    localStorage.setItem('itinerator_settings', JSON.stringify(settings));
    console.log('✅ API key set in localStorage:', settings.openRouterKey);
  });

  console.log('🔄 Reloading page to test ChatBox initialization...');
  await page.reload();

  // Wait a moment for component to mount
  await page.waitForTimeout(2000);

  // Check for error message
  const errorElement = await page.locator('.chatbox-error').count();

  if (errorElement > 0) {
    const errorText = await page.locator('.chatbox-error').textContent();
    console.log('❌ ERROR FOUND:', errorText);
  } else {
    console.log('✅ No error - API key validation passed!');
  }

  // Check localStorage directly
  const storedKey = await page.evaluate(() => {
    const settings = localStorage.getItem('itinerator_settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      return parsed.openRouterKey;
    }
    return null;
  });
  console.log('📦 API key in localStorage:', storedKey);

  // Navigate to an itinerary to trigger ChatBox
  console.log('🗺️  Navigating to first itinerary...');

  // Find first itinerary link
  const firstItinerary = page.locator('a[href*="/itineraries/"]').first();
  const itineraryExists = await firstItinerary.count() > 0;

  if (itineraryExists) {
    await firstItinerary.click();
    await page.waitForTimeout(2000);

    // Check for error in chat
    const chatError = await page.locator('.chatbox-error').count();
    if (chatError > 0) {
      const errorText = await page.locator('.chatbox-error').textContent();
      console.log('❌ CHAT ERROR:', errorText);
    } else {
      console.log('✅ Chat initialized successfully!');
    }
  } else {
    console.log('⚠️  No itineraries found - create one first');
  }

  console.log('\n📊 Test Summary:');
  console.log('- Check browser console for [ChatBox] debug logs');
  console.log('- Verify API key is correctly detected from localStorage');
  console.log('- Confirm no "No OpenRouter API key configured" error appears');

  // Keep browser open for inspection
  console.log('\n⏸️  Browser will stay open - press Ctrl+C to close');
  await page.waitForTimeout(60000);

  await browser.close();
}

testApiKeyValidation().catch(console.error);
