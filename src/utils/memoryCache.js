/**
 * Zero-Cost In-Memory Cache with TTL support using native Node.js Map.
 * Eliminates rate limits of external APIs and saves database calculation time.
 */
export class MemoryCache {
  constructor() {
    this.cache = new Map();
    
    // Set a periodic maintenance timer to prune expired entries (every 10 minutes)
    this.pruneInterval = setInterval(() => {
      this.prune();
    }, 10 * 60 * 1000).unref(); // .unref() lets Node.js exit if this is the only active timer
  }

  /**
   * Set a key-value pair in the cache with a specified TTL.
   * 
   * @param {string} key Cache key
   * @param {any} value Value to store (will be deep-copied)
   * @param {number} ttlMs Time-to-live in milliseconds (default: 5 minutes)
   */
  set(key, value, ttlMs = 5 * 60 * 1000) {
    if (!key) return;

    try {
      const expiresAt = Date.now() + ttlMs;
      
      // Perform a deep copy using JSON parsing to isolate memory references
      const deepCopy = JSON.parse(JSON.stringify(value));
      
      this.cache.set(key, {
        value: deepCopy,
        expiresAt
      });
    } catch (error) {
      console.error(`[MemoryCache] Failed to deep copy key "${key}":`, error.message);
    }
  }

  /**
   * Retrieves a cached value. Returns null if expired or not found.
   * 
   * @param {string} key Cache key
   * @returns {any|null} The cached value (deep-copied) or null
   */
  get(key) {
    if (!key) return null;

    const item = this.cache.get(key);
    if (!item) return null;

    // Check if the cache entry has expired
    if (Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    try {
      // Return a deep copy to ensure subsequent calculations do not mutate stored values
      return JSON.parse(JSON.stringify(item.value));
    } catch (error) {
      console.error(`[MemoryCache] Failed to deep copy cached item for key "${key}":`, error.message);
      return null;
    }
  }

  /**
   * Evicts an entry from the cache immediately.
   * 
   * @param {string} key Cache key
   */
  delete(key) {
    this.cache.delete(key);
  }

  /**
   * Resets the cache entirely.
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Runs house-keeping to remove all expired items from memory.
   */
  prune() {
    const now = Date.now();
    let prunedCount = 0;
    
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.cache.delete(key);
        prunedCount++;
      }
    }
    
    if (prunedCount > 0) {
      console.log(`[MemoryCache] Pruning complete. Reclaimed ${prunedCount} expired entries from cache.`);
    }
  }
}

// Export a singleton instance by default
export default new MemoryCache();
