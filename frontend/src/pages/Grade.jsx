import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FiCalendar, FiLogIn } from 'react-icons/fi';
import Logo from '../components/Logo.jsx';
import QuadroHorario from '../components/QuadroHorario.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import api, { mensagemErro } from '../services/api.js';

// Página PÚBLICA para os alunos: só mostra as grades que a gestão já publicou. Não pede login.
export default function Grade() {
  const [parametros, setParametros] = useSearchParams();
  const turmaId = parametros.get('turma') || '';
  const [turmas, setTurmas] = useState(null);
  const [grade, setGrade] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/publico/turmas')
      .then(({ data }) => {
        setTurmas(data);
        if (!turmaId && data.length > 0) setParametros({ turma: data[0].id }, { replace: true });
      })
      .catch((e) => setErro(mensagemErro(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setGrade(null);
    if (!turmaId) return;
    api
      .get(`/publico/grade/${turmaId}`)
      .then(({ data }) => setGrade(data))
      .catch((e) => setErro(mensagemErro(e)));
  }, [turmaId]);

  return (
    <div className="publico">
      <header className="publico-topo">
        <Logo tamanho="menu" />
        <Link to="/login" className="botao botao-secundario">
          <FiLogIn size={16} /> Área da gestão
        </Link>
      </header>

      <main className="publico-conteudo">
        <h1>Grade de horários</h1>
        <p className="texto-suave">Escolha a sua turma para ver as aulas da semana.</p>

        {erro && <div className="alerta alerta-erro">{erro}</div>}

        {turmas && turmas.length === 0 && (
          <div className="cartao">
            <EstadoVazio icone={FiCalendar} titulo="Nenhuma grade publicada ainda" texto="Volte mais tarde: a gestão ainda não publicou os horários." />
          </div>
        )}

        {turmas && turmas.length > 0 && (
          <div className="cartao">
            <label className="campo publico-seletor">
              <span>Turma</span>
              <select value={turmaId} onChange={(e) => setParametros({ turma: e.target.value })}>
                {turmas.map((turma) => (
                  <option key={turma.id} value={turma.id}>
                    {turma.nome} — {turma.turno}
                  </option>
                ))}
              </select>
            </label>

            {grade ? (
              grade.horarios.length > 0 ? (
                <QuadroHorario horarios={grade.horarios} estrutura={grade.estrutura} />
              ) : (
                <p className="texto-suave">Esta turma ainda não tem grade publicada.</p>
              )
            ) : (
              <p className="texto-suave">Carregando...</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
