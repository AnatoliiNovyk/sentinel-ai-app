import { generateAIResponse } from './aiMock';
/**
 * Calls the Supabase ai-gateway Edge Function.
 * Falls back to the local mock ONLY if the edge function is unreachable.
 * The edge function itself handles: Gemini → Anthropic → OpenAI → mock.
 *
 * Returns the provider name so the UI can show a badge indicating
 * whether the response came from a real LLM or the local mock.
 */
export async function callAiGateway(messages) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`;
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({ messages }),
            signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) {
            console.warn(`[aiGateway] Edge fn returned ${res.status} — using local mock`);
            throw new Error(`Gateway ${res.status}`);
        }
        const json = await res.json();
        const provider = (json.provider ?? 'mock');
        return {
            content: json.content ?? '',
            provider,
            isMock: provider === 'mock',
        };
    }
    catch (err) {
        console.warn('[aiGateway] Falling back to local mock:', err);
        const last = [...messages].reverse().find((m) => m.role === 'user');
        return {
            content: generateAIResponse(last?.content ?? ''),
            provider: 'mock',
            isMock: true,
        };
    }
}
