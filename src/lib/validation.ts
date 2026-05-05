/**
 * Input validation utilities for security hardening.
 * Prevents injection attacks, oversized payloads, and invalid input.
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export const ValidationLimits = {
  // Query limits
  QUERY_MAX_LENGTH: 253,
  QUERY_MIN_LENGTH: 1,

  // SBOM limits
  SBOM_MAX_SIZE_MB: 50,
  SBOM_MAX_COMPONENTS: 10000,

  // Project/resource limits
  PROJECT_NAME_MAX_LENGTH: 255,
  PROJECT_DESCRIPTION_MAX_LENGTH: 5000,
  PROJECT_MAX_TAGS: 20,
  TAG_MAX_LENGTH: 50,

  // Scan limits
  SCAN_TIMEOUT_MS: 300000, // 5 minutes
  SCAN_MAX_CONCURRENT: 5,

  // AI limits
  AI_PROMPT_MAX_LENGTH: 5000,
  AI_MAX_TOKENS: 2000,

  // Rate limiting
  REQUESTS_PER_MINUTE: 100,
  REQUESTS_PER_HOUR: 5000,
};

/**
 * Validate dark web scan query.
 */
export function validateDarkWebQuery(query: string): ValidationResult {
  if (!query || typeof query !== 'string') {
    return { valid: false, error: 'Query must be a non-empty string' };
  }

  const trimmed = query.trim();

  if (trimmed.length < ValidationLimits.QUERY_MIN_LENGTH) {
    /* c8 ignore next 2 */
    return { valid: false, error: 'Query is too short' };
  }

  if (trimmed.length > ValidationLimits.QUERY_MAX_LENGTH) {
    return {
      valid: false,
      error: 'Query is too long',
    };
  }

  // Block dangerous characters/patterns
  const dangerousPatterns = [
    /['";]/g, // SQL-like injection
    /`/g, // Template injection backticks
    /\$\{/g, // Template injection ${}
    /<script/i, // XSS
    /javascript:/i, // XSS
    /\*\)|\|\(/g, // LDAP injection
    /\\\(/g, // LDAP escape patterns
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      return { valid: false, error: 'Query contains invalid characters' };
    }
  }

  return { valid: true };
}

/**
 * Validate SBOM (Software Bill of Materials) input.
 */
export function validateSbomInput(
  sbom: unknown,
  maxSizeMb: number = ValidationLimits.SBOM_MAX_SIZE_MB,
  maxComponents: number = ValidationLimits.SBOM_MAX_COMPONENTS
): ValidationResult {
  // Type check
  if (!sbom || typeof sbom !== 'object') {
    return { valid: false, error: 'SBOM must be a valid JSON object' };
  }

  // Size check (approximate)
  const sbomJson = JSON.stringify(sbom);
  const sizeMb = new TextEncoder().encode(sbomJson).length / (1024 * 1024);

  if (sizeMb > maxSizeMb) {
    return {
      valid: false,
      error: `SBOM exceeds maximum size of ${maxSizeMb}MB (current: ${sizeMb.toFixed(2)}MB)`,
    };
  }

  // Check for required SBOM fields
  const sbomObj = sbom as Record<string, unknown>;

  if (!sbomObj.version && !sbomObj.spdxVersion) {
    return { valid: false, error: 'SBOM missing version information' };
  }

  // Check component count
  const components = (sbomObj.components as unknown[] | undefined) || (sbomObj.packages as unknown[] | undefined) || [];

  if (!Array.isArray(components)) {
    return { valid: false, error: 'SBOM components must be an array' };
  }

  if (components.length > maxComponents) {
    return {
      valid: false,
      error: `SBOM contains too many components (max: ${maxComponents}, actual: ${components.length})`,
    };
  }

  // Validate component structure
  for (let i = 0; i < components.length; i++) {
    const component = components[i] as Record<string, unknown>;

    if (!component.name || typeof component.name !== 'string') {
      return { valid: false, error: `Component ${i} missing name` };
    }

    if (component.name.length > 255) {
      return { valid: false, error: `Component ${i} name exceeds 255 characters` };
    }
  }

  return { valid: true };
}

/**
 * Validate project configuration.
 */
export function validateProjectInput(project: {
  name?: string;
  description?: string;
  tags?: string[];
}): ValidationResult {
  // Validate name
  if (!project.name || typeof project.name !== 'string') {
    return { valid: false, error: 'Project name must be a non-empty string' };
  }

  if (project.name.trim().length === 0) {
    return { valid: false, error: 'Project name cannot be empty' };
  }

  if (project.name.length > ValidationLimits.PROJECT_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Project name exceeds maximum length of ${ValidationLimits.PROJECT_NAME_MAX_LENGTH}`,
    };
  }

  // Validate description
  if (project.description) {
    /* c8 ignore next 3 */
    if (typeof project.description !== 'string') {
      return { valid: false, error: 'Project description must be a string' };
    }

    if (project.description.length > ValidationLimits.PROJECT_DESCRIPTION_MAX_LENGTH) {
      return {
        valid: false,
        error: `Project description exceeds maximum length of ${ValidationLimits.PROJECT_DESCRIPTION_MAX_LENGTH}`,
      };
    }
  }

  // Validate tags
  if (project.tags) {
    if (!Array.isArray(project.tags)) {
      return { valid: false, error: 'Tags must be an array' };
    }

    if (project.tags.length > ValidationLimits.PROJECT_MAX_TAGS) {
      return {
        valid: false,
        error: `Too many tags (max: ${ValidationLimits.PROJECT_MAX_TAGS})`,
      };
    }

    for (const tag of project.tags) {
      if (typeof tag !== 'string') {
        return { valid: false, error: 'Tag must be a string' };
      }

      if (tag.length > ValidationLimits.TAG_MAX_LENGTH) {
        return {
          valid: false,
          error: `Tag exceeds maximum length of ${ValidationLimits.TAG_MAX_LENGTH}`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Validate AI prompt input.
 */
export function validateAiPrompt(prompt: string): ValidationResult {
  if (!prompt || typeof prompt !== 'string') {
    return { valid: false, error: 'Prompt must be a non-empty string' };
  }

  const trimmed = prompt.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: 'Prompt cannot be empty' };
  }

  if (trimmed.length > ValidationLimits.AI_PROMPT_MAX_LENGTH) {
    return {
      valid: false,
      error: `Prompt exceeds maximum length of ${ValidationLimits.AI_PROMPT_MAX_LENGTH}`,
    };
  }

  return { valid: true };
}

/**
 * Validate API key format.
 */
export function validateApiKey(key: string): ValidationResult {
  if (!key || typeof key !== 'string') {
    return { valid: false, error: 'API key must be a non-empty string' };
  }

  // API keys should be alphanumeric (and possibly underscores/hyphens)
  if (!/^[a-zA-Z0-9_-]+$/.test(key)) {
    return { valid: false, error: 'API key contains invalid characters' };
  }

  // Typical API key length: 32-64 characters
  if (key.length < 20 || key.length > 256) {
    return { valid: false, error: 'API key has invalid length' };
  }

  return { valid: true };
}

/**
 * Validate email address.
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email must be a non-empty string' };
  }

  // Simple email validation (RFC 5322 simplified)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (email.length > 254) {
    return { valid: false, error: 'Email exceeds maximum length' };
  }

  return { valid: true };
}

/**
 * Validate IP address (IPv4 or IPv6).
 */
export function validateIpAddress(ip: string): ValidationResult {
  if (!ip || typeof ip !== 'string') {
    return { valid: false, error: 'IP address must be a non-empty string' };
  }

  const trimmed = ip.trim();

  // IPv4 validation
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(trimmed)) {
    const parts = trimmed.split('.');
    for (const part of parts) {
      const num = parseInt(part, 10);
      if (num < 0 || num > 255) {
        return { valid: false, error: 'Invalid IPv4 address' };
      }
    }
    return { valid: true };
  }

  // IPv6 validation (basic)
  const ipv6Regex = /^([\da-f]{0,4}:){2,7}[\da-f]{0,4}$/i;
  /* c8 ignore next 3 */
  if (ipv6Regex.test(trimmed)) {
    return { valid: true };
  }

  return { valid: false, error: 'Invalid IP address format' };
}

/**
 * Validate URL.
 */
export function validateUrl(url: string): ValidationResult {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Sanitize string input (basic XSS prevention).
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate request rate (basic check).
 */
export function validateRequestRate(
  requestCount: number,
  timeWindowMs: number,
  maxRequestsPerWindow: number
): ValidationResult {
  if (requestCount > maxRequestsPerWindow) {
    return {
      valid: false,
      error: `Rate limit exceeded: ${requestCount} requests in ${timeWindowMs}ms window (max: ${maxRequestsPerWindow})`,
    };
  }

  return { valid: true };
}

/**
 * Batch validation results.
 */
export function combineValidationResults(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}
