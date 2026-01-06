/**
 * Currency Conversion Example
 * Demonstrates how to use the currency exchange service in the itinerator
 */

import { CurrencyExchangeService } from '../src/services/currency-exchange.service.js';
import { parsePrice, parsePrices } from '../src/utils/price-parser.js';
import { convertPriceString, convertPriceStrings } from '../src/utils/price-converter.js';

/**
 * Example 1: Basic currency conversion
 */
async function basicConversion() {
  console.log('=== Example 1: Basic Currency Conversion ===\n');

  const service = new CurrencyExchangeService();

  // Get exchange rate
  const rate = await service.getRate('JPY', 'USD');
  console.log('JPY → USD rate:', rate.rate);
  console.log('Source:', rate.source);
  console.log('Timestamp:', rate.timestamp);

  // Convert amount
  const result = await service.convert(15000, 'JPY', 'USD');
  console.log(`\n¥${result.originalAmount} = $${result.convertedAmount.toFixed(2)}`);
}

/**
 * Example 2: Parse and convert activity prices
 */
async function activityPricing() {
  console.log('\n=== Example 2: Activity Pricing ===\n');

  const activities = [
    { name: 'Sushi Making Class', price: '¥15,000-20,000 per person' },
    { name: 'Onsen Visit', price: '¥800-1,500 per person' },
    { name: 'Guided Temple Tour', price: '¥5,000 per person' },
  ];

  for (const activity of activities) {
    const converted = await convertPriceString(activity.price, 'USD');
    console.log(`${activity.name}:`);
    console.log(`  Original: ${activity.price}`);
    console.log(`  Converted: ${converted}`);
    console.log();
  }
}

/**
 * Example 3: Multi-currency trip budget
 */
async function tripBudget() {
  console.log('\n=== Example 3: Multi-Currency Trip Budget ===\n');

  const expenses = [
    { category: 'Flights', amount: '$1,200' },
    { category: 'Hotels in Tokyo', amount: '¥80,000-100,000' },
    { category: 'Activities', amount: '¥50,000' },
    { category: 'Food in Paris', amount: '€500-700' },
    { category: 'Transportation', amount: '€200' },
  ];

  const userCurrency = 'USD';
  console.log(`Converting all expenses to ${userCurrency}:\n`);

  const service = new CurrencyExchangeService();

  for (const expense of expenses) {
    const parsed = parsePrice(expense.amount);
    if (!parsed) {
      console.log(`${expense.category}: ${expense.amount} (invalid format)`);
      continue;
    }

    if (parsed.currency === userCurrency) {
      console.log(`${expense.category}: ${expense.amount} (no conversion needed)`);
      continue;
    }

    const converted = await convertPriceString(expense.amount, userCurrency);
    console.log(`${expense.category}: ${converted}`);
  }
}

/**
 * Example 4: Batch conversion with cache benefits
 */
async function batchConversion() {
  console.log('\n=== Example 4: Batch Conversion (Cache Demo) ===\n');

  const service = new CurrencyExchangeService();

  // Convert multiple prices in the same currency (uses cache)
  const japanPrices = [
    '¥15,000',
    '¥20,000',
    '¥8,500',
    '¥3,200',
    '¥12,000',
  ];

  console.log('Converting 5 Japan prices to USD...');
  console.time('Batch conversion');

  const converted = await convertPriceStrings(japanPrices, 'USD', service);

  console.timeEnd('Batch conversion');

  converted.forEach((price, i) => {
    console.log(`  ${japanPrices[i]} → ${price}`);
  });

  // Show cache stats
  const stats = service.getCacheStats();
  console.log(`\nCache stats: ${stats.size} entries cached`);
  console.log('Note: Only 1 API call made for all 5 conversions!');
}

/**
 * Example 5: Parse various price formats
 */
async function priceFormats() {
  console.log('\n=== Example 5: Price Format Parsing ===\n');

  const examples = [
    '¥15,000-20,000 per person',
    '$100.50 each',
    '€50-75 per night',
    'S$45.00',
    'HK$250-350',
    '฿800-1,200',
    '₩50,000',
    'R$150.75',
  ];

  for (const example of examples) {
    const parsed = parsePrice(example);
    if (parsed) {
      console.log(`Input: "${example}"`);
      console.log(`  Currency: ${parsed.currency}`);
      console.log(`  Amount: ${parsed.minAmount}${parsed.maxAmount ? `-${parsed.maxAmount}` : ''}`);
      console.log(`  Range: ${parsed.isRange ? 'Yes' : 'No'}`);
      if (parsed.context) {
        console.log(`  Context: ${parsed.context}`);
      }
      console.log();
    }
  }
}

/**
 * Example 6: Parse multiple prices from text
 */
async function multiplePrices() {
  console.log('\n=== Example 6: Extract Multiple Prices ===\n');

  const description = 'Tour includes lunch (¥2,000), entrance fee (¥1,500), and guide (¥8,000). Optional dinner available for ¥5,000 per person.';

  console.log(`Text: "${description}"\n`);

  const prices = parsePrices(description);
  console.log(`Found ${prices.length} prices:\n`);

  for (const price of prices) {
    console.log(`  ${price.currency} ${price.minAmount}${price.context ? ` ${price.context}` : ''}`);
  }

  // Convert all to USD
  console.log('\nConverted to USD:');
  for (const price of prices) {
    const converted = await convertPriceString(
      `${price.currency} ${price.minAmount}${price.context ? ` ${price.context}` : ''}`,
      'USD'
    );
    console.log(`  ${converted}`);
  }
}

/**
 * Run all examples
 */
async function main() {
  try {
    await basicConversion();
    await activityPricing();
    await tripBudget();
    await batchConversion();
    await priceFormats();
    await multiplePrices();

    console.log('\n✅ All examples completed successfully!');
  } catch (error) {
    console.error('❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
