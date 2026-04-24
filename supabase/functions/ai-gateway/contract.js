export const MAX_REQUEST_BODY_BYTES = 100000;
const MAX_MESSAGES = 50;
const MAX_MESSAGE_CONTENT_LENGTH = 8000;
const MAX_PROJECT_LENGTH = 200;
const MAX_VULNERABILITIES = 100;
const MAX_PROMPT_SOURCE_CHARS = 40000;
const ALLOWED_ROLES = new Set(['user', 'assistant', 'system']);
function asRecord(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value;
}
function normalizeAction(value) {
    if (value === 'generate_kill_chain')
        return 'generate_kill_chain';
    return 'chat';
}
function sanitizeText(value) {
    let out = '';
    for (let i = 0; i < value.length; i++) {
        const code = value.charCodeAt(i);
        const isForbiddenControl = (code >= 0 && code <= 8) || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127;
        if (!isForbiddenControl) {
            out += value[i];
        }
    }
    return out.trim();
}
function sanitizeForPrompt(value, depth = 0) {
    if (depth > 4)
        return null;
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
        const input = value;
        const output = {};
        for (const [rawKey, rawVal] of Object.entries(input).slice(0, 20)) {
            const key = sanitizeText(rawKey).slice(0, 60);
            if (!key)
                continue;
            output[key] = sanitizeForPrompt(rawVal, depth + 1);
        }
        return output;
    }
    return null;
}
function validateMessages(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MESSAGES) {
        return null;
    }
    const parsed = [];
    for (const item of value) {
        const record = asRecord(item);
        if (!record)
            return null;
        const role = record.role;
        const content = record.content;
        if (typeof role !== 'string' || !ALLOWED_ROLES.has(role)) {
            return null;
        }
        if (typeof content !== 'string') {
            return null;
        }
        const normalizedContent = sanitizeText(content);
        if (normalizedContent.length === 0 || normalizedContent.length > MAX_MESSAGE_CONTENT_LENGTH) {
            return null;
        }
        parsed.push({ role: role, content: normalizedContent });
    }
    return parsed;
}
export function gatewayError(code, message, status) {
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
export function isPayloadTooLarge(rawBody, maxBytes = MAX_REQUEST_BODY_BYTES) {
    return new TextEncoder().encode(rawBody).length > maxBytes;
}
export function parseGatewayRequest(body) {
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
        const normalizedProject = typeof project === 'string' ? sanitizeText(project) : '';
        if (typeof project !== 'string' ||
            normalizedProject.length === 0 ||
            normalizedProject.length > MAX_PROJECT_LENGTH) {
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
                error: gatewayError('INVALID_REQUEST', `Field "vulnerabilities" exceeds the limit of ${MAX_VULNERABILITIES} items.`, 400),
            };
        }
        const sanitizedVulnerabilities = vulnerabilities.map((item) => sanitizeForPrompt(item));
        const serializedVulnerabilities = JSON.stringify(sanitizedVulnerabilities, null, 2);
        if (serializedVulnerabilities.length > MAX_PROMPT_SOURCE_CHARS) {
            return {
                ok: false,
                error: gatewayError('INVALID_REQUEST', 'Field "vulnerabilities" is too large to process safely.', 400),
            };
        }
        const message = {
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
