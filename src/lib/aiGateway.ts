import { generateAIResponse } from './aiMock';

export type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export async function callAiGateway(messages: ChatMessage[]): Promise<{ content: string; provider: string }> {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-gateway`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ messages }),
    });
    if (!res.ok) throw new Error(`Gateway error ${res.status}`);
    const json = await res.json();
    return { content: json.content ?? '', provider: json.provider ?? 'unknown' };
  } catch (err) {
    const last = [...messages].reverse().find((m) => m.role === 'user');
    return { content: generateAIResponse(last?.content ?? ''), provider: 'local-mock' };
  }
}
