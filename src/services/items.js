import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';

export async function getItems({ search = '', page = 1, pageSize = 20 } = {}) {
  let query = supabase
    .from('items')
    .select('*', { count: 'exact' })
    .eq('estado', 'activo')
    .order('nombre');

  if (search.trim()) {
    query = query.or(`nombre.ilike.%${search.trim()}%,categoria.ilike.%${search.trim()}%`);
  }

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count, totalPages: Math.ceil((count || 0) / pageSize) };
}

export async function getItemByQR(qrCode) {
  // Busca por coincidencia exacta o por que el qr_code contenga el código
  const { data, error } = await supabase
    .from('items')
    .select('*')
    .or(`qr_code.eq.${qrCode},qr_code.like.%${qrCode}%`)
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

async function verificarAlertaStock(item) {
  if (item.cantidad <= item.cantidad_minima) {
    // Solo insertar si no hay ya una alerta no leída para este item
    const { data: existente } = await supabase
      .from('alertas')
      .select('id')
      .eq('item_id', item.id)
      .eq('leida', false)
      .limit(1);
    if (!existente || existente.length === 0) {
      await supabase.from('alertas').insert([{
        item_id: item.id,
        mensaje: `Stock bajo: ${item.nombre} tiene solo ${item.cantidad} unidades (mínimo: ${item.cantidad_minima})`,
      }]);
    }
  }
}

export async function createItem(item) {
  // Generar QR como URL completa para que el celular abra la app directamente
  const code = `INV-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
  const base = process.env.REACT_APP_BASE_URL || window.location.origin;
  const qrCode = `${base}/escanear?qr=${code}`;
  const { data, error } = await supabase
    .from('items')
    .insert([{ ...item, qr_code: qrCode }])
    .select()
    .single();
  if (error) throw error;
  await verificarAlertaStock(data);
  return data;
}

export async function updateItem(id, updates) {
  // Excluir campos generados/inmutables que Postgres no permite actualizar
  const { id: _, qr_code, created_at, estado, ...campos } = updates;
  const { data, error } = await supabase
    .from('items')
    .update({ ...campos, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  await verificarAlertaStock(data);
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

  // 2. Actualizar stock con optimistic locking:
  //    el WHERE incluye cantidad = item.cantidad para detectar cambios concurrentes
  const { data: itemActualizado, error: updateError } = await supabase
    .from('items')
    .update({ cantidad: nuevaCantidad, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('cantidad', item.cantidad)
    .select()
    .single();

  if (updateError || !itemActualizado) {
    throw new Error('El stock fue modificado por otra operación al mismo tiempo. Por favor intenta de nuevo.');
  }

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

// ===== CATEGORÍAS =====

export async function getCategorias() {
  const { data, error } = await supabase
    .from('items')
    .select('categoria')
    .eq('estado', 'activo')
    .not('categoria', 'is', null);
  if (error) throw error;
  const counts = {};
  data.forEach(({ categoria }) => {
    counts[categoria] = (counts[categoria] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([nombre, total]) => ({ nombre, total }))
    .sort((a, b) => b.total - a.total);
}

export async function renameCategoria(nombreAnterior, nombreNuevo) {
  const { error } = await supabase
    .from('items')
    .update({ categoria: nombreNuevo || null, updated_at: new Date().toISOString() })
    .eq('categoria', nombreAnterior)
    .eq('estado', 'activo');
  if (error) throw error;
}

// ===== IMPORTACIÓN MASIVA =====

const COLUMNAS_MAP = {
  nombre: ['nombre', 'name', 'item', 'producto'],
  categoria: ['categoria', 'categoría', 'category', 'cat'],
  cantidad: ['cantidad', 'qty', 'stock', 'quantity'],
  cantidad_minima: ['cantidad_minima', 'cantidad minima', 'minimo', 'mínimo', 'min', 'stock_minimo'],
  ubicacion: ['ubicacion', 'ubicación', 'location', 'lugar'],
  descripcion: ['descripcion', 'descripción', 'description', 'desc'],
  valor_aproximado: ['valor_aproximado', 'valor', 'precio', 'price', 'value'],
};

function mapearColumnas(headers) {
  const map = {};
  headers.forEach((h, i) => {
    const key = h.toString().trim().toLowerCase();
    for (const [campo, aliases] of Object.entries(COLUMNAS_MAP)) {
      if (aliases.includes(key)) { map[campo] = i; break; }
    }
  });
  return map;
}

export function parsearArchivoImportacion(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'binary' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
        if (rows.length < 2) { reject(new Error('El archivo está vacío o solo tiene encabezados.')); return; }
        const headers = rows[0];
        const colMap = mapearColumnas(headers);
        if (colMap.nombre === undefined) {
          reject(new Error('No se encontró la columna "nombre" en el archivo.')); return;
        }
        const items = rows.slice(1)
          .filter(row => row[colMap.nombre]?.toString().trim())
          .map(row => ({
            nombre: row[colMap.nombre]?.toString().trim(),
            categoria: colMap.categoria !== undefined ? row[colMap.categoria]?.toString().trim() || null : null,
            cantidad: colMap.cantidad !== undefined ? parseInt(row[colMap.cantidad]) || 0 : 0,
            cantidad_minima: colMap.cantidad_minima !== undefined ? parseInt(row[colMap.cantidad_minima]) || 5 : 5,
            ubicacion: colMap.ubicacion !== undefined ? row[colMap.ubicacion]?.toString().trim() || null : null,
            descripcion: colMap.descripcion !== undefined ? row[colMap.descripcion]?.toString().trim() || null : null,
            valor_aproximado: colMap.valor_aproximado !== undefined ? parseFloat(row[colMap.valor_aproximado]) || null : null,
          }));
        resolve(items);
      } catch (err) { reject(err); }
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsBinaryString(file);
  });
}

export async function importarItems(itemsRaw, onProgress) {
  const resultados = { ok: 0, errores: [] };
  for (let i = 0; i < itemsRaw.length; i++) {
    try {
      await createItem(itemsRaw[i]);
      resultados.ok++;
    } catch (e) {
      resultados.errores.push({ fila: i + 2, nombre: itemsRaw[i].nombre, error: e.message });
    }
    if (onProgress) onProgress(i + 1, itemsRaw.length);
  }
  return resultados;
}

export function descargarPlantillaCSV() {
  const ws = XLSX.utils.json_to_sheet([
    { nombre: 'Lápices', categoria: 'Papelería', cantidad: 50, cantidad_minima: 10, ubicacion: 'Cajón A', descripcion: '', valor_aproximado: 5.00 },
    { nombre: 'Resmas de papel', categoria: 'Papelería', cantidad: 20, cantidad_minima: 5, ubicacion: 'Estante B', descripcion: 'Papel carta', valor_aproximado: 80.00 },
  ]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Items');
  XLSX.writeFile(wb, 'plantilla_inventario.xlsx');
}
