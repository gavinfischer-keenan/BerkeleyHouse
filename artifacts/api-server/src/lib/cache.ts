/**
 * cache.ts — Typed in-memory cache factory for route handlers.
 *
 * Eliminates the boilerplate `let cache: { data, expiresAt } | null = null`
 * pattern that every route file was duplicating.
 *
 * Usage:
 *   const cache = makeCache<MyType>(10 * 60 * 1000); // 10 min TTL
 *   const hit = cache.get();
 *   if (hit) return res.json(hit);
 *   const data = await fetchSomething();
 *   cache.set(data);
 *   res.json(data);
 */

export interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

export interface Cache<T> {
  /** Returns cached data if still fresh, otherwise null. */
  get(): T | null;
  /** Stores data with the configured TTL. */
  set(data: T): void;
  /** Clears the cache immediately. */
  invalidate(): void;
  /** True if a non-expired entry exists. */
  isValid(): boolean;
}

export function makeCache<T>(ttlMs: number): Cache<T> {
  let entry: CacheEntry<T> | null = null;

  return {
    get(): T | null {
      if (entry && Date.now() < entry.expiresAt) return entry.data;
      return null;
    },
    set(data: T): void {
      entry = { data, expiresAt: Date.now() + ttlMs };
    },
    invalidate(): void {
      entry = null;
    },
    isValid(): boolean {
      return entry !== null && Date.now() < entry.expiresAt;
    },
  };
}
