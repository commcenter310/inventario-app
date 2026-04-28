import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getItems } from '../services/items';
import { getAlertasNoLeidas } from '../services/alertas';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import Paginacion from '../components/Paginacion';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const PAGE_SIZE = 20;

function formatValor(n) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}k`;
  return `$${Math.round(n).toLocaleString('es-MX')}`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { perfil } = useAuth();

  // Items paginados
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [loadingItems, setLoadingItems] = useState(true);

  // Stats (se cargan una vez, sin paginación)
  const [statsItems, setStatsItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [loadingStats, setLoadingStats] = useState(true);

  // Debounce: espera 350ms tras el último keystroke antes de buscar
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Reiniciar página al cambiar búsqueda
  useEffect(() => { setPagina(1); }, [busquedaDebounced]);

  // Carga paginada de items (tabla)
  const cargarItems = useCallback(async () => {
    setLoadingItems(true);
    const t = setTimeout(() => setLoadingItems(false), 8000);
    try {
      const { data, count, totalPages } = await getItems({
        search: busquedaDebounced,
        page: pagina,
        pageSize: PAGE_SIZE,
      });
      clearTimeout(t);
      setItems(data);
      setTotalItems(count);
      setTotalPaginas(totalPages);
    } catch (e) {
      console.error(e);
    } finally {
      clearTimeout(t);
      setLoadingItems(false);
    }
  }, [busquedaDebounced, pagina]);

  useEffect(() => { cargarItems(); }, [cargarItems]);

  // Carga de stats (todos los items, sin filtro, solo una vez)
  useEffect(() => {
    async function cargarStats() {
      setLoadingStats(true);
      const t = setTimeout(() => setLoadingStats(false), 8000);
      try {
        const [{ data }, alertasData] = await Promise.all([
          getItems({ pageSize: 1000 }),
          getAlertasNoLeidas(),
        ]);
        clearTimeout(t);
        setStatsItems(data);
        setAlertas(alertasData);
      } catch (e) {
        console.error(e);
      } finally {
        clearTimeout(t);
        setLoadingStats(false);
      }
    }
    cargarStats();
  }, []);

  // Estadísticas calculadas desde todos los items
  const stockBajo = statsItems.filter(i => i.cantidad <= i.cantidad_minima).length;
  const categorias = new Set(statsItems.map(i => i.categoria).filter(Boolean)).size;
  const valorTotal = statsItems.reduce((sum, i) => sum + ((i.valor_aproximado || 0) * i.cantidad), 0);

  const porCategoria = useMemo(() => {
    const map = {};
    statsItems.forEach(item => {
      const cat = item.categoria || 'Sin categoría';
      if (!map[cat]) map[cat] = { total: 0, bajo: 0, count: 0 };
      map[cat].total += item.cantidad;
      map[cat].count++;
      if (item.cantidad <= item.cantidad_minima) map[cat].bajo++;
    });
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 7);
  }, [statsItems]);

  const maxCatStock = Math.max(...porCategoria.map(([, v]) => v.total), 1);

  const itemsCriticos = useMemo(() =>
    [...statsItems]
      .filter(i => i.cantidad_minima > 0)
      .map(i => ({ ...i, ratio: i.cantidad / i.cantidad_minima }))
      .sort((a, b) => a.ratio - b.ratio)
      .slice(0, 5)
  , [statsItems]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? 'Buenos días' : hora < 19 ? 'Buenas tardes' : 'Buenas noches';
  const nombre = perfil?.nombre?.split(' ')[0] || '';
  const fechaHoy = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
  const fechaCapitalizada = fechaHoy.charAt(0).toUpperCase() + fechaHoy.slice(1);

  const loading = loadingStats;

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">

        {/* Hero */}
        <div className="dash-hero">
          <div>
            <p className="dash-saludo">{saludo}{nombre ? `, ${nombre}` : ''}</p>
            <p className="dash-fecha">{fechaCapitalizada}</p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/escanear')}>
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
              <rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3M17 20v1M20 14v3M20 20h1"/>
            </svg>
            Escanear QR
          </button>
        </div>

        {/* Stats */}
        {!loading && (
          <div className="stats-grid stats-grid-4">
            <div className="stat-card">
              <div className="stat-icon stat-icon-blue">
                <svg width="20" height="20" fill="none" stroke="#2563eb" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
                </svg>
              </div>
              <div>
                <div className="stat-value">{statsItems.length}</div>
                <div className="stat-label">Total de items</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-red">
                <svg width="20" height="20" fill="none" stroke="#dc2626" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01"/>
                </svg>
              </div>
              <div>
                <div className={`stat-value ${stockBajo > 0 ? 'stat-value-red' : ''}`}>{stockBajo}</div>
                <div className="stat-label">Stock bajo</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-green">
                <svg width="20" height="20" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M4 6h16M4 10h16M4 14h10"/>
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                </svg>
              </div>
              <div>
                <div className="stat-value">{categorias}</div>
                <div className="stat-label">Categorías</div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-icon stat-icon-purple">
                <svg width="20" height="20" fill="none" stroke="#7c3aed" strokeWidth="2" viewBox="0 0 24 24">
                  <line x1="12" y1="1" x2="12" y2="23"/>
                  <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>
                </svg>
              </div>
              <div>
                <div className="stat-value">{valorTotal > 0 ? formatValor(valorTotal) : '—'}</div>
                <div className="stat-label">Valor en stock</div>
              </div>
            </div>
          </div>
        )}

        {/* Insights */}
        {!loading && statsItems.length > 0 && (
          <div className="insights-grid">
            <div className="insight-panel">
              <h3 className="insight-title">Stock por categoría</h3>
              {porCategoria.length === 0 ? (
                <p className="insight-empty">Sin categorías asignadas.</p>
              ) : (
                <div className="cat-bars">
                  {porCategoria.map(([cat, val]) => (
                    <div key={cat} className="cat-bar-row">
                      <div className="cat-bar-label">
                        <span className="cat-name">{cat}</span>
                        <span className="cat-count">{val.total} uds</span>
                      </div>
                      <div className="cat-bar-track">
                        <div
                          className={`cat-bar-fill ${val.bajo > 0 ? 'cat-bar-warn' : 'cat-bar-ok'}`}
                          style={{ width: `${Math.round((val.total / maxCatStock) * 100)}%` }}
                        />
                      </div>
                      {val.bajo > 0 && (
                        <span className="cat-bajo-badge">{val.bajo} bajo</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="insight-panel">
              <h3 className="insight-title">Atención urgente</h3>
              {itemsCriticos.length === 0 ? (
                <p className="insight-empty">Todo el stock está en niveles saludables.</p>
              ) : (
                <div className="criticos-list">
                  {itemsCriticos.map(item => {
                    const pct = Math.min(Math.round((item.cantidad / item.cantidad_minima) * 100), 100);
                    const colorClass = pct <= 30 ? 'critico-fill-red' : pct <= 80 ? 'critico-fill-warn' : 'critico-fill-ok';
                    return (
                      <div key={item.id} className="critico-row">
                        <div className="critico-info">
                          <span className="critico-nombre">{item.nombre}</span>
                          <span className="critico-meta">{item.cantidad} / {item.cantidad_minima} mín</span>
                        </div>
                        <div className="critico-bar-wrap">
                          <div className="critico-bar-track">
                            <div className={`critico-bar-fill ${colorClass}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="critico-pct">{pct}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Alert banner */}
        {alertas.length > 0 && (
          <div className="alerta-banner" onClick={() => navigate('/reportes?tab=alertas')}>
            <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            <strong>{alertas.length} alerta{alertas.length > 1 ? 's' : ''} de stock bajo</strong>
            <span>— Ver alertas</span>
          </div>
        )}

        {/* Buscador */}
        <div className="search-bar">
          <input
            type="text"
            placeholder="Buscar por nombre o categoría..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        {/* Tabla paginada */}
        {loadingItems ? (
          <div className="loading">Cargando...</div>
        ) : (
          <>
            <div className="items-table-wrapper">
              <table className="items-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Categoría</th>
                    <th>Stock</th>
                    <th>Nivel</th>
                    <th>Ubicación</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-row">
                        {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay items en el inventario.'}
                      </td>
                    </tr>
                  ) : (
                    items.map(item => {
                      const bajo = item.cantidad <= item.cantidad_minima;
                      const pct = item.cantidad_minima > 0
                        ? Math.min(Math.round((item.cantidad / item.cantidad_minima) * 100), 100)
                        : 100;
                      return (
                        <tr key={item.id} className={bajo ? 'row-alerta' : ''}>
                          <td><strong>{item.nombre}</strong></td>
                          <td>
                            {item.categoria
                              ? <span className="cat-pill">{item.categoria}</span>
                              : <span className="text-muted">—</span>}
                          </td>
                          <td>
                            <span className={`badge-stock ${bajo ? 'badge-bajo' : 'badge-ok'}`}>
                              {item.cantidad}
                            </span>
                          </td>
                          <td>
                            <div className="table-mini-bar">
                              <div
                                className="table-mini-fill"
                                style={{ width: `${pct}%`, background: bajo ? '#dc2626' : '#059669' }}
                              />
                            </div>
                          </td>
                          <td className="text-muted">{item.ubicacion || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Paginacion
              pagina={pagina}
              totalPaginas={totalPaginas}
              total={totalItems}
              pageSize={PAGE_SIZE}
              onCambiar={setPagina}
            />
          </>
        )}
      </main>
    </div>
  );
}
