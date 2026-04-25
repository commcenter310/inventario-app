import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function getMovimientos({ itemId, usuarioId, tipo, desde, hasta } = {}) {
  let query = supabase
    .from('movimientos')
    .select(`
      *,
      items(nombre, categoria),
      usuarios(nombre, email)
    `)
    .order('timestamp', { ascending: false });

  if (itemId) query = query.eq('item_id', itemId);
  if (usuarioId) query = query.eq('usuario_id', usuarioId);
  if (tipo) query = query.eq('tipo', tipo);
  if (desde) query = query.gte('timestamp', desde);
  if (hasta) query = query.lte('timestamp', hasta);

  const { data, error } = await query.limit(500);
  if (error) throw error;
  return data;
}

export function exportarMovimientosExcel(movimientos) {
  const rows = movimientos.map(m => ({
    'Fecha': format(new Date(m.timestamp), 'dd/MM/yyyy HH:mm', { locale: es }),
    'Item': m.items?.nombre || m.item_id,
    'Categoría': m.items?.categoria || '',
    'Tipo': m.tipo,
    'Cantidad': m.cantidad,
    'Usuario': m.usuarios?.nombre || m.usuario_id,
    'Notas': m.notas || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Movimientos');
  XLSX.writeFile(wb, `movimientos_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
}
