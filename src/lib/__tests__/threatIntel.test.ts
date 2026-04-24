import { describe, expect, it } from 'vitest';
import { fetchThreatIntel } from '../threatIntel';

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

  describe('returns null for public targets (placeholder implementation)', () => {
    it('returns null for a public IP address', async () => {
      const result = await fetchThreatIntel('8.8.8.8');
      expect(result).toBeNull();
    });

    it('returns null for a public domain', async () => {
      const result = await fetchThreatIntel('example.com');
      expect(result).toBeNull();
    });
  });
});
