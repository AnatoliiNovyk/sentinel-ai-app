import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, Profile } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  // BUG-02 fix: loading stays true until onAuthStateChange fires INITIAL_SESSION
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);

  useEffect(() => {
    // BUG-02: Use onAuthStateChange as the single source of truth.
    // INITIAL_SESSION fires synchronously on mount with the persisted session (or null),
    // after any token refresh — eliminating the race with getSession().
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      // BUG-03: Explicitly clear profile on sign-out so data never leaks between accounts
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }

      // Resolve loading only once on the very first auth event (INITIAL_SESSION)
      if (!initialised.current) {
        initialised.current = true;
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('[AuthContext] Failed to fetch profile:', error.message);
        return;
      }

      if (!data) {
        const { data: created, error: createErr } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email ?? '',
            full_name: (user.user_metadata?.full_name as string) ?? '',
          })
          .select()
          .maybeSingle();
        if (createErr) console.error('[AuthContext] Failed to create profile:', createErr.message);
        setProfile(created ?? null);
      } else {
        setProfile(data);
      }
    })();
  }, [user?.id]); // BUG-02 fix: depend on user.id not the whole object

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error: error?.message ?? null };
  };

  // BUG-03: Clear profile eagerly before signOut to prevent flash of stale data
  const signOut = async () => {
    setProfile(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
