import React, { useEffect, useState, useRef, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  getItems, createItem, updateItem, deleteItem,
  getCategorias, renameCategoria,
  parsearArchivoImportacion, importarItems, descargarPlantillaCSV,
} from '../services/items';
import Navbar from '../components/Navbar';
import Paginacion from '../components/Paginacion';

const PAGE_SIZE = 20;
const ITEM_VACIO = {
  nombre: '', categoria: '', cantidad: 0, cantidad_minima: 5,
  ubicacion: '', descripcion: '', valor_aproximado: '',
};

export default function AdminInventario() {
  const [tab, setTab] = useState('items');

  // Items state
  const [items, setItems] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [pagina, setPagina] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(ITEM_VACIO);
  const [qrVer, setQrVer] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDebounced, setBusquedaDebounced] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // Categorías state
  const [categorias, setCategorias] = useState([]);
  const [catLoading, setCatLoading] = useState(false);
  const [catEditando, setCatEditando] = useState(null);
  const [catNuevoNombre, setCatNuevoNombre] = useState('');
  const [catGuardando, setCatGuardando] = useState(false);

  // Importación state
  const [showImport, setShowImport] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const [importando, setImportando] = useState(false);
  const [importProgreso, setImportProgreso] = useState({ actual: 0, total: 0 });
  const [importResultado, setImportResultado] = useState(null);
  const fileInputRef = useRef(null);

  // Debounce búsqueda
  useEffect(() => {
    const t = setTimeout(() => setBusquedaDebounced(busqueda), 350);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Reiniciar página al cambiar búsqueda
  useEffect(() => { setPagina(1); }, [busquedaDebounced]);

  const cargar = useCallback(async (paginaActual) => {
    setLoading(true);
    try {
      const { data, count, totalPages } = await getItems({
        search: busquedaDebounced,
        page: paginaActual || pagina,
        pageSize: PAGE_SIZE,
      });
      setItems(data);
      setTotalItems(count);
      setTotalPaginas(totalPages);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, [busquedaDebounced, pagina]);

  async function cargarCategorias() {
    setCatLoading(true);
    try { setCategorias(await getCategorias()); } catch (e) { setError(e.message); }
    setCatLoading(false);
  }

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (tab === 'categorias') cargarCategorias(); }, [tab]);

  // ── Items CRUD ──────────────────────────────────────────────
  function abrirCrear() {
    setEditando(null); setForm(ITEM_VACIO); setShowForm(true); setError('');
  }
  function abrirEditar(item) {
    setEditando(item.id); setForm({ ...item }); setShowForm(true); setError('');
  }
  async function handleGuardar(e) {
    e.preventDefault();
    setGuardando(true); setError('');
    const timeout = setTimeout(() => {
      setGuardando(false);
      setError('La operación tardó demasiado. Recarga la página e intenta de nuevo.');
    }, 10000);
    try {
      if (editando) { await updateItem(editando, form); }
      else { await createItem(form); }
      clearTimeout(timeout);
      setShowForm(false);
      await cargar();
    } catch (e) { clearTimeout(timeout); setError(e.message); }
    finally { setGuardando(false); }
  }
  async function handleEliminar(id, nombre) {
    if (!window.confirm(`¿Desactivar "${nombre}"?`)) return;
    try { await deleteItem(id); await cargar(); }
    catch (e) { setError(e.message); }
  }

  // ── Categorías ─────────────────────────────────────────────
  function iniciarEditarCat(nombre) {
    setCatEditando(nombre); setCatNuevoNombre(nombre);
  }
  async function guardarRenameCat(nombreAnterior) {
    if (!catNuevoNombre.trim() || catNuevoNombre === nombreAnterior) {
      setCatEditando(null); return;
    }
    setCatGuardando(true);
    try {
      await renameCategoria(nombreAnterior, catNuevoNombre.trim());
      setCatEditando(null);
      await cargarCategorias();
      await cargar();
    } catch (e) { setError(e.message); }
    finally { setCatGuardando(false); }
  }

  // ── Importación ────────────────────────────────────────────
  async function handleArchivoSeleccionado(e) {
    const file = e.target.files[0];
    if (!file) return;
    setError('');
    setImportResultado(null);
    try {
      const preview = await parsearArchivoImportacion(file);
      setImportPreview(preview);
    } catch (err) {
      setError(err.message);
      setImportPreview(null);
    }
    e.target.value = '';
  }

  async function confirmarImportacion() {
    if (!importPreview?.length) return;
    setImportando(true);
    setImportProgreso({ actual: 0, total: importPreview.length });
    setError('');
    try {
      const resultado = await importarItems(importPreview, (actual, total) => {
        setImportProgreso({ actual, total });
      });
      setImportResultado(resultado);
      setImportPreview(null);
      await cargar();
    } catch (e) { setError(e.message); }
    finally { setImportando(false); }
  }

  function cerrarImport() {
    setShowImport(false);
    setImportPreview(null);
    setImportResultado(null);
    setImportProgreso({ actual: 0, total: 0 });
    setError('');
  }

  // La búsqueda y el filtro ocurren en el servidor; `items` ya está filtrado y paginado.

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <h1>Gestión de Inventario</h1>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={() => setShowImport(true)}>
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
              </svg>
              Importar
            </button>
            <button className="btn btn-primary" onClick={abrirCrear}>+ Nuevo Item</button>
          </div>
        </div>

        {error && <div className="error-msg">{error}</div>}

        {/* Tabs */}
        <div className="tabs">
          <button className={tab === 'items' ? 'tab active' : 'tab'} onClick={() => setTab('items')}>
            Items ({items.length})
          </button>
          <button className={tab === 'categorias' ? 'tab active' : 'tab'} onClick={() => setTab('categorias')}>
            Categorías
          </button>
        </div>

        {/* ── Tab Items ── */}
        {tab === 'items' && (
          <>
            <input
              type="text"
              className="search-input"
              placeholder="Buscar por nombre o categoría..."
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
            />

            {loading ? <div className="loading">Cargando...</div> : (
              <>
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
                    {items.length === 0 ? (
                      <tr><td colSpan={7} className="empty-row">
                        {busqueda ? `Sin resultados para "${busqueda}"` : 'No hay items. Crea uno o importa desde CSV.'}
                      </td></tr>
                    ) : items.map(item => (
                      <tr key={item.id} className={item.cantidad <= item.cantidad_minima ? 'row-alerta' : ''}>
                        <td><strong>{item.nombre}</strong></td>
                        <td>{item.categoria ? <span className="cat-pill">{item.categoria}</span> : '—'}</td>
                        <td>
                          <span className={`badge-stock ${item.cantidad <= item.cantidad_minima ? 'badge-bajo' : 'badge-ok'}`}>
                            {item.cantidad}
                          </span>
                        </td>
                        <td>{item.cantidad_minima}</td>
                        <td className="text-muted">{item.ubicacion || '—'}</td>
                        <td>
                          <button className="btn btn-xs btn-secondary" onClick={() => setQrVer(item)}>Ver QR</button>
                        </td>
                        <td>
                          <button className="btn btn-xs btn-secondary" onClick={() => abrirEditar(item)}>Editar</button>
                          <button className="btn btn-xs btn-danger" onClick={() => handleEliminar(item.id, item.nombre)}>Eliminar</button>
                        </td>
                      </tr>
                    ))}
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
          </>
        )}

        {/* ── Tab Categorías ── */}
        {tab === 'categorias' && (
          <div className="cat-admin-panel">
            <p className="cat-admin-hint">
              Renombra una categoría para actualizar todos los items que la tienen asignada.
            </p>

            {catLoading ? <div className="loading">Cargando...</div> : (
              <div className="cat-admin-list">
                {categorias.length === 0 ? (
                  <div className="empty-row">No hay categorías asignadas. Edita los items para agregar categorías.</div>
                ) : categorias.map(cat => (
                  <div key={cat.nombre} className="cat-admin-row">
                    {catEditando === cat.nombre ? (
                      <div className="cat-edit-form">
                        <input
                          className="cat-edit-input"
                          value={catNuevoNombre}
                          onChange={e => setCatNuevoNombre(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') guardarRenameCat(cat.nombre);
                            if (e.key === 'Escape') setCatEditando(null);
                          }}
                          autoFocus
                        />
                        <button className="btn btn-xs btn-primary" disabled={catGuardando} onClick={() => guardarRenameCat(cat.nombre)}>
                          {catGuardando ? '...' : 'Guardar'}
                        </button>
                        <button className="btn btn-xs btn-secondary" onClick={() => setCatEditando(null)}>Cancelar</button>
                      </div>
                    ) : (
                      <>
                        <div className="cat-admin-info">
                          <span className="cat-pill">{cat.nombre}</span>
                          <span className="cat-admin-count">{cat.total} item{cat.total !== 1 ? 's' : ''}</span>
                        </div>
                        <button className="btn btn-xs btn-secondary" onClick={() => iniciarEditarCat(cat.nombre)}>
                          Renombrar
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Modal QR ── */}
        {qrVer && (
          <div className="modal-overlay" onClick={() => setQrVer(null)}>
            <div className="modal qr-modal" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{qrVer.nombre}</h2>
                <button className="modal-close" onClick={() => setQrVer(null)}>✕</button>
              </div>
              <QRCodeSVG value={qrVer.qr_code} size={200} />
              <p className="qr-code-text">{qrVer.qr_code}</p>
              <button className="btn btn-primary" onClick={() => window.print()}>Imprimir</button>
              <button className="btn btn-secondary" onClick={() => setQrVer(null)}>Cerrar</button>
            </div>
          </div>
        )}

        {/* ── Modal Crear/Editar ── */}
        {showForm && (
          <div className="modal-overlay">
            <div className="modal form-modal">
              <div className="modal-header">
                <h2>{editando ? 'Editar Item' : 'Nuevo Item'}</h2>
                <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
              </div>
              <form onSubmit={handleGuardar}>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Nombre *</label>
                    <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Categoría</label>
                    <input
                      value={form.categoria || ''}
                      onChange={e => setForm({ ...form, categoria: e.target.value })}
                      list="categorias-list"
                      placeholder="Escribe o elige una..."
                    />
                    <datalist id="categorias-list">
                      {categorias.map(c => <option key={c.nombre} value={c.nombre} />)}
                    </datalist>
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
                    <select value={form.ubicacion || ''} onChange={e => setForm({ ...form, ubicacion: e.target.value })}>
                      <option value="">— Sin ubicación —</option>
                      <option>Oficina 1</option>
                      <option>Oficina 2</option>
                      <option>Oficina Central</option>
                      <option>Archivero</option>
                      <option>Coffee Break</option>
                      <option>Baño Eloy</option>
                      <option>Baño Hombres</option>
                      <option>Baño Mujeres</option>
                      <option>Pasillo Entrada</option>
                      <option>Casa de Harry Potter</option>
                      <option>Cueva del diablo</option>
                      <option>Cocina</option>
                    </select>
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

        {/* ── Modal Importación ── */}
        {showImport && (
          <div className="modal-overlay">
            <div className="modal import-modal">
              <div className="modal-header">
                <h2>Importar items desde archivo</h2>
                <button className="modal-close" onClick={cerrarImport}>✕</button>
              </div>

              {!importando && !importResultado && (
                <>
                  <div className="import-instructions">
                    <p>Sube un archivo <strong>.xlsx</strong> o <strong>.csv</strong> con las columnas:</p>
                    <div className="import-cols">
                      <span className="import-col required">nombre *</span>
                      <span className="import-col">categoria</span>
                      <span className="import-col">cantidad</span>
                      <span className="import-col">cantidad_minima</span>
                      <span className="import-col">ubicacion</span>
                      <span className="import-col">valor_aproximado</span>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={descargarPlantillaCSV}>
                      Descargar plantilla Excel
                    </button>
                  </div>

                  {error && <div className="error-msg">{error}</div>}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    style={{ display: 'none' }}
                    onChange={handleArchivoSeleccionado}
                  />

                  {!importPreview ? (
                    <button className="btn btn-primary import-file-btn" onClick={() => fileInputRef.current.click()}>
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
                      </svg>
                      Seleccionar archivo
                    </button>
                  ) : (
                    <>
                      <div className="import-preview-header">
                        <strong>{importPreview.length} item{importPreview.length !== 1 ? 's' : ''} detectados</strong>
                        <button className="btn btn-xs btn-secondary" onClick={() => fileInputRef.current.click()}>
                          Cambiar archivo
                        </button>
                      </div>
                      <div className="import-preview-table-wrap">
                        <table className="items-table import-preview-table">
                          <thead>
                            <tr>
                              <th>Nombre</th>
                              <th>Categoría</th>
                              <th>Cantidad</th>
                              <th>Mínimo</th>
                              <th>Ubicación</th>
                            </tr>
                          </thead>
                          <tbody>
                            {importPreview.slice(0, 10).map((item, i) => (
                              <tr key={i}>
                                <td><strong>{item.nombre}</strong></td>
                                <td>{item.categoria || '—'}</td>
                                <td>{item.cantidad}</td>
                                <td>{item.cantidad_minima}</td>
                                <td className="text-muted">{item.ubicacion || '—'}</td>
                              </tr>
                            ))}
                            {importPreview.length > 10 && (
                              <tr><td colSpan={5} className="empty-row">
                                ...y {importPreview.length - 10} más
                              </td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="modal-actions">
                        <button className="btn btn-secondary" onClick={() => setImportPreview(null)}>Cancelar</button>
                        <button className="btn btn-primary" onClick={confirmarImportacion}>
                          Importar {importPreview.length} items
                        </button>
                      </div>
                    </>
                  )}
                </>
              )}

              {importando && (
                <div className="import-progress">
                  <div className="import-progress-bar-track">
                    <div
                      className="import-progress-bar-fill"
                      style={{ width: `${Math.round((importProgreso.actual / importProgreso.total) * 100)}%` }}
                    />
                  </div>
                  <p>Importando {importProgreso.actual} de {importProgreso.total} items...</p>
                </div>
              )}

              {importResultado && (
                <div className="import-resultado">
                  <div className={`import-resultado-status ${importResultado.ok > 0 ? 'import-ok' : 'import-err'}`}>
                    {importResultado.ok > 0 && (
                      <p><strong>{importResultado.ok} item{importResultado.ok !== 1 ? 's' : ''} importados correctamente.</strong></p>
                    )}
                    {importResultado.errores.length > 0 && (
                      <p className="text-danger"><strong>{importResultado.errores.length} errores:</strong></p>
                    )}
                  </div>
                  {importResultado.errores.length > 0 && (
                    <ul className="import-errores">
                      {importResultado.errores.map((e, i) => (
                        <li key={i}>Fila {e.fila} ({e.nombre}): {e.error}</li>
                      ))}
                    </ul>
                  )}
                  <div className="modal-actions">
                    <button className="btn btn-primary" onClick={cerrarImport}>Cerrar</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
