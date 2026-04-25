import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { signOut } from '../lib/auth';
import { getAlertasNoLeidas } from '../services/alertas';

export default function Navbar() {
  const { perfil, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [alertas, setAlertas] = useState(0);

  useEffect(() => {
    getAlertasNoLeidas().then(a => setAlertas(a.length)).catch(() => {});
    const interval = setInterval(() => {
      getAlertasNoLeidas().then(a => setAlertas(a.length)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  const active = (path) => location.pathname.startsWith(path) ? 'nav-link active' : 'nav-link';

  return (
    <nav className="navbar">
      <div className="navbar-brand">📦 Inventario</div>
      <div className="navbar-links">
        <Link className={active('/dashboard')} to="/dashboard">Inicio</Link>
        <Link className={active('/escanear')} to="/escanear">📷 Escanear</Link>
        <Link className={active('/reportes')} to="/reportes">📊 Reportes</Link>
        {isAdmin && (
          <>
            <Link className={active('/admin/inventario')} to="/admin/inventario">📋 Inventario</Link>
            <Link className={active('/admin/usuarios')} to="/admin/usuarios">👥 Usuarios</Link>
          </>
        )}
      </div>
      <div className="navbar-right">
        {alertas > 0 && (
          <Link to="/reportes" className="badge-alertas">🔔 {alertas}</Link>
        )}
        <span className="navbar-user">{perfil?.nombre || 'Usuario'}</span>
        <button className="btn-logout" onClick={handleLogout}>Salir</button>
      </div>
    </nav>
  );
}
