/**
 * Session et profil courant.
 *
 * Une seule source de vérité pour « qui est connecté et avec quel rôle » :
 * la navigation s'en sert pour envoyer un client vers ses écrans et un coiffeur
 * vers son back-office.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { fetchMyProfile } from './api';
import type { Profile } from './types';

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionState | null>(null);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      setProfile(await fetchMyProfile());
    } catch {
      // Un profil illisible ne doit pas bloquer l'application : on la laisse
      // retomber sur l'écran de connexion.
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return;
      setSession(data.session);
      if (data.session) await refreshProfile();
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next) await refreshProfile();
      else setProfile(null);
    });

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const value = useMemo<SessionState>(
    () => ({ session, profile, loading, refreshProfile, signOut }),
    [session, profile, loading, refreshProfile, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  const context = useContext(SessionContext);
  if (!context) throw new Error('useSession doit être utilisé sous <SessionProvider>');
  return context;
}
