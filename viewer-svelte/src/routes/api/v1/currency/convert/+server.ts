/**
 * Currency Conversion API Endpoint
 * GET /api/v1/currency/convert?from=JPY&to=USD&amount=15000
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { CurrencyExchangeService } from '$lib/services/currency-exchange.service';
import type { CurrencyCode } from '$lib/types/currency';

// Shared service instance for cache benefits
const currencyService = new CurrencyExchangeService();

export const GET: RequestHandler = async ({ url }) => {
  try {
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    const amountStr = url.searchParams.get('amount');

    // Validate parameters
    if (!from || !to || !amountStr) {
      return json(
        { error: 'Missing required parameters: from, to, amount' },
        { status: 400 }
      );
    }

    const amount = Number.parseFloat(amountStr);
    if (Number.isNaN(amount) || amount <= 0) {
      return json(
        { error: 'Invalid amount: must be a positive number' },
        { status: 400 }
      );
    }

    // Perform conversion
    const result = await currencyService.convert(
      amount,
      from as CurrencyCode,
      to as CurrencyCode
    );

    return json(result);
  } catch (error) {
    console.error('Currency conversion error:', error);
    return json(
      {
        error: 'Currency conversion failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
};
