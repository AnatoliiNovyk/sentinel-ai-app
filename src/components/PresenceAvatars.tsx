import { useMemo } from 'react';
import { usePresence } from '../context/PresenceContext';
import { Presence } from '../lib/supabase';

interface PresenceAvatarsProps {
  contextType: Presence['context_type'];
  contextId: string;
}

const AVATAR_COLORS = [
  'bg-red-500',
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-yellow-500',
  'bg-pink-500',
  'bg-indigo-500',
  'bg-cyan-500',
];

export function PresenceAvatars({ contextType, contextId }: PresenceAvatarsProps) {
  const { getMembersViewing } = usePresence();
  
  const members = useMemo(() => getMembersViewing(contextType, contextId), [contextType, contextId, getMembersViewing]);

  if (members.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-slate-400">Viewing:</span>
      <div className="flex -space-x-2">
        {members.map((member, idx) => (
          <div
            key={member.id}
            className={`w-6 h-6 rounded-full ${AVATAR_COLORS[idx % AVATAR_COLORS.length]} flex items-center justify-center text-xs text-white font-semibold ring-2 ring-slate-900 cursor-default transition hover:scale-110`}
            title={`User ${member.user_id.slice(0, 8)}`}
          >
            {member.user_id.charAt(0).toUpperCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
