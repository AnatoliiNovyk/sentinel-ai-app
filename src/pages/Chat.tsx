import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Send, Bot, User, Plus, MessageSquare, Sparkles, Loader2, Zap, Copy, Check, Trash2, Search, Filter, BarChart2, Clock } from 'lucide-react';
import { marked } from 'marked';
import { supabase } from '../api/client';
import type { AiConversation, AiMessage } from '../lib/supabase';
import { useAuth } from '../context/useAuth';
import { callAiGateway, type ChatMessage } from '../lib/aiGateway';
import { runAgent, TOOL_LABELS } from '../lib/agentTools';

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

const PROVIDER_META: Record<string, { label: string; color: string }> = {
  'gemini-1.5-pro': { label: 'Gemini 1.5 Pro', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10' },
  anthropic:        { label: 'Claude',          color: 'text-violet-300 border-violet-500/30 bg-violet-500/10' },
  openai:           { label: 'GPT-4o',          color: 'text-green-300 border-green-500/30 bg-green-500/10' },
  ollama:           { label: 'Llama 3 (Local)', color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
  mock:             { label: 'Local AI',        color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
};

export default function Chat() {
  const { user, organizations } = useAuth();
  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Analyzing');
  const [activeProvider, setActiveProvider] = useState<string>('mock');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const convs = await supabase
          .from('ai_conversations')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        setConversations(convs.data ?? []);
        if (convs.data && convs.data.length > 0) setActiveId(convs.data[0].id);
      } catch (err) {
        console.error('Failed to load chat data:', err);
      }
    })();
  }, [user]);

  const filteredConversations = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    return conversations.filter(conv => {
      const convDate = new Date(conv.created_at);
      const matchesSearch = conv.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesDate = true;
      if (dateFilter === 'today') matchesDate = convDate >= today;
      if (dateFilter === 'week') matchesDate = convDate >= weekAgo;
      if (dateFilter === 'month') matchesDate = convDate >= monthAgo;

      return matchesSearch && matchesDate;
    });
  }, [conversations, searchQuery, dateFilter]);

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
        .insert({ user_id: user.id, title: text.slice(0, 60) })
        .select()
        .maybeSingle();
      if (!data) { setSending(false); return; }
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

    let aiContent: string = '';
    try {
      // 1. Try local agent tools (nmap, etc)
      // Pass the first organization's ID to the agent tools
      const agentTurn = await runAgent(user.id, text, organizations[0]?.id).catch(() => null);
      
      if (agentTurn) {
        setThinkingLabel(`Running ${TOOL_LABELS[agentTurn.toolCalls[0]?.name] ?? 'tool'}`);
        aiContent = agentTurn.content;
      } else {
        setThinkingLabel('Calling AI gateway');
        // Build conversation history for the gateway (last 10 messages)
        const history: ChatMessage[] = messages.slice(-10).map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        }));
        history.push({ role: 'user', content: text });
        const gatewayResult = await callAiGateway(history);
        aiContent = gatewayResult.content || '(No response from AI)';
        setActiveProvider(gatewayResult.provider);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      aiContent = `Error: ${message}`;
    } finally {
      clearInterval(phaseTimer);
    }

    try {
      const { data: aiMsg } = await supabase
        .from('ai_messages')
        .insert({ conversation_id: convoId, user_id: user.id, role: 'assistant', content: aiContent })
        .select()
        .maybeSingle();
      if (aiMsg) {
        setMessages((p) => [...p, aiMsg]);
      }
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const copyMessage = useCallback(async (id: string, content: string) => {
    await navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  const deleteConversation = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase.from('ai_conversations').delete().eq('id', id);
    setConversations((p) => p.filter((c) => c.id !== id));
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  }, [activeId]);

  const providerMeta = PROVIDER_META[activeProvider] ?? PROVIDER_META.mock;

  // Sidebar stats
  const sidebarStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayCount = conversations.filter(c => new Date(c.created_at) >= today).length;
    return { total: conversations.length, filtered: filteredConversations.length, today: todayCount };
  }, [conversations, filteredConversations]);

  const clearAllConversations = useCallback(async () => {
    if (!user || conversations.length === 0) return;
    const ids = conversations.map(c => c.id);
    await supabase.from('ai_conversations').delete().in('id', ids);
    setConversations([]);
    setActiveId(null);
    setMessages([]);
  }, [user, conversations]);

  const relativeConvTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  return (
    <div className="h-screen flex">
      <aside className="w-64 border-r border-slate-800 bg-slate-950 flex flex-col">
        <div className="p-3 border-b border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <button
              onClick={newConversation}
              className="flex-1 inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 text-sm text-slate-300 transition"
            >
              <Plus className="w-4 h-4" /> New chat
            </button>
            {conversations.length > 0 && (
              <button
                onClick={clearAllConversations}
                aria-label="Clear all conversations"
                className="ml-1.5 p-2 rounded-md border border-slate-800 hover:border-red-500/40 hover:bg-red-500/5 hover:text-red-400 text-slate-500 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-300 placeholder-slate-600 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          {/* Date filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <select
              value={dateFilter}
              aria-label="Filter by date"
              title="Filter by date"
              onChange={(e) => setDateFilter(e.target.value as typeof dateFilter)}
              className="w-full px-2 py-1 text-xs bg-slate-900 border border-slate-800 rounded-md text-slate-300 focus:border-emerald-500 focus:outline-none"
            >
              <option value="all">All time</option>
              <option value="today">Today</option>
              <option value="week">Last 7 days</option>
              <option value="month">Last 30 days</option>
            </select>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-2 space-y-1">
          {/* Stats bar */}
          {sidebarStats.total > 0 && (
            <div className="flex items-center gap-2 px-1 py-1.5 mb-1">
              <BarChart2 className="w-3 h-3 text-slate-600" />
              <span className="text-[10px] text-slate-600">
                {sidebarStats.filtered === sidebarStats.total
                  ? `${sidebarStats.total} chats`
                  : `${sidebarStats.filtered} of ${sidebarStats.total}`}
              </span>
              {sidebarStats.today > 0 && (
                <span className="ml-auto text-[10px] text-emerald-600">{sidebarStats.today} today</span>
              )}
            </div>
          )}
          {filteredConversations.map((c) => (
            <div
              key={c.id}
              className={`group w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition cursor-pointer ${
                activeId === c.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'
              }`}
              onClick={() => setActiveId(c.id)}
            >
              <MessageSquare className="w-3.5 h-3.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{c.title}</div>
                <div className="text-[10px] text-slate-600 group-hover:text-slate-500 flex items-center gap-1 mt-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {relativeConvTime(c.created_at)}
                </div>
              </div>
              <button
                onClick={(e) => deleteConversation(c.id, e)}
                aria-label="Delete conversation"
                className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition p-0.5 rounded"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col bg-slate-950">
        <div className="h-16 border-b border-slate-800 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">Sentinel Agent</div>
              <div className="text-xs text-slate-500 flex items-center gap-1.5">
                AI-orchestrated security auditor
                {messages.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-medium">
                    {messages.length} msg
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${providerMeta.color}`}>
            <Zap className="w-3 h-3" />
            {providerMeta.label}
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-auto p-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="max-w-xl text-center">
                <Sparkles className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">How can I help?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-8">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => sendMessage(s)} className="p-4 text-left text-sm border border-slate-800 rounded-xl hover:border-emerald-500/50 hover:bg-slate-900 transition">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((m) => (
                <div key={m.id} className="group flex gap-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.role === 'assistant' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800'}`}>
                    {m.role === 'assistant' ? <Bot className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 relative">
                    <div className="text-sm text-slate-300 leading-relaxed" dangerouslySetInnerHTML={{ __html: marked.parse(m.content) as string }} />
                    {m.role === 'assistant' && (
                      <button
                        onClick={() => copyMessage(m.id, m.content)}
                        aria-label="Copy message"
                        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-300"
                      >
                        {copiedId === m.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex gap-4 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-sm text-slate-500 flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin" /> {thinkingLabel}...
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-4 border-t border-slate-800">
          <div className="max-w-3xl mx-auto flex gap-2">
            <div className="flex-1 relative">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                maxLength={2000}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                placeholder="Ask anything… (Enter to send, Shift+Enter for new line)"
                rows={1}
              />
              {input.length > 0 && (
                <span className={`absolute bottom-2 right-2 text-[10px] pointer-events-none ${
                  input.length > 1800 ? 'text-red-400' : 'text-slate-600'
                }`}>
                  {input.length}/2000
                </span>
              )}
            </div>
            <button
              disabled={sending || !input.trim()}
              aria-label="Send message"
              title="Send message"
              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-3 rounded-xl disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
