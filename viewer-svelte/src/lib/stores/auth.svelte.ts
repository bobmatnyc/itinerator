/**
 * Authentication Store - Svelte 5 Runes
 *
 * Provides authentication state management with password hashing,
 * localStorage persistence, and SSR-safe operations.
 */

import { eventBus } from './events';

// SSR-safe localStorage access
const isBrowser = typeof window !== 'undefined';
const STORAGE_KEY = 'itinerator_auth';
const USER_EMAIL_KEY = 'itinerator_user_email';

// Static hash for app password
const VALID_PASSWORD_HASH = '1003766e45ffdcbacdbfdedaf03034eee6b6a9b7cb8f0e47c49ed92f952dbad5';

/**
 * Hash a password using SHA-256 (Web Crypto API)
 */
async function hashPassword(password: string): Promise<string> {
  if (!isBrowser) {
    return '';
  }

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Authentication state using Svelte 5 $state rune
 */
class AuthStore {
  isAuthenticated = $state(false);
  private _userEmail = $state<string | null>(null);

  constructor() {
    // Initialize from localStorage on client
    if (isBrowser) {
      this.checkAuth();
    }
  }

  /**
   * Get user email
   */
  get userEmail(): string | null {
    return this._userEmail;
  }

  /**
   * Set user email and persist to localStorage
   */
  set userEmail(email: string | null) {
    this._userEmail = email;
    if (isBrowser) {
      if (email) {
        localStorage.setItem(USER_EMAIL_KEY, email);
      } else {
        localStorage.removeItem(USER_EMAIL_KEY);
      }
    }
  }

  /**
   * Authenticate user with password
   * @param password - Password to verify
   * @returns true if authentication successful
   */
  async login(password: string): Promise<boolean> {
    if (!isBrowser) {
      return false;
    }

    try {
      const hash = await hashPassword(password);
      const isValid = hash === VALID_PASSWORD_HASH;

      if (isValid) {
        this.isAuthenticated = true;
        localStorage.setItem(STORAGE_KEY, 'true');
      }

      return isValid;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  }

  /**
   * Log out the user
   */
  logout(): void {
    this.isAuthenticated = false;
    this.userEmail = null;
    if (isBrowser) {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(USER_EMAIL_KEY);
    }
    // Emit logout event for other stores to react
    eventBus.emit({ type: 'auth:logout' });
  }

  /**
   * Restore authentication state from localStorage
   */
  checkAuth(): void {
    if (!isBrowser) {
      return;
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    this.isAuthenticated = stored === 'true';

    const storedEmail = localStorage.getItem(USER_EMAIL_KEY);
    this._userEmail = storedEmail;
  }
}

// Export singleton instance
export const authStore = new AuthStore();
