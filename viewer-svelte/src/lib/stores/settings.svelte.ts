/**
 * Settings Store - Svelte 5 Runes
 *
 * Manages user settings with localStorage persistence
 * and SSR-safe operations.
 */

// SSR-safe localStorage access
const isBrowser = typeof window !== 'undefined';
const SETTINGS_STORAGE_KEY = 'itinerator_settings';
const LEGACY_API_KEY_STORAGE_KEY = 'itinerator_api_key';

/**
 * Settings data structure
 */
interface SettingsData {
  firstName: string;
  lastName: string;
  nickname: string;
  openRouterKey: string;
  homeAirport: string;
}

/**
 * Settings state using Svelte 5 $state rune
 */
class SettingsStore {
  firstName = $state('');
  lastName = $state('');
  nickname = $state('');
  openRouterKey = $state('');
  homeAirport = $state('');

  constructor() {
    // Initialize from localStorage on client
    if (isBrowser) {
      this.loadSettings();
    }
  }

  /**
   * Getter for API key (for backward compatibility)
   */
  get apiKey(): string {
    return this.openRouterKey;
  }

  /**
   * Update OpenRouter API key and persist to localStorage
   * @param key - New API key
   */
  updateApiKey(key: string): void {
    this.openRouterKey = key;
    this.saveSettings();
  }

  /**
   * Get current API key (for backward compatibility)
   * @returns Current API key value
   */
  getApiKey(): string {
    return this.openRouterKey;
  }

  /**
   * Update first name
   * @param name - First name
   */
  updateFirstName(name: string): void {
    this.firstName = name;
    this.saveSettings();
  }

  /**
   * Update last name
   * @param name - Last name
   */
  updateLastName(name: string): void {
    this.lastName = name;
    this.saveSettings();
  }

  /**
   * Update nickname
   * @param name - Nickname
   */
  updateNickname(name: string): void {
    this.nickname = name;
    this.saveSettings();
  }

  /**
   * Update home airport
   * @param airport - 3-letter IATA code
   */
  updateHomeAirport(airport: string): void {
    this.homeAirport = airport.toUpperCase();
    this.saveSettings();
  }

  /**
   * Bulk update all settings at once
   * @param settings - Partial settings object
   */
  updateSettings(settings: Partial<SettingsData>): void {
    if (settings.firstName !== undefined) this.firstName = settings.firstName;
    if (settings.lastName !== undefined) this.lastName = settings.lastName;
    if (settings.nickname !== undefined) this.nickname = settings.nickname;
    if (settings.openRouterKey !== undefined) this.openRouterKey = settings.openRouterKey;
    if (settings.homeAirport !== undefined) this.homeAirport = settings.homeAirport.toUpperCase();
    this.saveSettings();
  }

  /**
   * Save all settings to localStorage
   */
  private saveSettings(): void {
    if (!isBrowser) {
      return;
    }

    const data: SettingsData = {
      firstName: this.firstName,
      lastName: this.lastName,
      nickname: this.nickname,
      openRouterKey: this.openRouterKey,
      homeAirport: this.homeAirport
    };

    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
  }

  /**
   * Load settings from localStorage
   */
  loadSettings(): void {
    if (!isBrowser) {
      return;
    }

    // Try loading from new unified storage
    const storedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (storedSettings) {
      try {
        const data: SettingsData = JSON.parse(storedSettings);
        this.firstName = data.firstName || '';
        this.lastName = data.lastName || '';
        this.nickname = data.nickname || '';
        this.openRouterKey = data.openRouterKey || '';
        this.homeAirport = data.homeAirport || '';
        return;
      } catch (error) {
        console.error('Failed to parse settings:', error);
      }
    }

    // Migrate from legacy storage if available
    const legacyKey = localStorage.getItem(LEGACY_API_KEY_STORAGE_KEY);
    if (legacyKey) {
      this.openRouterKey = legacyKey;
      this.saveSettings();
      // Clean up legacy storage
      localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
    }
  }

  /**
   * Clear all settings
   */
  clearSettings(): void {
    this.firstName = '';
    this.lastName = '';
    this.nickname = '';
    this.openRouterKey = '';
    this.homeAirport = '';
    if (isBrowser) {
      localStorage.removeItem(SETTINGS_STORAGE_KEY);
      localStorage.removeItem(LEGACY_API_KEY_STORAGE_KEY);
    }
  }
}

// Export singleton instance
export const settingsStore = new SettingsStore();

/**
 * Derived value for whether AI features are available
 * AI features require a valid OpenRouter API key
 */
export function hasAIAccess(): boolean {
  return !!settingsStore.openRouterKey?.trim();
}
