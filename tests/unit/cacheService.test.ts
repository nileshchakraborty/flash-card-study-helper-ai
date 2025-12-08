import { CacheService } from '../../src/core/services/CacheService.js';

describe('CacheService', () => {
  const cache = new CacheService<{ value: number }>({ ttlSeconds: 60, maxEntries: 50 });

  beforeEach(() => cache.clear());

  it('stores and retrieves values', () => {
    cache.set('a', { value: 1 });
    expect(cache.get('a')).toEqual({ value: 1 });
  });

  it('returns undefined for misses', () => {
    expect(cache.get('missing')).toBeUndefined();
  });

  it('reports existence with has()', () => {
    cache.set('k', { value: 2 });
    expect(cache.has('k')).toBe(true);
    cache.delete('k');
    expect(cache.has('k')).toBe(false);
  });

  it('hashKey produces stable short hashes', () => {
    const h1 = CacheService.hashKey({ a: 1 }, 'x');
    const h2 = CacheService.hashKey({ a: 1 }, 'x');
    expect(h1).toHaveLength(16);
    expect(h1).toBe(h2);
  });
});

