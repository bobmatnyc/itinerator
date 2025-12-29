<script lang="ts">
  /**
   * EditModeToggle - Segmented control for switching between AI and Manual edit modes
   */

  export type EditMode = 'ai' | 'manual';

  interface Props {
    mode: EditMode;
    onChange: (mode: EditMode) => void;
  }

  let { mode = $bindable(), onChange }: Props = $props();

  function handleModeChange(newMode: EditMode) {
    mode = newMode;
    onChange?.(newMode);
  }
</script>

<div class="edit-mode-toggle">
  <button
    class="toggle-option"
    class:active={mode === 'manual'}
    onclick={() => handleModeChange('manual')}
    type="button"
    aria-pressed={mode === 'manual'}
  >
    ✏️ Manual Edit
  </button>
  <button
    class="toggle-option"
    class:active={mode === 'ai'}
    onclick={() => handleModeChange('ai')}
    type="button"
    aria-pressed={mode === 'ai'}
  >
    🤖 AI Trip Designer
  </button>
</div>

<style>
  .edit-mode-toggle {
    display: inline-flex;
    background-color: #f3f4f6;
    border-radius: 0.5rem;
    padding: 0.25rem;
    gap: 0.25rem;
  }

  .toggle-option {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    background-color: transparent;
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .toggle-option:hover:not(.active) {
    color: #1f2937;
    background-color: #e5e7eb;
  }

  .toggle-option.active {
    background-color: #ffffff;
    color: #1f2937;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
  }
</style>
