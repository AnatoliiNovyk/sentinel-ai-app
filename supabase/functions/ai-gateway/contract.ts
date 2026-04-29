export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
};

export type GatewayAction = 'chat' | 'generate_kill_chain' | 'agent_health_probe';

export type GatewayErrorCode =
  | 'METHOD_NOT_ALLOWED'
  | 'UNAUTHORIZED'
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'PAYLOAD_TOO_LARGE'
  | 'RATE_LIMITED'
  | 'AI_INVALID_JSON'
  | 'INTERNAL_ERROR';

export const MAX_REQUEST_BODY_BYTES = 100_000;

export type GatewayErrorBody = {
  error: {
    code: GatewayErrorCode;
    message: string;
  };
};

export type ParsedGatewayRequest =
  | {
      action: 'chat';
      messages: ChatMessage[];
    }
  | {
      action: 'generate_kill_chain';
      messages: ChatMessage[];
      project: string;
      vulnerabilities: unknown[];
    }
  | {
      action: 'agent_health_probe';
      url: string;
    };

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CONTENT_LENGTH = 8000;
const MAX_PROJECT_LENGTH = 200;
const MAX_VULNERABILITIES = 100;
const MAX_PROMPT_SOURCE_CHARS = 40_000;
const MAX_AGENT_HEALTH_URL_LENGTH = 2048;

const ALLOWED_ROLES = new Set<ChatMessageRole>(['user', 'assistant', 'system']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeAction(value: unknown): GatewayAction {
  if (value === 'agent_health_probe') return 'agent_health_probe';
  if (value === 'generate_kill_chain') return 'generate_kill_chain';
  return 'chat';
}

function validateAgentHealthUrl(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = sanitizeText(value);
  if (normalized.length === 0 || normalized.length > MAX_AGENT_HEALTH_URL_LENGTH) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }

    if (!parsed.hostname || parsed.username || parsed.password) {
      return null;
    }

    return parsed.toString();
  } catch {
    return null;
  }
}

function sanitizeText(value: string): string {
  let out = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    const isForbiddenControl =
      (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;

    if (!isForbiddenControl) {
      out += value[i];
    }
  }
  return out.trim();
}

function sanitizeForPrompt(value: unknown, depth = 0): unknown {
  if (depth > 4) return null;

  if (typeof value === 'string') {
    return sanitizeText(value).slice(0, 500);
  }

  if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeForPrompt(item, depth + 1));
  }

  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const [rawKey, rawVal] of Object.entries(input).slice(0, 20)) {
      const key = sanitizeText(rawKey).slice(0, 60);
      if (!key) continue;
      output[key] = sanitizeForPrompt(rawVal, depth + 1);
    }
    return output;
  }

  return null;
}

function validateMessages(value: unknown): ChatMessage[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
    return null;
  }

  const parsed: ChatMessage[] = [];
  for (const item of value) {
    const record = asRecord(item);
    if (!record) return null;

    const role = record.role;
    const content = record.content;

    if (typeof role !== 'string' || !ALLOWED_ROLES.has(role as ChatMessageRole)) {
      return null;
    }

    if (typeof content !== 'string') {
      return null;
    }

    const normalizedContent = sanitizeText(content);
    if (normalizedContent.length === 0 || normalizedContent.length > MAX_MESSAGE_CONTENT_LENGTH) {
      return null;
    }

    parsed.push({ role: role as ChatMessageRole, content: normalizedContent });
  }

  return parsed;
}

export function gatewayError(
  code: GatewayErrorCode,
  message: string,
  status: number,
): { status: number; body: GatewayErrorBody } {
  return {
    status,
    body: {
      error: {
        code,
        message,
      },
    },
  };
}

export function isPayloadTooLarge(rawBody: string, maxBytes = MAX_REQUEST_BODY_BYTES): boolean {
  return new TextEncoder().encode(rawBody).length > maxBytes;
}

export function parseGatewayRequest(body: unknown):
  | { ok: true; value: ParsedGatewayRequest }
  | { ok: false; error: { status: number; body: GatewayErrorBody } } {
  const parsedBody = asRecord(body);
  if (!parsedBody) {
    return {
      ok: false,
      error: gatewayError('INVALID_REQUEST', 'Request body must be a JSON object.', 400),
    };
  }

  const action = normalizeAction(parsedBody.action);

  if (action === 'agent_health_probe') {
    const url = validateAgentHealthUrl(parsedBody.url);
    if (!url) {
      return {
        ok: false,
        error: gatewayError('INVALID_REQUEST', 'Field "url" must be a valid http/https URL.', 400),
      };
    }

    return {
      ok: true,
      value: {
        action,
        url,
      },
    };
  }

  if (action === 'generate_kill_chain') {
    const project = parsedBody.project;
    const vulnerabilities = parsedBody.vulnerabilities;

    const normalizedProject = typeof project === 'string' ? sanitizeText(project) : '';

    if (
      typeof project !== 'string' ||
      normalizedProject.length === 0 ||
      normalizedProject.length > MAX_PROJECT_LENGTH
    ) {
      return {
        ok: false,
        error: gatewayError('INVALID_REQUEST', 'Field "project" is required for kill chain generation.', 400),
      };
    }

    if (!Array.isArray(vulnerabilities) || vulnerabilities.length === 0) {
      return {
        ok: false,
        error: gatewayError('INVALID_REQUEST', 'Field "vulnerabilities" must be a non-empty array.', 400),
      };
    }

    if (vulnerabilities.length > MAX_VULNERABILITIES) {
      return {
        ok: false,
        error: gatewayError(
          'INVALID_REQUEST',
          `Field "vulnerabilities" exceeds the limit of ${MAX_VULNERABILITIES} items.`,
          400,
        ),
      };
    }

    const sanitizedVulnerabilities = vulnerabilities.map((item) => sanitizeForPrompt(item));
    const serializedVulnerabilities = JSON.stringify(sanitizedVulnerabilities, null, 2);

    if (serializedVulnerabilities.length > MAX_PROMPT_SOURCE_CHARS) {
      return {
        ok: false,
        error: gatewayError(
          'INVALID_REQUEST',
          'Field "vulnerabilities" is too large to process safely.',
          400,
        ),
      };
    }

    const message: ChatMessage = {
      role: 'user',
      content: `You are an expert Red Teamer. Generate a MITRE ATT&CK Kill Chain attack path based on these vulnerabilities for project ${normalizedProject}:\n${serializedVulnerabilities}\nRespond ONLY with a JSON array of objects without markdown block formatting. Each object must have: phase (e.g. Reconnaissance, Initial Access, Execution, Exfiltration), tactic (e.g. TA0043), description (how attacker moves), exploited_vuln (title of the vuln used), asset (the target asset).`,
    };

    return {
      ok: true,
      value: {
        action,
        project: normalizedProject,
        vulnerabilities: sanitizedVulnerabilities,
        messages: [message],
      },
    };
  }

  const messages = validateMessages(parsedBody.messages);
  if (!messages) {
    return {
      ok: false,
      error: gatewayError('INVALID_REQUEST', 'Field "messages" must be a non-empty array of valid chat messages.', 400),
    };
  }

  return {
    ok: true,
    value: {
      action,
      messages,
    },
  };
}
