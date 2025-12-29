/**
 * Navigation Store - Svelte 5 Runes
 *
 * Manages application navigation state and URL synchronization.
 * Provides centralized control over view switching, modals, and tabs.
 */

// SSR-safe browser check
const isBrowser = typeof window !== 'undefined';

/**
 * Main application views
 */
export type MainView = 'home' | 'itinerary-detail' | 'new-trip-helper' | 'import' | 'help';

/**
 * Left sidebar pane tabs
 */
export type LeftPaneTab = 'chat' | 'itineraries';

/**
 * Detail view tabs (for itinerary detail view)
 */
export type DetailTab = 'itinerary' | 'calendar' | 'map' | 'travelers' | 'docs' | 'faq';

/**
 * Agent chat modes
 */
export type AgentMode = 'trip-designer' | 'help';

/**
 * Itinerary edit modes
 */
export type EditMode = 'ai' | 'manual';

/**
 * Navigation state using Svelte 5 $state rune
 */
class NavigationStore {
  // View state
  mainView = $state<MainView>('home');
  leftPaneTab = $state<LeftPaneTab>('chat');
  detailTab = $state<DetailTab>('itinerary');
  agentMode = $state<AgentMode>('trip-designer');
  editMode = $state<EditMode>('ai');

  // Modal state
  importModalOpen = $state(false);
  textImportModalOpen = $state(false);
  editModalOpen = $state(false);

  // Edit state
  editingItinerary = $state<any | null>(null);

  constructor() {
    // No initialization needed - SSR-safe by design
  }

  /**
   * Navigate to home view
   */
  goHome(): void {
    this.mainView = 'home';
    this.leftPaneTab = 'chat';
    this.agentMode = 'trip-designer';
  }

  /**
   * Navigate to itinerary view
   * @param hasContent - Whether the itinerary has content
   */
  goToItinerary(hasContent: boolean): void {
    if (hasContent) {
      this.mainView = 'itinerary-detail';
      this.leftPaneTab = 'chat';
    } else {
      this.mainView = 'new-trip-helper';
      this.leftPaneTab = 'chat';
    }
    this.agentMode = 'trip-designer';
  }

  /**
   * Navigate to new trip helper view
   * Atomically updates all related state to prevent inconsistencies
   */
  goToNewTripHelper(): void {
    this.mainView = 'new-trip-helper';
    this.leftPaneTab = 'chat';
    this.agentMode = 'trip-designer';
    this.detailTab = 'itinerary';
  }

  /**
   * Navigate to itinerary detail view
   * Atomically updates all related state to prevent inconsistencies
   */
  goToItineraryDetail(): void {
    this.mainView = 'itinerary-detail';
    this.leftPaneTab = 'chat';
    this.agentMode = 'trip-designer';
    this.detailTab = 'itinerary';
  }

  /**
   * Navigate to help view
   */
  goToHelp(): void {
    this.mainView = 'help';
    this.detailTab = 'docs';
    this.agentMode = 'help';
    this.leftPaneTab = 'chat';
  }

  /**
   * Navigate to import view
   */
  goToImport(): void {
    this.mainView = 'import';
    this.leftPaneTab = 'itineraries';
  }

  /**
   * Open file import modal
   */
  openImportModal(): void {
    this.importModalOpen = true;
  }

  /**
   * Close file import modal
   */
  closeImportModal(): void {
    this.importModalOpen = false;
  }

  /**
   * Open text import modal
   */
  openTextImportModal(): void {
    this.textImportModalOpen = true;
  }

  /**
   * Close text import modal
   */
  closeTextImportModal(): void {
    this.textImportModalOpen = false;
  }

  /**
   * Open edit modal with itinerary
   * @param itinerary - Itinerary to edit
   */
  openEditModal(itinerary: any): void {
    this.editingItinerary = itinerary;
    this.editModalOpen = true;
  }

  /**
   * Close edit modal and clear editing itinerary
   */
  closeEditModal(): void {
    this.editModalOpen = false;
    this.editingItinerary = null;
  }

  /**
   * Set active detail tab
   * @param tab - Detail tab to activate
   */
  setDetailTab(tab: DetailTab): void {
    this.detailTab = tab;
  }

  /**
   * Set active left pane tab
   * @param tab - Left pane tab to activate
   */
  setLeftPaneTab(tab: LeftPaneTab): void {
    this.leftPaneTab = tab;
  }

  /**
   * Set agent mode
   * @param mode - Agent mode to set
   */
  setAgentMode(mode: AgentMode): void {
    this.agentMode = mode;
  }

  /**
   * Set edit mode
   * @param mode - Edit mode to set
   */
  setEditMode(mode: EditMode): void {
    this.editMode = mode;
  }

  /**
   * Sync navigation state from URL parameters
   * @param params - URLSearchParams from current URL
   */
  syncFromUrl(params: URLSearchParams): void {
    const mode = params.get('mode');
    const view = params.get('view');

    // Handle mode parameter
    if (mode === 'help') {
      this.goToHelp();
      return;
    }

    // Handle view parameter
    if (view === 'import') {
      this.goToImport();
      return;
    }

    // Handle detail tab parameter
    const tab = params.get('tab');
    if (tab && this.isValidDetailTab(tab)) {
      this.detailTab = tab as DetailTab;
    }

    // Handle left pane tab parameter
    const leftTab = params.get('leftTab');
    if (leftTab && this.isValidLeftPaneTab(leftTab)) {
      this.leftPaneTab = leftTab as LeftPaneTab;
    }
  }

  /**
   * Get current navigation state as URL parameters
   * @returns URLSearchParams representing current state
   */
  getUrlParams(): URLSearchParams {
    const params = new URLSearchParams();

    // Add mode if in help mode
    if (this.agentMode === 'help') {
      params.set('mode', 'help');
    }

    // Add view if in import view
    if (this.mainView === 'import') {
      params.set('view', 'import');
    }

    // Add detail tab if not default
    if (this.detailTab !== 'itinerary' && this.mainView === 'itinerary-detail') {
      params.set('tab', this.detailTab);
    }

    // Add left pane tab if not default
    if (this.leftPaneTab !== 'chat') {
      params.set('leftTab', this.leftPaneTab);
    }

    return params;
  }

  /**
   * Update browser URL to match current navigation state
   */
  updateUrl(): void {
    if (!isBrowser) {
      return;
    }

    const params = this.getUrlParams();
    const currentUrl = new URL(window.location.href);

    // Preserve existing params (like id)
    const id = currentUrl.searchParams.get('id');
    if (id) {
      params.set('id', id);
    }

    // Update URL without reload
    const newUrl = `${currentUrl.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }

  /**
   * Type guard for DetailTab
   */
  private isValidDetailTab(tab: string): tab is DetailTab {
    return ['itinerary', 'calendar', 'map', 'travelers', 'docs', 'faq'].includes(tab);
  }

  /**
   * Type guard for LeftPaneTab
   */
  private isValidLeftPaneTab(tab: string): tab is LeftPaneTab {
    return ['chat', 'itineraries'].includes(tab);
  }
}

// Export singleton instance
export const navigationStore = new NavigationStore();
