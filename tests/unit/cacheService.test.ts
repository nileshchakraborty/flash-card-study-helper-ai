import { CacheService } from '../../src/core/services/CacheService.js';

describe('CacheService', () => {
  const cache = new CacheService<{ value: number }>({ ttlSeconds: 60, maxEntries: 50 });

  beforeEach(async () => await cache.clear());

  it('stores and retrieves values', async () => {
    await cache.set('a', { value: 1 });
    expect(await cache.get('a')).toEqual({ value: 1 });
  });

  it('returns undefined for misses', async () => {
    expect(await cache.get('missing')).toBeUndefined();
  });

  it('reports existence with has()', async () => {
    await cache.set('k', { value: 2 });
    expect(await cache.has('k')).toBe(true);
    await cache.delete('k');
    expect(await cache.has('k')).toBe(false);
  });

  it('hashKey produces stable short hashes', () => {
    const h1 = CacheService.hashKey({ a: 1 }, 'x');
    const h2 = CacheService.hashKey({ a: 1 }, 'x');
    expect(h1).toHaveLength(16);
    expect(h1).toBe(h2);
  });
});

