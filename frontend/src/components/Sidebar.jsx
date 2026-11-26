import { NavLink } from 'react-router-dom';
import { FiGrid, FiUsers, FiLayers, FiBookOpen, FiCalendar, FiLogOut, FiUpload } from 'react-icons/fi';
import Logo from './Logo.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

const ITENS_MENU = [
  { para: '/', rotulo: 'Dashboard', icone: FiGrid, fim: true },
  { para: '/professores', rotulo: 'Professores', icone: FiUsers },
  { para: '/turmas', rotulo: 'Turmas', icone: FiLayers },
  { para: '/disciplinas', rotulo: 'Disciplinas', icone: FiBookOpen },
  { para: '/importar', rotulo: 'Importar (IA)', icone: FiUpload },
  { para: '/horarios', rotulo: 'Horários', icone: FiCalendar },
];

export default function Sidebar({ aberta, aoNavegar }) {
  const { usuario, sair } = useAuth();
  const inicial = (usuario?.nome || 'A').charAt(0).toUpperCase();

  return (
    <aside className={`sidebar ${aberta ? 'sidebar-aberta' : ''}`}>
      <div className="sidebar-logo">
        <Logo tamanho="menu" />
      </div>

      <nav className="sidebar-menu">
        <span className="sidebar-titulo">Menu</span>
        {ITENS_MENU.map(({ para, rotulo, icone: Icone, fim }) => (
          <NavLink
            key={para}
            to={para}
            end={fim}
            onClick={aoNavegar}
            className={({ isActive }) => `sidebar-link ${isActive ? 'ativo' : ''}`}
          >
            <Icone size={19} />
            <span>{rotulo}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-rodape">
        <div className="sidebar-usuario">
          <div className="avatar">{inicial}</div>
          <div className="sidebar-usuario-info">
            <strong>{usuario?.nome}</strong>
            <small>Administrador</small>
          </div>
        </div>
        <button type="button" className="sidebar-sair" onClick={sair} title="Sair">
          <FiLogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
