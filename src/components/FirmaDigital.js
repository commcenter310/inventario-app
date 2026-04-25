import React, { useRef } from 'react';
import SignatureCanvas from 'react-signature-canvas';

export default function FirmaDigital({ onConfirmar, onCancelar }) {
  const sigRef = useRef(null);

  function limpiar() {
    sigRef.current.clear();
  }

  function confirmar() {
    if (sigRef.current.isEmpty()) {
      alert('Por favor, dibuja tu firma antes de confirmar.');
      return;
    }
    const firmaBase64 = sigRef.current.toDataURL('image/png');
    onConfirmar(firmaBase64);
  }

  return (
    <div className="modal-overlay">
      <div className="modal firma-modal">
        <h2>✍️ Firma Digital</h2>
        <p>Dibuja tu firma en el recuadro para confirmar el movimiento</p>
        <div className="firma-canvas-wrapper">
          <SignatureCanvas
            ref={sigRef}
            penColor="#1a1a2e"
            canvasProps={{ width: 340, height: 180, className: 'firma-canvas' }}
          />
        </div>
        <div className="firma-actions">
          <button className="btn btn-secondary" onClick={limpiar}>🗑 Limpiar</button>
          <button className="btn btn-danger" onClick={onCancelar}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmar}>✅ Confirmar</button>
        </div>
      </div>
    </div>
  );
}
