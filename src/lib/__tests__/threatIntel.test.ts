import { describe, expect, it, beforeEach } from 'vitest';
import { fetchThreatIntel, clearThreatIntelCache } from '../threatIntel';

beforeEach(() => {
  clearThreatIntelCache();
});

describe('fetchThreatIntel', () => {
  describe('returns null for RFC-1918 / loopback addresses', () => {
    it('returns null for 10.x.x.x private address', async () => {
      const result = await fetchThreatIntel('10.0.0.1');
      expect(result).toBeNull();
    });

    it('returns null for 192.168.x.x private address', async () => {
      const result = await fetchThreatIntel('192.168.1.100');
      expect(result).toBeNull();
    });

    it('returns null for 127.0.0.1 loopback', async () => {
      const result = await fetchThreatIntel('127.0.0.1');
      expect(result).toBeNull();
    });

    it('strips port before checking — 10.0.0.1:22 is still private', async () => {
      const result = await fetchThreatIntel('10.0.0.1:22');
      expect(result).toBeNull();
    });

    it('strips port before checking — 192.168.0.5:80 is still private', async () => {
      const result = await fetchThreatIntel('192.168.0.5:80');
      expect(result).toBeNull();
    });
  });

  describe('returns null for empty or blank input', () => {
    it('returns null for empty string', async () => {
      const result = await fetchThreatIntel('');
      expect(result).toBeNull();
    });

    it('returns null for whitespace-only string', async () => {
      const result = await fetchThreatIntel('   ');
      expect(result).toBeNull();
    });
  });

  describe('returns enriched result for public targets', () => {
    it('returns a result object for a public IP address', async () => {
      const result = await fetchThreatIntel('8.8.8.8');
      expect(result).not.toBeNull();
      expect(result!.source).toBe('open-source');
    });

    it('result has all required fields', async () => {
      const result = await fetchThreatIntel('1.1.1.1');
      expect(result).not.toBeNull();
      expect(typeof result!.positives).toBe('number');
      expect(typeof result!.total).toBe('number');
      expect(typeof result!.reputation).toBe('number');
      expect(typeof result!.owner).toBe('string');
      expect(typeof result!.country).toBe('string');
      expect(typeof result!.lastAnalysis).toBe('string');
      expect(Array.isArray(result!.tags)).toBe(true);
    });

    it('reputation is between 0 and 100', async () => {
      const result = await fetchThreatIntel('93.184.216.34');
      expect(result!.reputation).toBeGreaterThanOrEqual(0);
      expect(result!.reputation).toBeLessThanOrEqual(100);
    });

    it('returns result for a public domain', async () => {
      const result = await fetchThreatIntel('example.com');
      expect(result).not.toBeNull();
      expect(result!.source).toBe('open-source');
    });

    it('strips port — 8.8.8.8:443 equals 8.8.8.8', async () => {
      const resultWithPort = await fetchThreatIntel('8.8.8.8:443');
      clearThreatIntelCache();
      const resultPlain = await fetchThreatIntel('8.8.8.8');
      expect(resultWithPort).toEqual(resultPlain);
    });

    it('is deterministic — same asset produces same result across calls', async () => {
      const a = await fetchThreatIntel('203.0.113.5');
      clearThreatIntelCache();
      const b = await fetchThreatIntel('203.0.113.5');
      expect(a).toEqual(b);
    });

    it('different assets produce different results', async () => {
      const a = await fetchThreatIntel('8.8.8.8');
      const b = await fetchThreatIntel('1.1.1.1');
      expect(a!.reputation !== b!.reputation || a!.country !== b!.country).toBe(true);
    });
  });

  describe('caching', () => {
    it('returns same object reference on second call (cached)', async () => {
      const first  = await fetchThreatIntel('8.8.4.4');
      const second = await fetchThreatIntel('8.8.4.4');
      expect(first).toBe(second);
    });

    it('clearThreatIntelCache removes cached entries', async () => {
      const first = await fetchThreatIntel('9.9.9.9');
      clearThreatIntelCache();
      const second = await fetchThreatIntel('9.9.9.9');
      expect(first).toEqual(second);
      expect(first).not.toBe(second); // different reference after cache clear
    });
  });
});
