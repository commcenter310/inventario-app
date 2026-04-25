import { supabase } from '../lib/supabaseClient';

export async function getUsuarios() {
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, email, nombre, rol, activo, created_at')
    .order('nombre');
  if (error) throw error;
  return data;
}

export async function createUsuario({ email, password, nombre, rol }) {
  // 1. Crear en Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (authError) throw authError;

  // 2. Insertar en tabla usuarios
  const { data, error } = await supabase
    .from('usuarios')
    .insert([{ id: authData.user.id, email, nombre, rol }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateUsuario(id, updates) {
  const { data, error } = await supabase
    .from('usuarios')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
