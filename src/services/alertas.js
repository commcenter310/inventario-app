import { supabase } from '../lib/supabaseClient';

export async function getAlertasNoLeidas() {
  const { data, error } = await supabase
    .from('alertas')
    .select('*, items(nombre, cantidad, cantidad_minima)')
    .eq('leida', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function marcarAlertaLeida(id) {
  const { error } = await supabase
    .from('alertas')
    .update({ leida: true })
    .eq('id', id);
  if (error) throw error;
}

export async function marcarTodasLeidas() {
  const { error } = await supabase
    .from('alertas')
    .update({ leida: true })
    .eq('leida', false);
  if (error) throw error;
}
