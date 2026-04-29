import { supabase } from './supabaseClient';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  // Limpiar sesión local PRIMERO — si Supabase se cuelga, al menos quedamos deslogueados
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch (e) { /* noop */ }

  // Intentar signOut con timeout para no colgarse en el lock
  try {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('signOut timeout')), 3000)),
    ]);
  } catch (e) {
    console.error('signOut:', e);
  }
}

export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

// Obtener perfil completo del usuario (incluye rol)
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('usuarios')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}
