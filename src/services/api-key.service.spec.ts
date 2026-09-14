import { ApiKeyService } from './api-key.service.js';

const svc = new ApiKeyService();

describe('ApiKeyService', () => {
  it('generates prefixed high-entropy keys and a sha256 hash', () => {
    const { apiKey, keyHash, keyPrefix } = svc.generate();
    expect(apiKey.startsWith('afk_')).toBe(true);
    expect(apiKey.length).toBeGreaterThanOrEqual(47);
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
    expect(svc.hash(apiKey)).toBe(keyHash);
    expect(keyPrefix).toBe(apiKey.slice(0, 11));
    expect(keyHash).not.toContain(apiKey);
  });

  it('never repeats', () => {
    expect(svc.generate().apiKey).not.toBe(svc.generate().apiKey);
  });
});
