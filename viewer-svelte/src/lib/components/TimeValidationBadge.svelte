<script lang="ts">
  import type { TimeValidationResult } from '$lib/types/time-validator';

  let {
    validation,
    onFix
  }: {
    validation: TimeValidationResult;
    onFix?: (suggestedTime: string) => void;
  } = $props();

  // Get badge color based on severity
  function getBadgeColor(severity?: string): string {
    switch (severity) {
      case 'error':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'warning':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'info':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  }

  // Get icon based on severity
  function getIcon(severity?: string): string {
    switch (severity) {
      case 'error':
        return '⚠️';
      case 'warning':
        return '⚡';
      case 'info':
        return 'ℹ️';
      default:
        return '❓';
    }
  }

  let showTooltip = $state(false);
</script>

<div class="relative inline-flex items-center">
  <!-- Badge -->
  <button
    type="button"
    class="time-validation-badge {getBadgeColor(validation.severity)}"
    onmouseenter={() => showTooltip = true}
    onmouseleave={() => showTooltip = false}
    onclick={() => showTooltip = !showTooltip}
  >
    <span class="icon">{getIcon(validation.severity)}</span>
    <span class="label">Time issue</span>
  </button>

  <!-- Tooltip -->
  {#if showTooltip}
    <div class="tooltip">
      <div class="tooltip-content">
        <p class="tooltip-title">Time Validation Issue</p>
        <p class="tooltip-issue">{validation.issue}</p>
        {#if validation.suggestedTime && onFix}
          <button
            type="button"
            class="fix-button"
            onclick={() => {
              if (validation.suggestedTime && onFix) {
                onFix(validation.suggestedTime);
              }
              showTooltip = false;
            }}
          >
            Fix to {validation.suggestedTime}
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .time-validation-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .time-validation-badge:hover {
    opacity: 0.8;
  }

  .icon {
    font-size: 0.875rem;
  }

  .label {
    white-space: nowrap;
  }

  .tooltip {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: 0.5rem;
    z-index: 50;
    pointer-events: none;
  }

  .tooltip-content {
    background-color: #1f2937;
    color: white;
    padding: 0.75rem;
    border-radius: 0.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
    min-width: 200px;
    max-width: 300px;
    pointer-events: auto;
  }

  .tooltip-title {
    font-weight: 600;
    font-size: 0.875rem;
    margin-bottom: 0.5rem;
  }

  .tooltip-issue {
    font-size: 0.875rem;
    margin-bottom: 0.75rem;
    line-height: 1.4;
  }

  .fix-button {
    width: 100%;
    padding: 0.5rem;
    background-color: #3b82f6;
    color: white;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .fix-button:hover {
    background-color: #2563eb;
  }

  .fix-button:active {
    background-color: #1d4ed8;
  }

  /* Arrow pointing down */
  .tooltip-content::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: #1f2937;
  }
</style>
