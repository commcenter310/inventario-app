import { supabase } from '../lib/supabaseClient';

export async function getItems() {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('estado', 'activo')
    .order('nombre');
  if (error) throw error;
  return data;
}

export async function getItemByQR(qrCode) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('qr_code', qrCode)
    .eq('estado', 'activo')
    .single();
  if (error) throw error;
  return data;
}

export async function getItemById(id) {
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function createItem(item) {
  // Generar código QR único basado en UUID
  const qrCode = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const { data, error } = await supabase
    .from('items')
    .insert([{ ...item, qr_code: qrCode }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItem(id, updates) {
  const { data, error } = await supabase
    .from('items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id) {
  // Soft delete
  const { error } = await supabase
    .from('items')
    .update({ estado: 'inactivo', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function adjustStock(itemId, cantidad, tipo, firmaBase64, notas, usuarioId) {
  // 1. Obtener item actual
  const item = await getItemById(itemId);
  const nuevaCantidad = tipo === 'salida'
    ? item.cantidad - cantidad
    : item.cantidad + cantidad;

  if (nuevaCantidad < 0) throw new Error('Stock insuficiente');

  // 2. Actualizar stock
  await updateItem(itemId, { cantidad: nuevaCantidad });

  // 3. Registrar movimiento
  const { data, error } = await supabase
    .from('movimientos')
    .insert([{
      item_id: itemId,
      usuario_id: usuarioId,
      tipo,
      cantidad,
      firma_digital: firmaBase64,
      notas,
    }])
    .select()
    .single();
  if (error) throw error;

  // 4. Verificar alerta de stock bajo
  if (nuevaCantidad <= item.cantidad_minima) {
    await supabase.from('alertas').insert([{
      item_id: itemId,
      mensaje: `Stock bajo: ${item.nombre} tiene solo ${nuevaCantidad} unidades (mínimo: ${item.cantidad_minima})`,
    }]);
  }

  return { movimiento: data, nuevaCantidad };
}
