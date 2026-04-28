import React, { useEffect, useState } from 'react';
import { getUsuarios, updateUsuario } from '../services/usuarios';
import { supabase } from '../lib/supabaseClient';
import Navbar from '../components/Navbar';

const ROLES = ['admin', 'operario', 'lectura'];

export default function AdminUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ nombre: '', email: '', password: '', rol: 'operario' });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  async function cargar() {
    setLoading(true);
    try { setUsuarios(await getUsuarios()); } catch (e) { setError(e.message); }
    setLoading(false);
  }

  useEffect(() => { cargar(); }, []);

  function validarPassword(pwd) {
    if (pwd.length < 8) return 'La contraseña debe tener al menos 8 caracteres.';
    if (!/[a-zA-Z]/.test(pwd)) return 'La contraseña debe incluir al menos una letra.';
    if (!/[0-9]/.test(pwd)) return 'La contraseña debe incluir al menos un número.';
    return null;
  }

  async function handleCrear(e) {
    e.preventDefault();
    const pwdError = validarPassword(form.password);
    if (pwdError) { setError(pwdError); return; }
    setGuardando(true);
    setError('');
    setExito('');
    try {
      const { data, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
      });
      if (authErr) throw authErr;

      // Insertar en tabla usuarios
      await supabase.from('usuarios').insert([{
        id: data.user.id,
        email: form.email,
        nombre: form.nombre,
        rol: form.rol,
      }]);

      setExito(`Usuario "${form.nombre}" creado. Recibirá un correo de confirmación.`);
      setShowForm(false);
      setForm({ nombre: '', email: '', password: '', rol: 'operario' });
      await cargar();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  async function cambiarRol(id, nuevoRol) {
    try {
      await updateUsuario(id, { rol: nuevoRol });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function toggleActivo(usuario) {
    try {
      await updateUsuario(usuario.id, { activo: !usuario.activo });
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <h1>👥 Gestión de Usuarios</h1>
          <button className="btn btn-primary" onClick={() => { setShowForm(true); setError(''); setExito(''); }}>
            + Nuevo Usuario
          </button>
        </div>

        {error && <div className="error-msg">{error}</div>}
        {exito && <div className="success-msg">{exito}</div>}

        {loading ? <div className="loading">Cargando...</div> : (
          <div className="items-table-wrapper">
            <table className="items-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.map(u => (
                  <tr key={u.id} className={!u.activo ? 'row-inactivo' : ''}>
                    <td><strong>{u.nombre}</strong></td>
                    <td>{u.email}</td>
                    <td>
                      <select
                        value={u.rol}
                        onChange={e => cambiarRol(u.id, e.target.value)}
                        className="select-rol"
                      >
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <span className={`badge-estado ${u.activo ? 'badge-activo' : 'badge-inactivo'}`}>
                        {u.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                    <td>
                      <button
                        className={`btn btn-xs ${u.activo ? 'btn-danger' : 'btn-secondary'}`}
                        onClick={() => toggleActivo(u)}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {showForm && (
          <div className="modal-overlay">
            <div className="modal form-modal">
              <div className="modal-header">
                <h2>Nuevo Usuario</h2>
                <button className="modal-close" onClick={() => setShowForm(false)}>✕</button>
              </div>
              <form onSubmit={handleCrear}>
                <div className="form-group">
                  <label>Nombre completo *</label>
                  <input required value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Email *</label>
                  <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Contraseña temporal *</label>
                  <input type="password" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Mín. 8 caracteres con letras y números" />
                </div>
                <div className="form-group">
                  <label>Rol</label>
                  <select value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })}>
                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                {error && <div className="error-msg">{error}</div>}
                <div className="modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
                  <button type="submit" className="btn btn-primary" disabled={guardando}>
                    {guardando ? 'Creando...' : 'Crear usuario'}
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
