import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getUserProfile } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Timeout de seguridad: si Supabase tarda más de 6s (lock bloqueado), forzar loading=false
    const timeout = setTimeout(() => setLoading(false), 6000);

    // Obtener sesión inicial
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      clearTimeout(timeout);

      // Verificar que el token siga siendo válido con el servidor
      if (session) {
        const { error } = await supabase.auth.getUser();
        if (error) {
          // Token expirado o inválido — cerrar sesión y mandar al login
          await supabase.auth.signOut().catch(() => {});
          setSession(null);
          setPerfil(null);
          setLoading(false);
          return;
        }
      }

      setSession(session);
      if (session?.user) {
        try {
          const p = await getUserProfile(session.user.id);
          setPerfil(p);
        } catch (e) {
          console.error('Error obteniendo perfil:', e);
        }
      }
      setLoading(false);
    });

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
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
