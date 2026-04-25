import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import PrivateRoute from './components/PrivateRoute';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Escanear from './pages/Escanear';
import AdminInventario from './pages/AdminInventario';
import AdminUsuarios from './pages/AdminUsuarios';
import Reportes from './pages/Reportes';

import './styles.css';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route path="/dashboard" element={
            <PrivateRoute><Dashboard /></PrivateRoute>
          } />

          <Route path="/escanear" element={
            <PrivateRoute rolesPermitidos={['admin', 'operario']}><Escanear /></PrivateRoute>
          } />

          <Route path="/reportes" element={
            <PrivateRoute><Reportes /></PrivateRoute>
          } />

          <Route path="/admin/inventario" element={
            <PrivateRoute rolesPermitidos={['admin']}><AdminInventario /></PrivateRoute>
          } />

          <Route path="/admin/usuarios" element={
            <PrivateRoute rolesPermitidos={['admin']}><AdminUsuarios /></PrivateRoute>
          } />

          {/* Redirección raíz */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
