import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMovimientos, exportarMovimientosExcel, exportarMovimientosPDF } from '../services/movimientos';
import { getAlertasNoLeidas, marcarAlertaLeida, marcarTodasLeidas } from '../services/alertas';
import { getItems } from '../services/items';
import { getUsuarios } from '../services/usuarios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Navbar from '../components/Navbar';
import Paginacion from '../components/Paginacion';

const PAGE_SIZE = 25;

export default function Reportes() {
  const { isAdmin, session } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'movimientos');

  const [movimientos, setMovimientos] = useState([]);
  const [totalMovs, setTotalMovs] = useState(0);
  const [totalPaginasMovs, setTotalPaginasMovs] = useState(1);
  const [paginaMovs, setPaginaMovs] = useState(1);
  const [alertas, setAlertas] = useState([]);
  const [items, setItems] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [firmaVer, setFirmaVer] = useState(null);

  // Filtros — al cambiar cualquiera, vuelve a pág 1
  const [filtroItem, setFiltroItem] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDesdeFecha, setFiltroDesdeFecha] = useState('');
  const [filtroHastaFecha, setFiltroHastaFecha] = useState('');

  // Cargar listas de soporte (items + usuarios para dropdowns)
  useEffect(() => {
    getItems({ pageSize: 500 }).then(({ data }) => setItems(data)).catch(() => {});
    if (isAdmin) getUsuarios().then(setUsuarios).catch(() => {});
    getAlertasNoLeidas().then(setAlertas).catch(() => {});
  }, [isAdmin]);

  // Reiniciar página cuando cambian los filtros
  useEffect(() => { setPaginaMovs(1); }, [filtroItem, filtroUsuario, filtroTipo, filtroDesdeFecha, filtroHastaFecha]);

  // Cargar movimientos paginados
  useEffect(() => {
    if (tab !== 'movimientos') return;
    setLoading(true);
    getMovimientos({
      itemId: filtroItem || undefined,
      usuarioId: isAdmin ? (filtroUsuario || undefined) : session.user.id,
      tipo: filtroTipo || undefined,
      desde: filtroDesdeFecha ? new Date(filtroDesdeFecha).toISOString() : undefined,
      hasta: filtroHastaFecha ? new Date(filtroHastaFecha + 'T23:59:59').toISOString() : undefined,
      page: paginaMovs,
      pageSize: PAGE_SIZE,
    }).then(({ data, count, totalPages }) => {
      setMovimientos(data);
      setTotalMovs(count);
      setTotalPaginasMovs(totalPages);
    }).catch(console.error).finally(() => { setLoading(false); });
  }, [tab, filtroItem, filtroUsuario, filtroTipo, filtroDesdeFecha, filtroHastaFecha, paginaMovs, isAdmin, session]);

  // Para exportar necesitamos TODOS los movimientos (sin paginación)
  async function exportarTodos(formato) {
    setLoading(true);
    try {
      const { data } = await getMovimientos({
        itemId: filtroItem || undefined,
        usuarioId: isAdmin ? (filtroUsuario || undefined) : session.user.id,
        tipo: filtroTipo || undefined,
        desde: filtroDesdeFecha ? new Date(filtroDesdeFecha).toISOString() : undefined,
        hasta: filtroHastaFecha ? new Date(filtroHastaFecha + 'T23:59:59').toISOString() : undefined,
        page: 1,
        pageSize: 5000,
      });
      if (formato === 'excel') exportarMovimientosExcel(data);
      else exportarMovimientosPDF(data, isAdmin);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleMarcarLeida(id) {
    await marcarAlertaLeida(id);
    setAlertas(a => a.filter(x => x.id !== id));
  }

  async function handleMarcarTodas() {
    await marcarTodasLeidas();
    setAlertas([]);
  }

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <h1 className="page-title">Reportes</h1>

        <div className="tabs">
          <button className={tab === 'movimientos' ? 'tab active' : 'tab'} onClick={() => setTab('movimientos')}>
            Historial de movimientos
          </button>
          <button className={tab === 'alertas' ? 'tab active' : 'tab'} onClick={() => setTab('alertas')}>
            Alertas {alertas.length > 0 && <span className="badge">{alertas.length}</span>}
          </button>
        </div>

        {tab === 'movimientos' && (
          <>
            <div className="filtros-row">
              <select value={filtroItem} onChange={e => setFiltroItem(e.target.value)}>
                <option value="">Todos los items</option>
                {items.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
              </select>
              {isAdmin && (
                <select value={filtroUsuario} onChange={e => setFiltroUsuario(e.target.value)}>
                  <option value="">Todos los usuarios</option>
                  {usuarios.map(u => <option key={u.id} value={u.id}>{u.nombre}</option>)}
                </select>
              )}
              <select value={filtroTipo} onChange={e => setFiltroTipo(e.target.value)}>
                <option value="">Todos los tipos</option>
                <option value="salida">Salida</option>
                <option value="entrada">Entrada</option>
                <option value="ajuste">Ajuste</option>
              </select>
              <input type="date" value={filtroDesdeFecha} onChange={e => setFiltroDesdeFecha(e.target.value)} />
              <input type="date" value={filtroHastaFecha} onChange={e => setFiltroHastaFecha(e.target.value)} />
              <button className="btn btn-secondary" onClick={() => exportarTodos('excel')} disabled={loading}>
                Exportar Excel
              </button>
              <button className="btn btn-secondary" onClick={() => exportarTodos('pdf')} disabled={loading}>
                Exportar PDF
              </button>
            </div>

            {loading ? <div className="loading">Cargando...</div> : (
              <>
                <div className="items-table-wrapper">
                  <table className="items-table">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Item</th>
                        <th>Tipo</th>
                        <th>Cantidad</th>
                        {isAdmin && <th>Usuario</th>}
                        <th>Notas</th>
                        <th>Firma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.length === 0 ? (
                        <tr><td colSpan={7} className="empty-row">No hay movimientos con los filtros aplicados.</td></tr>
                      ) : (
                        movimientos.map(m => (
                          <tr key={m.id}>
                            <td>{format(new Date(m.timestamp), 'dd/MM/yy HH:mm', { locale: es })}</td>
                            <td>{m.items?.nombre || '—'}</td>
                            <td><span className={`badge-tipo badge-${m.tipo}`}>{m.tipo}</span></td>
                            <td>{m.cantidad}</td>
                            {isAdmin && <td>{m.usuarios?.nombre || '—'}</td>}
                            <td className="text-muted">{m.notas || '—'}</td>
                            <td>
                              {m.firma_digital && (
                                <button className="btn btn-xs btn-secondary" onClick={() => setFirmaVer(m.firma_digital)}>
                                  Ver firma
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                <Paginacion
                  pagina={paginaMovs}
                  totalPaginas={totalPaginasMovs}
                  total={totalMovs}
                  pageSize={PAGE_SIZE}
                  onCambiar={setPaginaMovs}
                />
              </>
            )}
          </>
        )}

        {tab === 'alertas' && (
          <div className="alertas-list">
            {alertas.length === 0 ? (
              <div className="empty-row">No hay alertas de stock bajo.</div>
            ) : (
              <>
                <button className="btn btn-secondary" style={{ marginBottom: 12 }} onClick={handleMarcarTodas}>
                  Marcar todas como resueltas
                </button>
                {alertas.map(a => (
                  <div key={a.id} className="alerta-card">
                    <div>
                      <strong>{a.items?.nombre}</strong>
                      <p>{a.mensaje}</p>
                      <p className="alerta-meta">Stock actual: {a.items?.cantidad} / Mínimo: {a.items?.cantidad_minima}</p>
                    </div>
                    <button className="btn btn-secondary btn-xs" onClick={() => handleMarcarLeida(a.id)}>
                      Resuelta
                    </button>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* Modal firma */}
        {firmaVer && (
          <div className="modal-overlay" onClick={() => setFirmaVer(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>Firma Digital</h2>
                <button className="modal-close" onClick={() => setFirmaVer(null)}>✕</button>
              </div>
              <img src={firmaVer} alt="Firma digital" style={{ maxWidth: '100%', border: '1px solid #e2e8f0', borderRadius: 8 }} />
              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={() => setFirmaVer(null)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
