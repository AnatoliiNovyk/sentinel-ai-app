/* eslint-disable react-refresh/only-export-components */
import { createContext, useEffect, useRef, useState, ReactNode, useCallback, useContext } from 'react';
import { supabase, Presence } from '../lib/supabase';
import { useAuth } from './useAuth';

type PresenceContextValue = {
  activePresence: Record<string, Presence[]>; // context_id -> Presence[]
  updatePresence: (contextType: Presence['context_type'], contextId: string) => Promise<void>;
  getMembersViewing: (contextType: Presence['context_type'], contextId: string) => Presence[];
};

export const PresenceContext = createContext<PresenceContextValue | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const { user, profile, organizations } = useAuth();
  const [activePresence, setActivePresence] = useState<Record<string, Presence[]>>({});
  const presenceRef = useRef<{ type: Presence['context_type']; id: string } | null>(null);
  const subscriptionRef = useRef<{ unsubscribe: () => void } | null>(null);

  // Update user's presence
  const updatePresence = useCallback(
    async (contextType: Presence['context_type'], contextId: string) => {
      if (!user || !profile || organizations.length === 0) return;

      const org = organizations[0];
      presenceRef.current = { type: contextType, id: contextId };

      // Upsert presence record (create or update)
      const { error } = await supabase
        .from('presence')
        .upsert({
          user_id: user.id,
          org_id: org.id,
          context_type: contextType,
          context_id: contextId,
          last_seen_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id,org_id,context_type,context_id'
        });

      if (!error) {
        // Subscribe to presence updates for this context
        subscribeToContext(org.id, contextType, contextId);
      }
    },
    [user, profile, organizations]
  );

  // Subscribe to presence changes for a context
  const subscribeToContext = (org_id: string, contextType: Presence['context_type'], contextId: string) => {
    // Cleanup old subscription
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
    }

    subscriptionRef.current = supabase
      .from(`presence:org_id=eq.${org_id}`)
      .on('*', (payload) => {
        const record = payload.new as Presence;
        if (record.context_type === contextType && record.context_id === contextId) {
          setActivePresence((prev) => {
            const key = `${contextType}:${contextId}`;
            const current = prev[key] || [];
            const updated = current.filter(p => p.user_id !== record.user_id);
            updated.push(record);
            return { ...prev, [key]: updated };
          });
        }
      })
      .subscribe();
  };

  // Get members viewing a specific context
  const getMembersViewing = useCallback(
    (contextType: Presence['context_type'], contextId: string): Presence[] => {
      const key = `${contextType}:${contextId}`;
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60000);

      // Filter out stale presence records (older than 5 minutes)
      return (activePresence[key] || []).filter(
        p => new Date(p.last_seen_at) > fiveMinutesAgo && p.user_id !== user?.id
      );
    },
    [activePresence, user?.id]
  );

  // Periodic presence heartbeat
  useEffect(() => {
    if (!presenceRef.current) return;

    const interval = setInterval(() => {
      if (presenceRef.current) {
        updatePresence(presenceRef.current.type, presenceRef.current.id);
      }
    }, 30000); // Update every 30 seconds

    return () => clearInterval(interval);
  }, [updatePresence]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  return (
    <PresenceContext.Provider value={{ activePresence, updatePresence, getMembersViewing }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (!context) {
    throw new Error('usePresence must be used within PresenceProvider');
  }
  return context;
}
