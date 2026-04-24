import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef, useState } from 'react';
import { Send, Bot, User, Plus, MessageSquare, Sparkles, Loader2, Zap } from 'lucide-react';
import { marked } from 'marked';
import { supabase } from '../api/client';
import { useAuth } from '../context/useAuth';
import { ScansService } from '../api/scans.service';
import { AiService } from '../api/ai.service';
import { runAgent, TOOL_LABELS } from '../lib/agentTools';
import { errorToUserMessage } from '../lib/errors';
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
const PROVIDER_META = {
    'gemini-1.5-pro': { label: 'Gemini 1.5 Pro', color: 'text-blue-300 border-blue-500/30 bg-blue-500/10' },
    anthropic: { label: 'Claude', color: 'text-violet-300 border-violet-500/30 bg-violet-500/10' },
    openai: { label: 'GPT-4o', color: 'text-green-300 border-green-500/30 bg-green-500/10' },
    ollama: { label: 'Llama 3 (Local)', color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
    mock: { label: 'Local AI', color: 'text-emerald-300 border-emerald-500/30 bg-emerald-500/10' },
};
function extractAssistantText(payload) {
    if (!payload || typeof payload !== 'object')
        return null;
    const record = payload;
    const direct = ['content', 'description', 'remediation', 'explanation'];
    for (const key of direct) {
        const value = record[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
        }
    }
    return null;
}
export default function Chat() {
    const { user, organizations } = useAuth();
    const [conversations, setConversations] = useState([]);
    const [projects, setProjects] = useState([]);
    const [activeId, setActiveId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [thinkingLabel, setThinkingLabel] = useState('Analyzing');
    const scrollRef = useRef(null);
    useEffect(() => {
        if (!user)
            return;
        (async () => {
            try {
                const [convs, projs] = await Promise.all([
                    supabase.from('ai_conversations').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
                    ScansService.getProjects()
                ]);
                setConversations(convs.data ?? []);
                setProjects(projs);
                if (convs.data && convs.data.length > 0)
                    setActiveId(convs.data[0].id);
            }
            catch (err) {
                console.error('Failed to load chat data:', err);
            }
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
        if (!user)
            return;
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
    const sendMessage = async (text) => {
        if (!user || !text.trim() || sending)
            return;
        setSending(true);
        let convoId = activeId;
        if (!convoId) {
            const { data } = await supabase
                .from('ai_conversations')
                .insert({ user_id: user.id, title: text.slice(0, 60) })
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
        if (userMsg)
            setMessages((p) => [...p, userMsg]);
        setInput('');
        setThinkingLabel(THINKING_PHASES[0]);
        let phaseIdx = 0;
        const phaseTimer = setInterval(() => {
            phaseIdx = (phaseIdx + 1) % THINKING_PHASES.length;
            setThinkingLabel(THINKING_PHASES[phaseIdx]);
        }, 900);
        let aiContent = '';
        try {
            // 1. Try local agent tools (nmap, etc)
            // Pass the first organization's ID to the agent tools
            const agentTurn = await runAgent(user.id, text, organizations[0]?.id).catch(() => null);
            if (agentTurn) {
                setThinkingLabel(`Running ${TOOL_LABELS[agentTurn.toolCalls[0]?.name] ?? 'tool'}`);
                aiContent = agentTurn.content;
            }
            else {
                const projId = projects[0]?.id;
                if (!projId) {
                    aiContent = "Error: No project found. Please create a project to use the AI Assistant.";
                }
                else if (!convoId) {
                    aiContent = "Error: Please select or create a conversation.";
                }
                else {
                    clearInterval(phaseTimer);
                    setThinkingLabel('Dispatching AI task');
                    const pollingStart = Date.now();
                    const dispatchResult = await AiService.dispatchChatTask(projId, convoId, user.id, text);
                    if (!dispatchResult.ok) {
                        aiContent = `Error: ${errorToUserMessage(dispatchResult.error)}`;
                    }
                    else {
                        setThinkingLabel('Polling AI result');
                        const pollResult = await AiService.pollForResult(null, pollingStart, (progress) => {
                            if (progress.status === 'retrying') {
                                setThinkingLabel('Retrying after transient error');
                            }
                            else {
                                setThinkingLabel('Polling AI result');
                            }
                        });
                        if (!pollResult.ok) {
                            aiContent = `Error: ${errorToUserMessage(pollResult.error)}`;
                        }
                        else {
                            aiContent = extractAssistantText(pollResult.data) ?? '(AI is responding...)';
                        }
                    }
                }
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error';
            aiContent = `Error: ${message}`;
        }
        finally {
            clearInterval(phaseTimer);
        }
        const { data: aiMsg } = await supabase
            .from('ai_messages')
            .insert({ conversation_id: convoId, user_id: user.id, role: 'assistant', content: aiContent })
            .select()
            .maybeSingle();
        if (aiMsg) {
            setMessages((p) => [...p, aiMsg]);
        }
        setSending(false);
    };
    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };
    const providerMeta = PROVIDER_META.ollama;
    return (_jsxs("div", { className: "h-screen flex", children: [_jsxs("aside", { className: "w-64 border-r border-slate-800 bg-slate-950 flex flex-col", children: [_jsx("div", { className: "p-3 border-b border-slate-800", children: _jsxs("button", { onClick: newConversation, className: "w-full inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 text-sm text-slate-300 transition", children: [_jsx(Plus, { className: "w-4 h-4" }), " New chat"] }) }), _jsx("div", { className: "flex-1 overflow-auto p-2 space-y-1", children: conversations.map((c) => (_jsxs("button", { onClick: () => setActiveId(c.id), className: `w-full text-left flex items-center gap-2 px-3 py-2 rounded-md text-sm transition ${activeId === c.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:bg-slate-900 hover:text-white'}`, children: [_jsx(MessageSquare, { className: "w-3.5 h-3.5 shrink-0" }), _jsx("span", { className: "truncate", children: c.title })] }, c.id))) })] }), _jsxs("div", { className: "flex-1 flex flex-col bg-slate-950", children: [_jsxs("div", { className: "h-16 border-b border-slate-800 px-6 flex items-center justify-between", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-8 h-8 rounded-md bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center", children: _jsx(Bot, { className: "w-4 h-4 text-emerald-400" }) }), _jsxs("div", { children: [_jsx("div", { className: "text-sm font-semibold text-white", children: "Sentinel Agent" }), _jsx("div", { className: "text-xs text-slate-500", children: "AI-orchestrated security auditor" })] })] }), _jsxs("div", { className: `inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${providerMeta.color}`, children: [_jsx(Zap, { className: "w-3 h-3" }), providerMeta.label] })] }), _jsx("div", { ref: scrollRef, className: "flex-1 overflow-auto p-6", children: messages.length === 0 ? (_jsx("div", { className: "h-full flex items-center justify-center", children: _jsxs("div", { className: "max-w-xl text-center", children: [_jsx(Sparkles, { className: "w-12 h-12 text-emerald-500 mx-auto mb-4" }), _jsx("h2", { className: "text-2xl font-bold text-white mb-2", children: "How can I help?" }), _jsx("div", { className: "grid grid-cols-1 sm:grid-cols-2 gap-2 mt-8", children: SUGGESTIONS.map((s) => (_jsx("button", { onClick: () => sendMessage(s), className: "p-4 text-left text-sm border border-slate-800 rounded-xl hover:border-emerald-500/50 hover:bg-slate-900 transition", children: s }, s))) })] }) })) : (_jsxs("div", { className: "max-w-3xl mx-auto space-y-6", children: [messages.map((m) => (_jsxs("div", { className: "flex gap-4", children: [_jsx("div", { className: `w-8 h-8 rounded-lg flex items-center justify-center ${m.role === 'assistant' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-800'}`, children: m.role === 'assistant' ? _jsx(Bot, { className: "w-4 h-4" }) : _jsx(User, { className: "w-4 h-4" }) }), _jsx("div", { className: "flex-1", children: _jsx("div", { className: "text-sm text-slate-300 leading-relaxed", dangerouslySetInnerHTML: { __html: marked.parse(m.content) } }) })] }, m.id))), sending && (_jsxs("div", { className: "flex gap-4 animate-pulse", children: [_jsx("div", { className: "w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center", children: _jsx(Bot, { className: "w-4 h-4 text-emerald-400" }) }), _jsxs("div", { className: "text-sm text-slate-500 flex items-center gap-2", children: [_jsx(Loader2, { className: "w-3 h-3 animate-spin" }), " ", thinkingLabel, "..."] })] }))] })) }), _jsx("form", { onSubmit: handleSubmit, className: "p-4 border-t border-slate-800", children: _jsxs("div", { className: "max-w-3xl mx-auto flex gap-2", children: [_jsx("textarea", { value: input, onChange: (e) => setInput(e.target.value), className: "flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20", placeholder: "Ask anything...", rows: 1 }), _jsx("button", { disabled: sending || !input.trim(), "aria-label": "Send message", title: "Send message", className: "bg-emerald-500 hover:bg-emerald-400 text-slate-950 p-3 rounded-xl disabled:opacity-50", children: _jsx(Send, { className: "w-5 h-5" }) })] }) })] })] }));
}
