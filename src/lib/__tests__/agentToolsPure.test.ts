import { describe, expect, it } from 'vitest';
import { extractQueryFromText } from '../agentTools';

describe('extractQueryFromText', () => {
  describe('email extraction (highest priority)', () => {
    it('extracts email address from text', () => {
      expect(extractQueryFromText('scan for admin@example.com please')).toBe('admin@example.com');
    });

    it('extracts email even when IP is also present', () => {
      // Email regex runs before IP, so email wins
      expect(extractQueryFromText('check admin@corp.io and 8.8.8.8')).toBe('admin@corp.io');
    });
  });

  describe('IP address extraction', () => {
    it('extracts IPv4 address', () => {
      expect(extractQueryFromText('check 192.168.1.50 for threats')).toBe('192.168.1.50');
    });

    it('extracts public IP', () => {
      expect(extractQueryFromText('scan 8.8.8.8')).toBe('8.8.8.8');
    });
  });

  describe('domain extraction', () => {
    it('extracts domain name', () => {
      expect(extractQueryFromText('scan github.com for breaches')).toBe('github.com');
    });

    it('extracts subdomain', () => {
      expect(extractQueryFromText('check staging.corp.io')).toBe('staging.corp.io');
    });
  });

  describe('keyword fallback extraction', () => {
    it('extracts word after "for" keyword', () => {
      // "for" keyword directly precedes the target
      expect(extractQueryFromText('for myusername')).toBe('myusername');
    });

    it('extracts word after "monitor" keyword', () => {
      expect(extractQueryFromText('monitor dark-target')).toBe('dark-target');
    });

    it('extracts word after "search" keyword', () => {
      expect(extractQueryFromText('search leaked_user')).toBe('leaked_user');
    });
  });

  describe('empty fallback', () => {
    it('returns empty string when nothing matches', () => {
      expect(extractQueryFromText('hello there random text')).toBe('');
    });

    it('returns empty string for empty input', () => {
      expect(extractQueryFromText('')).toBe('');
    });
  });
});
