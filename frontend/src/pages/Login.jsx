import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { FiUser, FiLock, FiAlertCircle, FiCalendar, FiShield, FiZap } from 'react-icons/fi';
import Logo from '../components/Logo.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { mensagemErro } from '../services/api.js';

export default function Login() {
  const { autenticado, entrar } = useAuth();
  const navegar = useNavigate();
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);

  if (autenticado) return <Navigate to="/" replace />;

  async function aoEnviar(evento) {
    evento.preventDefault();
    setErro('');

    if (!identificador.trim() || !senha) {
      setErro('Preencha o usuário (ou e-mail) e a senha.');
      return;
    }

    setCarregando(true);
    try {
      await entrar(identificador.trim(), senha);
      navegar('/', { replace: true });
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="login">
      <section className="login-destaque">
        <div className="login-destaque-conteudo">
          <span className="login-selo">Gestão de horários · ETEC</span>
          <h2>Horários escolares sem conflitos, em poucos cliques.</h2>
          <p>
            Cadastre professores, turmas e disciplinas e deixe o ÉCOLE organizar a grade semanal respeitando a
            disponibilidade de cada professor.
          </p>

          <ul className="login-beneficios">
            <li>
              <FiCalendar size={20} />
              <span>Grade semanal organizada por turma</span>
            </li>
            <li>
              <FiShield size={20} />
              <span>Prevenção de conflitos entre professores</span>
            </li>
            <li>
              <FiZap size={20} />
              <span>Menos trabalho manual para a coordenação</span>
            </li>
          </ul>
        </div>
        <div className="login-circulo login-circulo-a" />
        <div className="login-circulo login-circulo-b" />
      </section>

      <section className="login-formulario-area">
        <form className="login-card" onSubmit={aoEnviar} noValidate>
          <div className="login-logo">
            <Logo tamanho="login" />
          </div>

          <h1>Bem-vindo(a) de volta</h1>
          <p className="login-subtitulo">Acesse o painel administrativo para continuar.</p>

          {erro && (
            <div className="alerta alerta-erro" role="alert">
              <FiAlertCircle size={18} />
              <span>{erro}</span>
            </div>
          )}

          <label className="campo">
            <span>Usuário ou e-mail</span>
            <div className="campo-com-icone">
              <FiUser size={18} />
              <input
                type="text"
                value={identificador}
                onChange={(e) => setIdentificador(e.target.value)}
                placeholder="seu.usuario"
                autoComplete="username"
                autoFocus
              />
            </div>
          </label>

          <label className="campo">
            <span>Senha</span>
            <div className="campo-com-icone">
              <FiLock size={18} />
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
              />
            </div>
          </label>

          <button type="submit" className="botao botao-primario botao-bloco" disabled={carregando}>
            {carregando ? 'Entrando...' : 'Entrar'}
          </button>

          <small className="login-rodape">ÉCOLE · Sistema de geração de horários escolares</small>
        </form>
      </section>
    </div>
  );
}
