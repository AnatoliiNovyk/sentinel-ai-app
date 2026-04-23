import { createContext, useEffect, useRef, useState, ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, Profile, Organization } from '../lib/supabase';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  organizations: Organization[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const initialised = useRef(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);

      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setOrganizations([]);
      }

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
      setOrganizations([]);
      return;
    }
    
    (async () => {
      // 1. Fetch Profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (!profileData) {
        const { data: created } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email ?? '',
            full_name: (user.user_metadata?.full_name as string) ?? '',
          })
          .select()
          .maybeSingle();
        setProfile(created ?? null);
      } else {
        setProfile(profileData);
      }

      // 2. Fetch Organizations
      const { data: orgs } = await supabase
        .from('organizations')
        .select(`
          id,
          name,
          created_at,
          team_members!inner(user_id)
        `)
        .eq('team_members.user_id', user.id);
      
      setOrganizations(orgs ?? []);
    })();
  }, [user]);

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

  const signOut = async () => {
    setProfile(null);
    setOrganizations([]);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user, profile, organizations, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

