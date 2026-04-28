import { supabase } from '../lib/supabaseClient';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export async function getMovimientos({ itemId, usuarioId, tipo, desde, hasta, page = 1, pageSize = 25 } = {}) {
  let query = supabase
    .from('movimientos')
    .select(`
      *,
      items(nombre, categoria),
      usuarios(nombre, email)
    `, { count: 'exact' })
    .order('timestamp', { ascending: false });

  if (itemId) query = query.eq('item_id', itemId);
  if (usuarioId) query = query.eq('usuario_id', usuarioId);
  if (tipo) query = query.eq('tipo', tipo);
  if (desde) query = query.gte('timestamp', desde);
  if (hasta) query = query.lte('timestamp', hasta);

  const from = (page - 1) * pageSize;
  query = query.range(from, from + pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count, totalPages: Math.ceil((count || 0) / pageSize) };
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

export function exportarMovimientosPDF(movimientos, isAdmin = false) {
  const doc = new jsPDF({ orientation: 'landscape' });
  const fecha = format(new Date(), "dd/MM/yyyy HH:mm", { locale: es });

  // Encabezado
  doc.setFillColor(30, 45, 61);
  doc.rect(0, 0, doc.internal.pageSize.width, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Reporte de Movimientos', 14, 13);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generado: ${fecha}`, doc.internal.pageSize.width - 14, 13, { align: 'right' });

  const columnas = isAdmin
    ? ['Fecha', 'Item', 'Categoría', 'Tipo', 'Cantidad', 'Usuario', 'Notas']
    : ['Fecha', 'Item', 'Categoría', 'Tipo', 'Cantidad', 'Notas'];

  const filas = movimientos.map(m => {
    const fila = [
      format(new Date(m.timestamp), 'dd/MM/yy HH:mm', { locale: es }),
      m.items?.nombre || '—',
      m.items?.categoria || '—',
      m.tipo.toUpperCase(),
      m.cantidad,
    ];
    if (isAdmin) fila.push(m.usuarios?.nombre || '—');
    fila.push(m.notas || '—');
    return fila;
  });

  autoTable(doc, {
    head: [columnas],
    body: filas,
    startY: 26,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [15, 118, 110], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      3: { halign: 'center' },
      4: { halign: 'center' },
    },
    didDrawCell: (data) => {
      if (data.section === 'body' && data.column.index === 3) {
        const tipo = filas[data.row.index]?.[3];
        if (tipo === 'SALIDA')  { doc.setTextColor(185, 28, 28); }
        else if (tipo === 'ENTRADA') { doc.setTextColor(5, 150, 105); }
        else { doc.setTextColor(3, 105, 161); }
      }
    },
  });

  // Pie de página
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Página ${i} de ${pageCount}`,
      doc.internal.pageSize.width / 2,
      doc.internal.pageSize.height - 6,
      { align: 'center' }
    );
  }

  doc.save(`movimientos_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
