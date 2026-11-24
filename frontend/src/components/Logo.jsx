import { useState } from 'react';

// Mostra a logo do ÉCOLE. A imagem é carregada de /logo-ecole.png (pasta frontend/public),
// sem nenhuma alteração. Se o arquivo ainda não existir, mostra apenas o nome em texto.
export default function Logo({ tamanho = 'media' }) {
  const [semImagem, setSemImagem] = useState(false);

  if (semImagem) {
    return <span className={`logo-texto logo-${tamanho}`}>ÉCOLE</span>;
  }

  return (
    <img
      src="/logo-ecole.png"
      alt="ÉCOLE"
      className={`logo-imagem logo-${tamanho}`}
      onError={() => setSemImagem(true)}
    />
  );
}
