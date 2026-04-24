import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
export const AuthContext = createContext(undefined);
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [organizations, setOrganizations] = useState([]);
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
                    full_name: user.user_metadata?.full_name ?? '',
                })
                    .select()
                    .maybeSingle();
                setProfile(created ?? null);
            }
            else {
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
    const signIn = async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        return { error: error?.message ?? null };
    };
    const signUp = async (email, password, fullName) => {
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
    return (_jsx(AuthContext.Provider, { value: { session, user, profile, organizations, loading, signIn, signUp, signOut }, children: children }));
}
