import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getUserProfile } from '../lib/auth';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [perfil, setPerfil] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelado = false;

    // Helper: ejecutar promesa con timeout
    const conTimeout = (promise, ms) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);

    async function inicializar() {
      try {
        // 1. Leer sesión local (rápido, lee de memoria/localStorage)
        const { data: { session: sesionLocal } } = await conTimeout(
          supabase.auth.getSession(), 5000
        );

        if (cancelado) return;

        // Si no hay sesión local, mandar a login
        if (!sesionLocal) {
          setSession(null);
          setPerfil(null);
          setLoading(false);
          return;
        }

        // 2. Validar contra el servidor refrescando el token (prueba que refresh_token sirve)
        const { data: refrescado, error: errRefresh } = await conTimeout(
          supabase.auth.refreshSession(), 6000
        );

        if (cancelado) return;

        if (errRefresh || !refrescado?.session) {
          // Refresh token expirado o inválido — limpiar todo y mandar a login
          try {
            localStorage.clear();
            sessionStorage.clear();
          } catch (e) { /* noop */ }
          setSession(null);
          setPerfil(null);
          setLoading(false);
          return;
        }

        // 3. Sesión válida, cargar perfil
        setSession(refrescado.session);
        try {
          const p = await conTimeout(getUserProfile(refrescado.session.user.id), 5000);
          if (!cancelado) setPerfil(p);
        } catch (e) {
          console.error('Error obteniendo perfil:', e);
        }
        setLoading(false);
      } catch (e) {
        // Cualquier timeout/error → tratamos como sesión inválida
        console.error('Error inicializando auth:', e);
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (err) { /* noop */ }
        if (!cancelado) {
          setSession(null);
          setPerfil(null);
          setLoading(false);
        }
      }
    }

    inicializar();

    // Escuchar cambios de sesión
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (cancelado) return;
      setSession(session);
      if (session?.user) {
        try {
          const p = await getUserProfile(session.user.id);
          if (!cancelado) setPerfil(p);
        } catch (e) {
          if (!cancelado) setPerfil(null);
        }
      } else {
        setPerfil(null);
      }
    });

    return () => {
      cancelado = true;
      subscription.unsubscribe();
    };
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
