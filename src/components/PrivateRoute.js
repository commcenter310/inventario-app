import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function PrivateRoute({ children, rolesPermitidos }) {
  const { session, perfil, loading } = useAuth();

  if (loading) return <div className="loading-screen">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (rolesPermitidos && perfil && !rolesPermitidos.includes(perfil.rol)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
