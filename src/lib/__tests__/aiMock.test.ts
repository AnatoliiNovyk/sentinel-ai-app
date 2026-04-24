import { describe, expect, it } from 'vitest';
import { generateAIResponse } from '../aiMock';

describe('generateAIResponse', () => {
  describe('cloud / AWS branch', () => {
    it('returns cloud assessment response for "aws" keyword', () => {
      const res = generateAIResponse('check my aws account');
      expect(res).toContain('cloud security assessment');
      expect(res).toContain('Prowler');
    });

    it('returns cloud assessment response for "cloud" keyword', () => {
      const res = generateAIResponse('scan my cloud infrastructure');
      expect(res).toContain('cloud security assessment');
      expect(res).toContain('CIS AWS');
    });

    it('is case-insensitive for aws keyword', () => {
      const res = generateAIResponse('AWS environment audit');
      expect(res).toContain('cloud security assessment');
    });
  });

  describe('scan / pentest / audit branch', () => {
    it('returns multi-stage audit response for "scan" keyword', () => {
      const res = generateAIResponse('run a scan on my server');
      expect(res).toContain('Amass');
      expect(res).toContain('Nmap');
    });

    it('returns multi-stage audit response for "pentest" keyword', () => {
      const res = generateAIResponse('run a pentest now');
      expect(res).toContain('MITRE ATT&CK');
    });

    it('returns multi-stage audit response for "audit" keyword', () => {
      const res = generateAIResponse('perform an audit');
      expect(res).toContain('Masscan');
    });
  });

  describe('report branch', () => {
    it('returns report tiers response for "report" keyword', () => {
      const res = generateAIResponse('generate a report');
      expect(res).toContain('Executive Summary');
      expect(res).toContain('Technical Deep Dive');
    });

    it('mentions both report tiers', () => {
      const res = generateAIResponse('I need a report');
      expect(res).toContain('1-2 pages');
    });
  });

  describe('default fallback', () => {
    it('returns Sentinel intro for unmatched prompt', () => {
      const res = generateAIResponse('hello there');
      expect(res).toContain('Sentinel');
    });

    it('suggests usage examples in default response', () => {
      const res = generateAIResponse('what can you do');
      expect(res).toContain('MITRE ATT');
    });
  });
});
