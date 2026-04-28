import React from 'react';

export default function Paginacion({ pagina, totalPaginas, total, pageSize, onCambiar }) {
  if (totalPaginas <= 1) return null;

  const desde = (pagina - 1) * pageSize + 1;
  const hasta = Math.min(pagina * pageSize, total);

  // Genera la lista de botones de página con ellipsis si hay muchas
  function paginas() {
    const delta = 1; // páginas a cada lado de la actual
    const rango = [];
    for (let i = Math.max(2, pagina - delta); i <= Math.min(totalPaginas - 1, pagina + delta); i++) {
      rango.push(i);
    }
    const conEllipsis = [];
    if (rango[0] > 2) conEllipsis.push('...');
    conEllipsis.push(...rango);
    if (rango[rango.length - 1] < totalPaginas - 1) conEllipsis.push('...');
    return [1, ...conEllipsis, totalPaginas];
  }

  return (
    <div className="paginacion">
      <span className="paginacion-info">
        {desde}–{hasta} de {total}
      </span>

      <div className="paginacion-controles">
        <button
          className="pag-btn"
          disabled={pagina === 1}
          onClick={() => onCambiar(pagina - 1)}
          aria-label="Página anterior"
        >
          ←
        </button>

        {paginas().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="pag-ellipsis">…</span>
          ) : (
            <button
              key={p}
              className={`pag-btn ${p === pagina ? 'pag-btn-active' : ''}`}
              onClick={() => onCambiar(p)}
            >
              {p}
            </button>
          )
        )}

        <button
          className="pag-btn"
          disabled={pagina === totalPaginas}
          onClick={() => onCambiar(pagina + 1)}
          aria-label="Página siguiente"
        >
          →
        </button>
      </div>
    </div>
  );
}
