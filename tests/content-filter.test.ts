import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ContentFilter } from '../src/validation/content-filter';

// Setup fake timers if needed for content filter tests
beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('ContentFilter', () => {
  describe('Secret Detection', () => {
    it('should_redactOpenAIKey_when_skPatternDetected', () => {
      // RED: This test will fail until ContentFilter is implemented
      const filter = new ContentFilter();
      const input = 'My OpenAI key is sk-abc123def456ghi789jkl012';
      const result = filter.scan(input);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('secret');
      expect(result.violations[0].pattern).toBe('openai_key');
      expect(result.violations[0].count).toBe(1);
      expect(result.filtered).toContain('[REDACTED_SECRET]');
      expect(result.filtered).not.toContain('sk-abc123def456ghi789jkl012');
    });

    it('should_redactGitHubToken_when_ghpPatternDetected', () => {
      // RED: This test will fail until implementation
      const filter = new ContentFilter();
      const input = 'GitHub token: ghp_xyz789abc123def456ghi';
      const result = filter.scan(input);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('secret');
      expect(result.violations[0].pattern).toBe('github_token');
      expect(result.filtered).toContain('[REDACTED_SECRET]');
      expect(result.filtered).not.toContain('ghp_xyz789abc123def456ghi');
    });

    it('should_redactAWSKey_when_AKIAPatternDetected', () => {
      // RED: This test will fail until implementation
      const filter = new ContentFilter();
      const input = 'AWS key: AKIAIOSFODNN7EXAMPLE';
      const result = filter.scan(input);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('secret');
      expect(result.violations[0].pattern).toBe('aws_key');
      expect(result.filtered).toContain('[REDACTED_SECRET]');
    });

    it('should_redactJWT_when_eyJPatternDetected', () => {
      // RED: This test will fail until implementation
      const filter = new ContentFilter();
      const input = 'JWT token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const result = filter.scan(input);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('secret');
      expect(result.violations[0].pattern).toBe('jwt_token');
      expect(result.filtered).toContain('[REDACTED_SECRET]');
    });
  });

  describe('PII Detection', () => {
    it('should_redactEmail_when_emailPatternDetected', () => {
      // RED: This test will fail until implementation
      const filter = new ContentFilter();
      const input = 'Contact me at user@example.com for details';
      const result = filter.scan(input);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('pii');
      expect(result.violations[0].pattern).toBe('email');
      expect(result.filtered).toContain('[REDACTED_PII]');
      expect(result.filtered).not.toContain('user@example.com');
    });

    it('should_redactSSN_when_ssnPatternDetected', () => {
      // RED: This test will fail until implementation
      const filter = new ContentFilter();
      const input = 'SSN: 123-45-6789';
      const result = filter.scan(input);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('pii');
      expect(result.violations[0].pattern).toBe('ssn');
      expect(result.filtered).toContain('[REDACTED_PII]');
      expect(result.filtered).not.toContain('123-45-6789');
    });

    it('should_redactCreditCard_when_creditCardPatternDetected', () => {
      // RED: This test will fail until implementation
      const filter = new ContentFilter();
      const input = 'Card number: 4111-1111-1111-1111';
      const result = filter.scan(input);

      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].type).toBe('pii');
      expect(result.violations[0].pattern).toBe('credit_card');
      expect(result.filtered).toContain('[REDACTED_PII]');
    });
  });

  describe('Filter Modes', () => {
    it('should_throwError_when_rejectOnViolationTrueAndViolationsFound', () => {
      // RED: This test will fail until implementation
      const filter = new ContentFilter();
      const input = 'Secret key: sk-abc123def456ghi789jkl012';

      expect(() => {
        filter.filter(input); // rejectOnViolation defaults to true
      }).toThrow('Content filter violation: 1 secrets detected');
    });

    it('should_handleMultipleViolations_when_multipleSecretsInResponse', () => {
      // RED: This test will fail until implementation
      const filter = new ContentFilter();
      const input = 'OpenAI: sk-abc123 Email: user@example.com AWS: AKIAIOSFODNN7EXAMPLE';
      const result = filter.scan(input);

      expect(result.violations).toHaveLength(3);
      // Violations are processed in order: secrets first, then PII
      expect(result.violations[0].type).toBe('secret'); // OpenAI key
      expect(result.violations[1].type).toBe('secret'); // AWS key
      expect(result.violations[2].type).toBe('pii');    // Email
    });
  });

  describe('Utility Methods', () => {
    it('should_returnTrue_when_hasViolationsCalledWithSecrets', () => {
      const filter = new ContentFilter();
      const input = 'Secret: sk-abc123def456';

      expect(filter.hasViolations(input)).toBe(true);
    });

    it('should_returnFalse_when_hasViolationsCalledWithCleanContent', () => {
      const filter = new ContentFilter();
      const input = 'This is clean content with no secrets or PII';

      expect(filter.hasViolations(input)).toBe(false);
    });

    it('should_returnAllPatternNames_when_getSupportedPatternsCalled', () => {
      const filter = new ContentFilter();
      const patterns = filter.getSupportedPatterns();

      // Should include all secret patterns
      expect(patterns).toContain('openai_key');
      expect(patterns).toContain('github_token');
      expect(patterns).toContain('aws_key');
      expect(patterns).toContain('jwt_token');

      // Should include all PII patterns
      expect(patterns).toContain('email');
      expect(patterns).toContain('ssn');
      expect(patterns).toContain('credit_card');

      // Should have exactly 7 patterns (4 secrets + 3 PII)
      expect(patterns).toHaveLength(7);
    });

    it('should_returnFilteredContent_when_rejectOnViolationFalse', () => {
      const filter = new ContentFilter();
      const input = 'Secret: sk-abc123def456 Email: user@example.com';

      // Should not throw, but return redacted content
      const result = filter.filter(input, false);

      expect(result).toContain('[REDACTED_SECRET]');
      expect(result).toContain('[REDACTED_PII]');
      expect(result).not.toContain('sk-abc123def456');
      expect(result).not.toContain('user@example.com');
    });
  });

  // Additional test stubs will be added as implementation progresses
});
