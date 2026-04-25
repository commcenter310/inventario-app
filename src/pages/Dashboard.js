import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getItems } from '../services/items';
import { getAlertasNoLeidas } from '../services/alertas';
import Navbar from '../components/Navbar';

export default function Dashboard() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [alertas, setAlertas] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function cargar() {
      try {
        const [itemsData, alertasData] = await Promise.all([
          getItems(),
          getAlertasNoLeidas(),
        ]);
        setItems(itemsData);
        setAlertas(alertasData);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  const itemsFiltrados = items.filter(item =>
    item.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (item.categoria || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <div className="dashboard-header">
          <h1>📦 Inventario Actual</h1>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/escanear')}>
            📷 ESCANEAR QR
          </button>
        </div>

        {alertas.length > 0 && (
          <div className="alerta-banner" onClick={() => navigate('/reportes?tab=alertas')}>
            🔔 <strong>{alertas.length} alerta{alertas.length > 1 ? 's' : ''} de stock bajo</strong> — Ver alertas
          </div>
        )}

        <div className="search-bar">
          <input
            type="text"
            placeholder="🔍 Buscar por nombre o categoría..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
          />
        </div>

        {loading ? (
          <div className="loading">Cargando inventario...</div>
        ) : (
          <div className="items-table-wrapper">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Ubicación</th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.length === 0 ? (
                  <tr><td colSpan={5} className="empty-row">No hay items{busqueda ? ' con ese filtro' : ''}.</td></tr>
                ) : (
                  itemsFiltrados.map(item => (
                    <tr key={item.id} className={item.cantidad <= item.cantidad_minima ? 'row-alerta' : ''}>
                      <td><strong>{item.nombre}</strong></td>
                      <td>{item.categoria || '—'}</td>
                      <td>
                        <span className={`badge-stock ${item.cantidad <= item.cantidad_minima ? 'badge-bajo' : 'badge-ok'}`}>
                          {item.cantidad}
                        </span>
                      </td>
                      <td>{item.cantidad_minima}</td>
                      <td>{item.ubicacion || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}
