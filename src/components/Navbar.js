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
  const [menuOpen, setMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  useEffect(() => {
    getAlertasNoLeidas().then(a => setAlertas(a.length)).catch(() => {});
    const interval = setInterval(() => {
      getAlertasNoLeidas().then(a => setAlertas(a.length)).catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  async function handleLogout() {
    try { await signOut(); } catch (e) { console.error('signOut error:', e); }
    navigate('/login');
  }

  const active = (path) => location.pathname.startsWith(path) ? 'nav-link active' : 'nav-link';

  // Iniciales del usuario para avatar
  const initials = perfil?.nombre
    ? perfil.nombre.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-brand-icon">I</div>
        <span className="navbar-brand-text">Inventario</span>
      </div>

      <div className={`navbar-links${menuOpen ? ' open' : ''}`}>
        <Link className={active('/dashboard')} to="/dashboard">Inicio</Link>
        <Link className={active('/escanear')} to="/escanear">Escanear</Link>
        <Link className={active('/reportes')} to="/reportes">Reportes</Link>
        {isAdmin && (
          <>
            <Link className={active('/admin/inventario')} to="/admin/inventario">Inventario</Link>
            <Link className={active('/admin/usuarios')} to="/admin/usuarios">Usuarios</Link>
          </>
        )}
      </div>

      <div className="navbar-right">
        {alertas > 0 && (
          <Link to="/reportes" className="badge-alertas">🔔</Link>
        )}
        <div
          className="navbar-user"
          onClick={() => setShowUserMenu(!showUserMenu)}
          title={perfil?.nombre || 'Usuario'}
        >
          {initials}
        </div>

        {/* User dropdown */}
        {showUserMenu && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 98 }}
              onClick={() => setShowUserMenu(false)}
            />
            <div style={{
              position: 'absolute', top: 52, right: 20,
              background: '#fff', borderRadius: 16, padding: 6,
              boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.06)',
              zIndex: 99, minWidth: 180,
            }}>
              <div style={{
                padding: '10px 12px', fontSize: 14, fontWeight: 600,
                color: '#0f172a', borderBottom: '1px solid #f1f5f9',
              }}>
                {perfil?.nombre || 'Usuario'}
              </div>
              <div style={{
                padding: '6px 12px', fontSize: 12, color: '#94a3b8',
                borderBottom: '1px solid #f1f5f9',
              }}>
                {perfil?.email || ''}
              </div>
              <button
                onClick={handleLogout}
                style={{
                  width: '100%', padding: '10px 12px', borderRadius: 10,
                  border: 'none', background: 'none', fontSize: 14,
                  fontWeight: 500, color: '#dc2626', textAlign: 'left',
                  cursor: 'pointer', fontFamily: 'inherit', marginTop: 4,
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.target.style.background = 'rgba(220,38,38,0.06)'}
                onMouseLeave={e => e.target.style.background = 'none'}
              >
                Cerrar sesión
              </button>
            </div>
          </>
        )}

        <button
          className="navbar-hamburger"
          onClick={() => setMenuOpen(o => !o)}
          aria-label="Menú"
        >
          {menuOpen ? '✕' : '☰'}
        </button>
      </div>
    </nav>
  );
}
