/**
 * Backend Health Monitoring Store
 *
 * Polls the backend health endpoint to detect when the server is down.
 * Provides reactive state for backend status and connection health.
 *
 * Usage:
 * ```ts
 * import { healthStore } from '$lib/stores/health.svelte';
 *
 * // In component:
 * const { status, lastCheck, isOnline } = healthStore;
 * ```
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || '';
const HEALTH_ENDPOINT = `${API_BASE_URL}/api/v1/health`;
const CHECK_INTERVAL_MS = 30000; // 30 seconds
const INITIAL_RETRY_DELAY_MS = 5000; // 5 seconds for first retry
const MAX_RETRY_DELAY_MS = 60000; // Max 60 seconds between retries

type HealthStatus = 'online' | 'offline' | 'checking';

interface HealthState {
  status: HealthStatus;
  lastCheck: Date | null;
  consecutiveFailures: number;
  wasOffline: boolean; // Track if we were offline (for reconnected message)
}

class HealthStore {
  private state = $state<HealthState>({
    status: 'checking',
    lastCheck: null,
    consecutiveFailures: 0,
    wasOffline: false,
  });

  private intervalId: number | null = null;
  private timeoutId: number | null = null;

  get status(): HealthStatus {
    return this.state.status;
  }

  get lastCheck(): Date | null {
    return this.state.lastCheck;
  }

  get isOnline(): boolean {
    return this.state.status === 'online';
  }

  get isOffline(): boolean {
    return this.state.status === 'offline';
  }

  get wasOffline(): boolean {
    return this.state.wasOffline;
  }

  /**
   * Check backend health
   * Returns true if healthy, false otherwise
   */
  private async checkHealth(): Promise<boolean> {
    try {
      // Use a short timeout for health checks to fail fast
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(HEALTH_ENDPOINT, {
        signal: controller.signal,
        // Don't cache health checks
        cache: 'no-store',
      });

      clearTimeout(timeoutId);

      return response.ok;
    } catch (error) {
      // Network error, timeout, or other fetch failure
      // Don't spam console during health checks
      if (this.state.status !== 'offline') {
        console.warn('[Health] Backend health check failed:', error);
      }
      return false;
    }
  }

  /**
   * Perform a health check and update state
   */
  private async performCheck(): Promise<void> {
    const isHealthy = await this.checkHealth();
    const now = new Date();

    if (isHealthy) {
      const wasOffline = this.state.status === 'offline';
      this.state = {
        status: 'online',
        lastCheck: now,
        consecutiveFailures: 0,
        wasOffline,
      };

      // Clear the "was offline" flag after a short delay
      if (wasOffline) {
        setTimeout(() => {
          this.state.wasOffline = false;
        }, 3000);
      }
    } else {
      this.state = {
        status: 'offline',
        lastCheck: now,
        consecutiveFailures: this.state.consecutiveFailures + 1,
        wasOffline: false,
      };
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private getRetryDelay(): number {
    if (this.state.status === 'online') {
      return CHECK_INTERVAL_MS;
    }

    // Exponential backoff: 5s, 10s, 20s, 40s, 60s (max)
    const baseDelay = INITIAL_RETRY_DELAY_MS;
    const exponentialDelay = baseDelay * Math.pow(2, Math.min(this.state.consecutiveFailures - 1, 4));
    return Math.min(exponentialDelay, MAX_RETRY_DELAY_MS);
  }

  /**
   * Schedule next health check with appropriate delay
   */
  private scheduleNextCheck(): void {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
    }

    const delay = this.getRetryDelay();
    this.timeoutId = setTimeout(() => {
      this.performCheck().then(() => this.scheduleNextCheck());
    }, delay) as unknown as number;
  }

  /**
   * Start health monitoring
   * Call this when the app mounts
   */
  start(): void {
    if (typeof window === 'undefined') return;

    // Perform initial check immediately
    this.performCheck().then(() => {
      // Schedule subsequent checks
      this.scheduleNextCheck();
    });
  }

  /**
   * Stop health monitoring
   * Call this when the app unmounts (cleanup)
   */
  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Manually trigger a health check
   * Useful for user-triggered refresh
   */
  async refresh(): Promise<void> {
    await this.performCheck();
  }
}

// Export singleton instance
export const healthStore = new HealthStore();
