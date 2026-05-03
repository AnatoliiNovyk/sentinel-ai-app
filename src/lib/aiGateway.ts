import { generateAIResponse } from './aiMock';
import { httpPost, HttpError } from './httpClient';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type GatewayResponse = {
  content: string;
  provider: 'gemini-1.5-pro' | 'anthropic' | 'openai' | 'mock';
  isMock: boolean;
};

/**
 * Calls the Supabase ai-gateway Edge Function.
 * Falls back to the local mock ONLY if the edge function is unreachable.
 * The edge function itself handles: Gemini → Anthropic → OpenAI → mock.
 *
 * Returns the provider name so the UI can show a badge indicating
 * whether the response came from a real LLM or the local mock.
 */
export async function callAiGateway(messages: ChatMessage[]): Promise<GatewayResponse> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`;

  try {
    const json = await httpPost<{ provider?: string; content?: string }>(url, { messages }, {
      token: import.meta.env.VITE_SUPABASE_ANON_KEY,
      timeoutMs: 30_000,
    });
    const provider = (json.provider ?? 'mock') as GatewayResponse['provider'];
    return {
      content: json.content ?? '',
      provider,
      isMock: provider === 'mock',
    };
  } catch (err) {
    if (err instanceof HttpError) {
      console.warn(`[aiGateway] Edge fn returned ${err.status} — using local mock`);
    }
    console.warn('[aiGateway] Falling back to local mock:', err);
    const last = [...messages].reverse().find((m) => m.role === 'user');
    return {
      content: generateAIResponse(last?.content ?? ''),
      provider: 'mock',
      isMock: true,
    };
  }
}
