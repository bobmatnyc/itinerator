<script lang="ts">
  import type { Snippet, Component } from 'svelte';

  interface SubTab {
    id: string;
    label: string;
    icon?: Component;
  }

  interface Props {
    title?: string;
    tabs?: SubTab[];
    activeTab?: string;
    onTabChange?: (tabId: string) => void;
    children?: Snippet;
    actions?: Snippet;
  }

  let {
    title,
    tabs = [],
    activeTab = '',
    onTabChange,
    children,
    actions
  }: Props = $props();

  // Emit tab change event
  function handleTabClick(tabId: string) {
    onTabChange?.(tabId);
  }
</script>

<div class="main-pane">
  {#if title || tabs.length > 0}
    <div class="main-pane-header">
      {#if title}
        <div class="main-pane-title-row">
          <h2 class="main-pane-title">{title}</h2>
          {#if actions}
            <div class="main-pane-actions">
              {@render actions()}
            </div>
          {/if}
        </div>
      {/if}

      {#if tabs.length > 0}
        <div class="tabs">
          {#each tabs as tab}
            <button
              class="tab-button"
              class:active={activeTab === tab.id}
              onclick={() => handleTabClick(tab.id)}
              type="button"
            >
              {#if tab.icon}
                {@const IconComponent = tab.icon}
                <IconComponent size={16} weight="regular" />
              {/if}
              {tab.label}
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  <div class="main-pane-content">
    {@render children?.()}
  </div>
</div>

<style>
  .main-pane {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background-color: #fafafa;
  }

  .main-pane-header {
    background-color: #ffffff;
    border-bottom: 1px solid #e5e7eb;
  }

  .main-pane-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
    gap: 1rem;
  }

  .main-pane-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1f2937;
    margin: 0;
  }

  .main-pane-actions {
    display: flex;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    padding: 1rem 1.5rem;
  }

  .tab-button {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: #6b7280;
    background-color: transparent;
    border: none;
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-button:hover {
    color: #1f2937;
  }

  .tab-button.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }

  .tab-icon {
    font-size: 1rem;
  }

  .main-pane-content {
    flex: 1;
    overflow: hidden;
  }
</style>
