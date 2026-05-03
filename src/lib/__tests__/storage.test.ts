import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { loadVersioned, saveVersioned } from '../storage';

describe('storage — versioned helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });
  afterEach(() => {
    localStorage.clear();
  });

  describe('saveVersioned', () => {
    it('saves data with version envelope', () => {
      saveVersioned('test_key', 'v1', { name: 'test' });
      const raw = localStorage.getItem('test_key');
      expect(raw).toContain('"_v":"v1"');
      expect(raw).toContain('"name":"test"');
    });

    it('ignores quota errors silently', () => {
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
        throw new Error('QuotaExceededError');
      });
      // Should not throw
      expect(() => saveVersioned('key', 'v1', {})).not.toThrow();
      spy.mockRestore();
    });

    it('overwrites existing key', () => {
      saveVersioned('key', 'v1', { old: true });
      saveVersioned('key', 'v1', { new: true });
      const loaded = loadVersioned('key', 'v1', {});
      expect(loaded).toEqual({ new: true });
      expect(loaded).not.toHaveProperty('old');
    });
  });

  describe('loadVersioned', () => {
    it('reads valid versioned data', () => {
      localStorage.setItem('key', JSON.stringify({ _v: 'v1', data: { value: 42 } }));
      const result = loadVersioned('key', 'v1', {});
      expect(result).toEqual({ value: 42 });
    });

    it('returns fallback when key absent', () => {
      const fallback = { default: 'value' };
      const result = loadVersioned('missing_key', 'v1', fallback);
      expect(result).toBe(fallback);
    });

    it('returns fallback when version mismatch', () => {
      localStorage.setItem('key', JSON.stringify({ _v: 'v2', data: { value: 42 } }));
      const fallback = { default: 'value' };
      const result = loadVersioned('key', 'v1', fallback);
      expect(result).toBe(fallback);
      // Old data removed
      expect(localStorage.getItem('key')).toBeNull();
    });

    it('returns fallback on invalid JSON', () => {
      localStorage.setItem('key', 'not json');
      const fallback = { default: 'value' };
      const result = loadVersioned('key', 'v1', fallback);
      expect(result).toBe(fallback);
    });

    it('returns fallback when envelope data is null', () => {
      localStorage.setItem('key', JSON.stringify({ _v: 'v1', data: null }));
      const fallback = { default: 'value' };
      const result = loadVersioned('key', 'v1', fallback);
      // Null is valid data, so it returns null
      expect(result).toBeNull();
    });

    it('handles missing _v property gracefully', () => {
      localStorage.setItem('key', JSON.stringify({ data: { value: 42 } }));
      const fallback = { default: 'value' };
      const result = loadVersioned('key', 'v1', fallback);
      expect(result).toBe(fallback);
    });
  });
});
