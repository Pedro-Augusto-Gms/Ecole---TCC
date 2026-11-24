import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { FiMenu } from 'react-icons/fi';
import Sidebar from './Sidebar.jsx';
import Logo from './Logo.jsx';

export default function Layout() {
  const [menuAberto, setMenuAberto] = useState(false);

  return (
    <div className="layout">
      <Sidebar aberta={menuAberto} aoNavegar={() => setMenuAberto(false)} />
      {menuAberto && <div className="layout-fundo" onClick={() => setMenuAberto(false)} />}

      <div className="layout-conteudo">
        <header className="topbar-mobile">
          <button type="button" className="botao-icone" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <FiMenu size={22} />
          </button>
          <Logo tamanho="menu" />
        </header>

        <main className="pagina">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
