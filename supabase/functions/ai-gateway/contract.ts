export type ChatMessageRole = 'user' | 'assistant' | 'system';

export type ChatMessage = {
  role: ChatMessageRole;
  content: string;
};

export type GatewayAction = 'chat' | 'generate_kill_chain';

export type GatewayErrorCode =
  | 'METHOD_NOT_ALLOWED'
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
    };

const MAX_MESSAGES = 50;
const MAX_MESSAGE_CONTENT_LENGTH = 8000;
const MAX_PROJECT_LENGTH = 200;
const MAX_VULNERABILITIES = 100;

const ALLOWED_ROLES = new Set<ChatMessageRole>(['user', 'assistant', 'system']);

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeAction(value: unknown): GatewayAction {
  if (value === 'generate_kill_chain') return 'generate_kill_chain';
  return 'chat';
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

    if (
      typeof content !== 'string' ||
      content.trim().length === 0 ||
      content.length > MAX_MESSAGE_CONTENT_LENGTH
    ) {
      return null;
    }

    parsed.push({ role: role as ChatMessageRole, content });
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

  if (action === 'generate_kill_chain') {
    const project = parsedBody.project;
    const vulnerabilities = parsedBody.vulnerabilities;

    if (
      typeof project !== 'string' ||
      project.trim().length === 0 ||
      project.length > MAX_PROJECT_LENGTH
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

    const message: ChatMessage = {
      role: 'user',
      content: `You are an expert Red Teamer. Generate a MITRE ATT&CK Kill Chain attack path based on these vulnerabilities for project ${project}:\n${JSON.stringify(vulnerabilities, null, 2)}\nRespond ONLY with a JSON array of objects without markdown block formatting. Each object must have: phase (e.g. Reconnaissance, Initial Access, Execution, Exfiltration), tactic (e.g. TA0043), description (how attacker moves), exploited_vuln (title of the vuln used), asset (the target asset).`,
    };

    return {
      ok: true,
      value: {
        action,
        project,
        vulnerabilities,
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
