import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getMovimientos, exportarMovimientosExcel } from '../services/movimientos';
import { getAlertasNoLeidas, marcarAlertaLeida, marcarTodasLeidas } from '../services/alertas';
import { getItems } from '../services/items';
import { getUsuarios } from '../services/usuarios';
import { useAuth } from '../context/AuthContext';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Navbar from '../components/Navbar';

export default function Reportes() {
  const { isAdmin, session } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') || 'movimientos');

  const [movimientos, setMovimientos] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [items, setItems] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [firmaVer, setFirmaVer] = useState(null);

  // Filtros
  const [filtroItem, setFiltroItem] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroDesdeFecha, setFiltroDesdeFecha] = useState('');
  const [filtroHastaFecha, setFiltroHastaFecha] = useState('');

  useEffect(() => {
    getItems().then(setItems).catch(() => {});
    if (isAdmin) getUsuarios().then(setUsuarios).catch(() => {});
    getAlertasNoLeidas().then(setAlertas).catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    if (tab !== 'movimientos') return;
    setLoading(true);
    getMovimientos({
      itemId: filtroItem || undefined,
      usuarioId: isAdmin ? (filtroUsuario || undefined) : session.user.id,
      tipo: filtroTipo || undefined,
      desde: filtroDesdeFecha ? new Date(filtroDesdeFecha).toISOString() : undefined,
      hasta: filtroHastaFecha ? new Date(filtroHastaFecha + 'T23:59:59').toISOString() : undefined,
    }).then(setMovimientos).catch(console.error).finally(() => setLoading(false));
  }, [tab, filtroItem, filtroUsuario, filtroTipo, filtroDesdeFecha, filtroHastaFecha, isAdmin, session]);

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
        <h1>📊 Reportes</h1>

        <div className="tabs">
          <button className={tab === 'movimientos' ? 'tab active' : 'tab'} onClick={() => setTab('movimientos')}>
            Historial de Movimientos
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
              <button className="btn btn-secondary" onClick={() => exportarMovimientosExcel(movimientos)}>
                📥 Exportar Excel
              </button>
            </div>

            {loading ? <div className="loading">Cargando...</div> : (
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
                      <tr><td colSpan={7} className="empty-row">No hay movimientos.</td></tr>
                    ) : (
                      movimientos.map(m => (
                        <tr key={m.id}>
                          <td>{format(new Date(m.timestamp), 'dd/MM/yy HH:mm', { locale: es })}</td>
                          <td>{m.items?.nombre || '—'}</td>
                          <td><span className={`badge-tipo badge-${m.tipo}`}>{m.tipo}</span></td>
                          <td>{m.cantidad}</td>
                          {isAdmin && <td>{m.usuarios?.nombre || '—'}</td>}
                          <td>{m.notas || '—'}</td>
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
            )}
          </>
        )}

        {tab === 'alertas' && (
          <div className="alertas-list">
            {alertas.length === 0 ? (
              <div className="empty-row">✅ No hay alertas de stock bajo.</div>
            ) : (
              <>
                <button className="btn btn-secondary" onClick={handleMarcarTodas}>Marcar todas como resueltas</button>
                {alertas.map(a => (
                  <div key={a.id} className="alerta-card">
                    <div>
                      <strong>{a.items?.nombre}</strong>
                      <p>{a.mensaje}</p>
                      <p className="alerta-meta">Stock actual: {a.items?.cantidad} / Mínimo: {a.items?.cantidad_minima}</p>
                    </div>
                    <button className="btn btn-secondary btn-xs" onClick={() => handleMarcarLeida(a.id)}>
                      ✅ Resuelta
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
              <h2>✍️ Firma Digital</h2>
              <img src={firmaVer} alt="Firma digital" style={{ maxWidth: '100%', border: '1px solid #ccc', borderRadius: 8 }} />
              <button className="btn btn-secondary" onClick={() => setFirmaVer(null)}>Cerrar</button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
