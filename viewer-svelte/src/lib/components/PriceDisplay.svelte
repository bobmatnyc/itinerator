<script lang="ts">
  /**
   * PriceDisplay Component
   * Displays price with optional currency conversion
   * Shows original price and converted price in target currency
   */
  import { onMount } from 'svelte';
  import type { CurrencyCode } from '$lib/types/currency';

  let {
    amount,
    currency,
    targetCurrency = 'USD',
    showConversion = true
  }: {
    amount: number;
    currency: string;
    targetCurrency?: CurrencyCode;
    showConversion?: boolean;
  } = $props();

  let convertedAmount = $state<number | null>(null);
  let isConverting = $state(false);
  let conversionError = $state(false);

  // Format amount based on currency (cents to dollars)
  function formatAmount(amt: number, curr: string): string {
    const majorUnit = amt / 100;
    return `${getCurrencySymbol(curr)}${majorUnit.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  // Get currency symbol for display
  function getCurrencySymbol(curr: string): string {
    const symbols: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      CNY: '元',
      KRW: '₩',
      THB: '฿',
      VND: '₫',
      SGD: 'S$',
      HKD: 'HK$',
      TWD: 'NT$',
      MYR: 'RM',
      IDR: 'Rp',
      PHP: '₱',
      INR: '₹',
      AUD: 'A$',
      NZD: 'NZ$',
      CAD: 'C$',
      CHF: 'CHF',
    };
    return symbols[curr] || curr;
  }

  // Convert currency via API
  async function convertCurrency() {
    if (!showConversion || currency === targetCurrency) {
      return;
    }

    isConverting = true;
    conversionError = false;

    try {
      const majorUnit = amount / 100;
      const response = await fetch(
        `/api/v1/currency/convert?from=${currency}&to=${targetCurrency}&amount=${majorUnit}`
      );

      if (!response.ok) {
        throw new Error('Conversion failed');
      }

      const data = await response.json();
      convertedAmount = Math.round(data.convertedAmount * 100); // Convert back to cents
    } catch (error) {
      console.error('Currency conversion error:', error);
      conversionError = true;
    } finally {
      isConverting = false;
    }
  }

  // Trigger conversion on mount if needed
  onMount(() => {
    convertCurrency();
  });

  // Re-convert if amount or currencies change
  $effect(() => {
    if (showConversion && currency !== targetCurrency) {
      convertCurrency();
    }
  });
</script>

<span class="price-display">
  <!-- Original price (always shown) -->
  <span class="price-original">
    {formatAmount(amount, currency)}
    {#if currency !== 'USD' && currency !== 'EUR' && currency !== 'GBP'}
      <span class="price-currency-code">{currency}</span>
    {/if}
  </span>

  <!-- Converted price (if different currency) -->
  {#if showConversion && currency !== targetCurrency}
    {#if isConverting}
      <span class="price-converted price-loading">...</span>
    {:else if convertedAmount !== null && !conversionError}
      <span class="price-converted">
        (~{formatAmount(convertedAmount, targetCurrency)}
        {#if targetCurrency !== 'USD' && targetCurrency !== 'EUR' && targetCurrency !== 'GBP'}
          {targetCurrency}
        {/if})
      </span>
    {/if}
  {/if}
</span>

<style>
  .price-display {
    display: inline-flex;
    align-items: baseline;
    gap: 0.375rem;
    font-variant-numeric: tabular-nums;
  }

  .price-original {
    font-weight: 500;
    color: var(--text-primary, #1f2937);
  }

  .price-currency-code {
    font-size: 0.875em;
    font-weight: 400;
    color: var(--text-muted, #6b7280);
    margin-left: 0.125rem;
  }

  .price-converted {
    font-size: 0.875em;
    color: var(--text-muted, #6b7280);
  }

  .price-loading {
    opacity: 0.5;
  }
</style>
