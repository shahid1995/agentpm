interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

interface RequestEntry {
  timestamps: number[];
}

export class InMemoryRateLimiter {
  private requests = new Map<string, RequestEntry>();
  private windowMs: number;
  private maxRequests: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(config: RateLimitConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;

    // Periodically clean up expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
  }

  /**
   * Check if a request is allowed for the given key.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const entry = this.requests.get(key) || { timestamps: [] };

    // Remove expired timestamps
    entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);

    // Check if under limit
    if (entry.timestamps.length < this.maxRequests) {
      entry.timestamps.push(now);
      this.requests.set(key, entry);
      return {
        allowed: true,
        remaining: this.maxRequests - entry.timestamps.length,
      };
    }

    this.requests.set(key, entry);
    return {
      allowed: false,
      remaining: 0,
    };
  }

  /**
   * Reset all requests for a key.
   */
  reset(key: string): void {
    this.requests.delete(key);
  }

  /**
   * Clean up expired entries.
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.requests) {
      entry.timestamps = entry.timestamps.filter((t) => now - t < this.windowMs);
      if (entry.timestamps.length === 0) {
        this.requests.delete(key);
      }
    }
  }

  /**
   * Destroy the rate limiter.
   */
  destroy(): void {
    clearInterval(this.cleanupInterval);
    this.requests.clear();
  }
}
