import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getUserProfile } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Leer sesión guardada (de localStorage, instantáneo con noopLock)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        getUserProfile(session.user.id)
          .then(p => setPerfil(p))
          .catch(() => setPerfil(null));
      }
      setLoading(false);
    }).catch(() => {
      setLoading(false);
    });

    // 2. Escuchar TODOS los cambios: login, logout, token refresh, token expirado
    //    Supabase maneja el refresh automáticamente con autoRefreshToken: true.
    //    Si el refresh token expira, dispara SIGNED_OUT y session se vuelve null.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);

      if (session?.user) {
        try {
          const p = await getUserProfile(session.user.id);
          setPerfil(p);
        } catch (e) {
          setPerfil(null);
        }
      } else {
        setPerfil(null);
      }

      // Si estábamos en loading (primer render), ya terminamos
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const value = {
    session,
    perfil,
    loading,
    rol: perfil?.rol || null,
    isAdmin: perfil?.rol === 'admin',
    isOperario: perfil?.rol === 'operario',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
