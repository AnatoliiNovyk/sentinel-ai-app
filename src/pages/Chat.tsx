import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Plus, MessageSquare, Sparkles, Loader2, Wrench } from 'lucide-react';
import { marked } from 'marked';
import { supabase, AiConversation, AiMessage } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { callAiGateway, ChatMessage } from '../lib/aiGateway';
import { runAgent, ToolResult, TOOL_LABELS } from '../lib/agentTools';

// Configure marked for safe rendering
marked.setOptions({ breaks: true, gfm: true });

const SUGGESTIONS = [
  'List my open findings',
  'Check compliance status',
  'SLA status — what is overdue?',
  'Run a scan on my first project',
  'Summarize my security posture',
  'Generate an executive summary',
];

const THINKING_PHASES = [
  'Analyzing intent',
  'Querying database',
  'Computing risk',
  'Checking compliance',
  'Generating response',
];

export default function Chat() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [toolByMessage, setToolByMessage] = useState<Record<string, ToolResult>>({});
  const [thinkingLabel, setThinkingLabel] = useState('Analyzing');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from('ai_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setConversations(data ?? []);
      if (data && data.length > 0) setActiveId(data[0].id);
    })();
  }, [user]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('ai_messages')
        .select('*')
        .eq('conversation_id', activeId)
        .order('created_at', { ascending: true });
      setMessages(data ?? []);
    })();
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const newConversation = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('ai_conversations')
      .insert({ user_id: user.id, title: 'New conversation' })
      .select()
      .maybeSingle();
    if (data) {
      setConversations((p) => [data, ...p]);
      setActiveId(data.id);
    }
  };

  const sendMessage = async (text: string) => {
    if (!user || !text.trim() || sending) return;
    setSending(true);

    let convoId = activeId;
    if (!convoId) {
      const { data } = await supabase
        .from('ai_conversations')
        .insert({
          user_id: user.id,
          title: text.slice(0, 60),
        })
        .select()
        .maybeSingle();
      if (!data) {
        setSending(false);
        return;
      }
      convoId = data.id;
      setConversations((p) => [data, ...p]);
      setActiveId(convoId);
    }

    const { data: userMsg } = await supabase
      .from('ai_messages')
      .insert({ conversation_id: convoId, user_id: user.id, role: 'user', content: text })
      .select()
      .maybeSingle();
    if (userMsg) setMessages((p) => [...p, userMsg]);
    setInput('');

    setThinkingLabel(THINKING_PHASES[0]);
    let phaseIdx = 0;
    const phaseTimer = setInterval(() => {
      phaseIdx = (phaseIdx + 1) % THINKING_PHASES.length;
      setThinkingLabel(THINKING_PHASES[phaseIdx]);
    }, 900);

    const agentTurn = await runAgent(user.id, text).catch(() => null);
    clearInterval(phaseTimer);

    let aiContent: string;
    let toolResult: ToolResult | null = null;
    if (agentTurn) {
      setThinkingLabel(`Running ${TOOL_LABELS[agentTurn.toolCalls[0]?.name] ?? 'tool'}`);
      aiContent = agentTurn.content;
      toolResult = agentTurn.toolCalls[0] ?? null;
    } else {
      const history: ChatMessage[] = [
        ...messages.map((m) => ({ role: m.role as ChatMessage['role'], content: m.content })),
        { role: 'user', content: text },
      ];
      const { content } = await callAiGateway(history);
      aiContent = content;
    }

    const { data: aiMsg } = await supabase
      .from('ai_messages')
      .insert({ conversation_id: convoId, user_id: user.id, role: 'assistant', content: aiContent })
      .select()
      .maybeSingle();
    if (aiMsg) {
      setMessages((p) => [...p, aiMsg]);
      if (toolResult) {
        setToolByMessage((prev) => ({ ...prev, [aiMsg.id]: toolResult! }));
      }
    }

    if (messages.length === 0) {
      await supabase.from('ai_conversations').update({ title: text.slice(0, 60) }).eq('id', convoId);
      setConversations((p) => p.map((c) => (c.id === convoId ? { ...c, title: text.slice(0, 60) } : c)));
    }

    setSending(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="h-screen flex">
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col">
        <div className="p-3 border-b border-slate-800">
          <button
            onClick={newConversation}
            className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 text-sm text-slate-300 transition"
          >
            <Plus className="w-4 h-4" /> New chat
          </button>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="text-xs text-slate-500 px-3 py-4">No conversations yet</div>
          ) : (
            conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveId(c.id)}
                className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${
                  activeId === c.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{c.title}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <div className="flex-1 flex flex-col bg-slate-950">
        <div className="h-16 border-b border-slate-800 px-6 flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <div className="text-sm font-semibold">Sentinel Agent</div>
            <div className="text-xs text-slate-500">Claude + Mistral orchestrator</div>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center p-8">
              <div className="max-w-xl w-full text-center">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 mx-auto mb-5 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-slate-950" />
                </div>
                <h2 className="text-2xl font-bold">How can I audit your infrastructure?</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Describe your goal in plain English. I'll pick the right scanners and deliver remediation.
                </p>
                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => sendMessage(s)}
                      className="text-left text-sm p-4 rounded-lg border border-slate-800 bg-slate-900/30 hover:border-emerald-500/50 hover:bg-slate-900 text-slate-300 transition group"
                    >
                      <span className="text-emerald-500 mr-2 opacity-60 group-hover:opacity-100 transition">→</span>{s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto p-6 space-y-6">
              {messages.map((m) => (
                <div key={m.id} className="flex gap-3">
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${
                      m.role === 'assistant'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {m.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="text-xs text-slate-500 mb-1">
                      {m.role === 'assistant' ? 'Sentinel' : 'You'}
                    </div>
                    {m.role === 'assistant' && toolByMessage[m.id] && (
                      <div className="mb-2 inline-flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-md border ${
                            toolByMessage[m.id].ok
                              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                              : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                          }`}
                        >
                          <Wrench className="w-3 h-3" />
                          {TOOL_LABELS[toolByMessage[m.id].name]}
                        </span>
                      </div>
                    )}
                    {m.role === 'assistant' ? (
                      <div
                        className="text-sm text-slate-200 leading-relaxed prose prose-invert prose-sm max-w-none
                          prose-headings:text-white prose-headings:font-semibold
                          prose-strong:text-white prose-strong:font-semibold
                          prose-code:text-emerald-300 prose-code:bg-slate-800 prose-code:px-1 prose-code:rounded
                          prose-a:text-emerald-400 prose-li:text-slate-200
                          prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5"
                        dangerouslySetInnerHTML={{ __html: marked.parse(m.content) as string }}
                      />
                    ) : (
                      <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{m.content}</div>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-2 pt-2 text-sm text-slate-500">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> {thinkingLabel}...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="border-t border-slate-800 p-4">
          <div className="max-w-3xl mx-auto flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              rows={1}
              placeholder="Describe the audit you need..."
              className="flex-1 bg-slate-900 border border-slate-800 rounded-md px-4 py-3 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none transition"
            />
            <button
              type="submit"
              disabled={!input.trim() || sending}
              className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 font-semibold w-11 h-11 rounded-md flex items-center justify-center transition shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
