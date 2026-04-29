import { supabase } from './supabaseClient';

export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  try {
    await supabase.auth.signOut();
  } catch (e) {
    console.error('signOut:', e);
  }
  // Limpiar sesión local siempre, aunque falle Supabase
  localStorage.clear();
  sessionStorage.clear();
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
