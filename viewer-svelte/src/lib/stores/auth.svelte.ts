/**
 * Authentication Store - Svelte 5 Runes
 *
 * Provides authentication state management with password hashing,
 * localStorage persistence, and SSR-safe operations.
 */

// SSR-safe localStorage access
const isBrowser = typeof window !== 'undefined';
const STORAGE_KEY = 'itinerizer_auth';

// Static hash for demo password "travel2025"
const VALID_PASSWORD_HASH = '03f8b6334b99364cf4bad126e751ece55b8f34afd1ffbf8bd46f961afd9d5b54';

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

  constructor() {
    // Initialize from localStorage on client
    if (isBrowser) {
      this.checkAuth();
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
    if (isBrowser) {
      localStorage.removeItem(STORAGE_KEY);
    }
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
  }
}

// Export singleton instance
export const authStore = new AuthStore();
