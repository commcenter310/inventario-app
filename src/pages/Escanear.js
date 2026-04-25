import React, { useEffect, useRef, useState } from 'react';
import QrScanner from 'qr-scanner';
import { getItemByQR, adjustStock } from '../services/items';
import { useAuth } from '../context/AuthContext';
import FirmaDigital from '../components/FirmaDigital';
import Navbar from '../components/Navbar';

const ESTADOS = { SCANNING: 'scanning', FOUND: 'found', FIRMA: 'firma', SUCCESS: 'success', ERROR: 'error' };

async function buscarItem(valor) {
  // Soporta QR con URL completa (nuevo formato) o código directo (formato viejo)
  let codigo = valor;
  try {
    const url = new URL(valor);
    const qrParam = url.searchParams.get('qr');
    if (qrParam) codigo = qrParam;
    else codigo = url.pathname + url.search; // fallback
  } catch {}
  return getItemByQR(codigo);
}

export default function Escanear() {
  const { session } = useAuth();
  const videoRef = useRef(null);
  const scannerRef = useRef(null);

  const [estado, setEstado] = useState(ESTADOS.SCANNING);
  const [item, setItem] = useState(null);
  const [cantidad, setCantidad] = useState(1);
  const [tipo, setTipo] = useState('salida');
  const [notas, setNotas] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [cameraError, setCameraError] = useState('');

  // Si la página se abrió con ?qr=... (desde cámara nativa del celular), cargar item directo
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qrParam = params.get('qr');
    if (qrParam) {
      getItemByQR(qrParam)
        .then(found => { setItem(found); setEstado(ESTADOS.FOUND); })
        .catch(() => { setMensaje(`QR no reconocido: ${qrParam}`); setEstado(ESTADOS.ERROR); });
    }
  }, []);

  useEffect(() => {
    if (estado !== ESTADOS.SCANNING) return;

    const scanner = new QrScanner(
      videoRef.current,
      async (result) => {
        scanner.stop();
        try {
          const found = await buscarItem(result.data);
          setItem(found);
          setEstado(ESTADOS.FOUND);
        } catch {
          setMensaje(`QR no reconocido: ${result.data}`);
          setEstado(ESTADOS.ERROR);
        }
      },
      {
        preferredCamera: 'environment',
        highlightScanRegion: true,
        highlightCodeOutline: true,
      }
    );

    scannerRef.current = scanner;
    scanner.start().catch(err => {
      setCameraError('No se pudo acceder a la cámara. Verifica los permisos.');
      console.error(err);
    });

    return () => scanner.stop();
  }, [estado]);

  function reiniciar() {
    setItem(null);
    setCantidad(1);
    setTipo('salida');
    setNotas('');
    setMensaje('');
    setEstado(ESTADOS.SCANNING);
  }

  async function handleFirmaConfirmada(firmaBase64) {
    try {
      const result = await adjustStock(
        item.id, cantidad, tipo, firmaBase64, notas, session.user.id
      );
      setMensaje(`✅ Listo. Nuevo stock de "${item.nombre}": ${result.nuevaCantidad} unidades.`);
      setEstado(ESTADOS.SUCCESS);
    } catch (err) {
      setMensaje(`Error: ${err.message}`);
      setEstado(ESTADOS.ERROR);
    }
  }

  return (
    <div className="app-layout">
      <Navbar />
      <main className="main-content escanear-page">
        <h1>📷 Escanear QR</h1>

        {estado === ESTADOS.SCANNING && (
          <div className="scanner-wrapper">
            {cameraError ? (
              <div className="error-msg">{cameraError}</div>
            ) : (
              <video ref={videoRef} className="scanner-video" />
            )}
            <p className="scanner-hint">Apunta la cámara al código QR del item</p>
          </div>
        )}

        {estado === ESTADOS.FOUND && item && (
          <div className="item-found-card">
            <h2>✅ Item encontrado</h2>
            <div className="item-info">
              <p><strong>Nombre:</strong> {item.nombre}</p>
              <p><strong>Categoría:</strong> {item.categoria || '—'}</p>
              <p><strong>Stock actual:</strong> <span className="badge-stock badge-ok">{item.cantidad}</span></p>
              <p><strong>Ubicación:</strong> {item.ubicacion || '—'}</p>
            </div>
            <div className="form-group">
              <label>Tipo de movimiento</label>
              <div className="tipo-toggle">
                <button
                  className={`btn ${tipo === 'salida' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTipo('salida')}
                >📤 Salida</button>
                <button
                  className={`btn ${tipo === 'entrada' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setTipo('entrada')}
                >📥 Entrada</button>
              </div>
            </div>
            <div className="form-group cantidad-control">
              <label>Cantidad</label>
              <div className="cantidad-row">
                <button className="btn btn-secondary" onClick={() => setCantidad(c => Math.max(1, c - 1))}>−</button>
                <input
                  type="number"
                  min="1"
                  value={cantidad}
                  onChange={e => setCantidad(Math.max(1, parseInt(e.target.value) || 1))}
                />
                <button className="btn btn-secondary" onClick={() => setCantidad(c => c + 1)}>+</button>
              </div>
            </div>
            <div className="form-group">
              <label>Notas (opcional)</label>
              <input
                type="text"
                placeholder="Ej: para reunión de directivos"
                value={notas}
                onChange={e => setNotas(e.target.value)}
              />
            </div>
            <div className="found-actions">
              <button className="btn btn-danger" onClick={reiniciar}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => setEstado(ESTADOS.FIRMA)}>
                Continuar → Firmar
              </button>
            </div>
          </div>
        )}

        {estado === ESTADOS.FIRMA && (
          <FirmaDigital
            onConfirmar={handleFirmaConfirmada}
            onCancelar={() => setEstado(ESTADOS.FOUND)}
          />
        )}

        {(estado === ESTADOS.SUCCESS || estado === ESTADOS.ERROR) && (
          <div className={`result-card ${estado === ESTADOS.SUCCESS ? 'result-ok' : 'result-error'}`}>
            <p>{mensaje}</p>
            <button className="btn btn-primary" onClick={reiniciar}>
              Escanear otro
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
