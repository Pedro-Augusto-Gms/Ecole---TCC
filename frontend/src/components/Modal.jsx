import { useEffect } from 'react';
import { FiX } from 'react-icons/fi';

export default function Modal({ titulo, aoFechar, largura = 'media', children }) {
  useEffect(() => {
    const aoApertarTecla = (evento) => evento.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', aoApertarTecla);
    return () => document.removeEventListener('keydown', aoApertarTecla);
  }, [aoFechar]);

  return (
    <div className="modal-fundo" onMouseDown={aoFechar}>
      <div className={`modal modal-${largura}`} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-cabecalho">
          <h2>{titulo}</h2>
          <button type="button" className="botao-icone" onClick={aoFechar} aria-label="Fechar">
            <FiX size={20} />
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
      </div>
    </div>
  );
}
