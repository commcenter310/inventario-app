import React, { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { getItems, createItem, updateItem, deleteItem } from '../services/items';
import Navbar from '../components/Navbar';

const ITEM_VACIO = { nombre: '', categoria: '', cantidad: 0, cantidad_minima: 5, ubicacion: '', descripcion: '', valor_aproximado: '' };

export default function AdminInventario() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(ITEM_VACIO);
  const [qrVer, setQrVer] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  async function cargar() {
    setLoading(true);
    try { setItems(await getItems()); } catch (e) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function abrirCrear() {
    setEditando(null);
    setForm(ITEM_VACIO);
    setShowForm(true);
    setError('');
  }

  function abrirEditar(item) {
    setEditando(item.id);
    setForm({ ...item });
    setShowForm(true);
    setError('');
  }

  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true);
    setError('');
    try {
      if (editando) {
        await updateItem(editando, form);
      } else {
        await createItem(form);
      }
      setShowForm(false);
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleEliminar(id, nombre) {
    if (!window.confirm(`¿Eliminar "${nombre}"? Esta acción lo desactivará.`)) return;
    try {
      await deleteItem(id);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  function imprimirQR(item) {
    const win = window.open('', '_blank');
    win.document.write(`
      <html><body style="text-align:center;font-family:sans-serif;padding:20px">
        <h2>${item.nombre}</h2>
        <div id="qr"></div>
        <p style="font-size:12px">${item.qr_code}</p>
        <script>window.onload=()=>{window.print();window.close();}<\/script>
      </body></html>
    `);
    // En producción esto abre la ventana, el QR SVG no es transferible así,
    // pero el usuario puede hacer clic en Ver QR y hacer screenshot o usar el botón de imprimir del modal
  }

  const itemsFiltrados = items.filter(i =>
    i.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    (i.categoria || '').toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <h1>📋 Gestión de Inventario</h1>
          <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo Item</button>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <input
          type="text"
          className="search-input"
          placeholder="🔍 Buscar..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
        />

        {loading ? <div className="loading">Cargando...</div> : (
          <div className="items-table-wrapper">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Categoría</th>
                  <th>Stock</th>
                  <th>Mínimo</th>
                  <th>Ubicación</th>
                  <th>QR</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {itemsFiltrados.map(item => (
                  <tr key={item.id} className={item.cantidad <= item.cantidad_minima ? 'row-alerta' : ''}>
                    <td><strong>{item.nombre}</strong></td>
                    <td>{item.categoria || '—'}</td>
                    <td><span className={`badge-stock ${item.cantidad <= item.cantidad_minima ? 'badge-bajo' : 'badge-ok'}`}>{item.cantidad}</span></td>
                    <td>{item.cantidad_minima}</td>
                    <td>{item.ubicacion || '—'}</td>
                    <td>
                      <button className="btn btn-xs btn-secondary" onClick={() => setQrVer(item)}>Ver QR</button>
                    </td>
                    <td>
                      <button className="btn btn-xs btn-secondary" onClick={() => abrirEditar(item)}>✏️</button>
                      <button className="btn btn-xs btn-danger" onClick={() => handleEliminar(item.id, item.nombre)}>🗑</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal QR */}
        {qrVer && (
          <div className="modal-overlay" onClick={() => setQrVer(null)}>
            <div className="modal qr-modal" onClick={e => e.stopPropagation()}>
              <h2>{qrVer.nombre}</h2>
              <QRCodeSVG value={qrVer.qr_code} size={200} />
              <p className="qr-code-text">{qrVer.qr_code}</p>
              <button className="btn btn-primary" onClick={() => window.print()}>🖨 Imprimir</button>
              <button className="btn btn-secondary" onClick={() => setQrVer(null)}>Cerrar</button>
            </div>
          </div>
        )}

        {/* Modal Crear/Editar */}
        {showForm && (
          <div className="modal-overlay">
            <div className="modal form-modal">
              <h2>{editando ? 'Editar Item' : 'Nuevo Item'}</h2>
              <form onSubmit={handleGuardar}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Categoría</label>
                    <input value={form.categoria || ''} onChange={e => setForm({ ...form, categoria: e.target.value })} placeholder="hojas, plumas, equipo..." />
                  </div>
                  <div className="form-group">
                    <label>Stock actual</label>
                    <input type="number" min="0" value={form.cantidad} onChange={e => setForm({ ...form, cantidad: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group">
                    <label>Stock mínimo (alerta)</label>
                    <input type="number" min="0" value={form.cantidad_minima} onChange={e => setForm({ ...form, cantidad_minima: parseInt(e.target.value) || 0 })} />
                  </div>
                  <div className="form-group">
                    <label>Ubicación</label>
                    <input value={form.ubicacion || ''} onChange={e => setForm({ ...form, ubicacion: e.target.value })} placeholder="Armario A, Cajón 3..." />
                  </div>
                  <div className="form-group">
                    <label>Valor aproximado ($)</label>
                    <input type="number" min="0" step="0.01" value={form.valor_aproximado || ''} onChange={e => setForm({ ...form, valor_aproximado: e.target.value })} />
                  </div>
                  <div className="form-group span-2">
                    <label>Descripción</label>
                    <textarea value={form.descripcion || ''} onChange={e => setForm({ ...form, descripcion: e.target.value })} rows={2} />
                  </div>
                </div>
                {error && <div className="error-msg">{error}</div>}
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? 'Guardando...' : (editando ? 'Guardar cambios' : 'Crear item')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
