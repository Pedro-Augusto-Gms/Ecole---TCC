import { useEffect, useState } from 'react';
import { FiZap, FiTrash2, FiAlertTriangle, FiCalendar, FiCheckCircle } from 'react-icons/fi';
import PageHeader from '../components/PageHeader.jsx';
import QuadroHorario from '../components/QuadroHorario.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import api, { mensagemErro } from '../services/api.js';

export default function Horarios() {
  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [horarios, setHorarios] = useState([]);
  const [pendencias, setPendencias] = useState([]);
  const [gerou, setGerou] = useState(false);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/turmas')
      .then(({ data }) => setTurmas(data))
      .catch((e) => setErro(mensagemErro(e)));
  }, []);

  // Sempre que troca a turma, carrega o horário que já estiver salvo para ela.
  useEffect(() => {
    setPendencias([]);
    setGerou(false);
    setHorarios([]);
    if (!turmaId) return;

    api
      .get(`/horarios/turma/${turmaId}`)
      .then(({ data }) => setHorarios(data))
      .catch((e) => setErro(mensagemErro(e)));
  }, [turmaId]);

  async function gerar() {
    setErro('');
    if (!turmaId) return setErro('Selecione uma turma.');

    setGerando(true);
    try {
      const { data } = await api.post('/horarios/gerar', { turma_id: Number(turmaId) });
      setHorarios(data.horarios);
      setPendencias(data.pendencias);
      setGerou(true);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setGerando(false);
    }
  }

  async function limpar() {
    if (!window.confirm('Remover o horário desta turma?')) return;
    try {
      await api.delete(`/horarios/turma/${turmaId}`);
      setHorarios([]);
      setPendencias([]);
      setGerou(false);
    } catch (e) {
      setErro(mensagemErro(e));
    }
  }

  const turmaSelecionada = turmas.find((t) => String(t.id) === String(turmaId));
  const aulasPrevistas = turmaSelecionada ? turmaSelecionada.disciplinas.reduce((soma, d) => soma + d.aulas_semanais, 0) : 0;

  return (
    <>
      <PageHeader titulo="Geração de horários" subtitulo="Escolha a turma, defina os parâmetros e gere a grade semanal." />

      {erro && <div className="alerta alerta-erro">{erro}</div>}

      <div className="cartao">
        <div className="parametros">
          <label className="campo">
            <span>Turma</span>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">Selecione uma turma...</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome} — {turma.turno}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span>Aulas por dia</span>
            <input type="text" value={turmaSelecionada ? `${turmaSelecionada.aulas_por_dia} aulas` : '—'} disabled />
          </label>

          <div className="parametros-acoes">
            <button type="button" className="botao botao-primario" onClick={gerar} disabled={gerando || !turmaId}>
              <FiZap size={18} /> {gerando ? 'Gerando...' : 'Gerar horários'}
            </button>
            {horarios.length > 0 && (
              <button type="button" className="botao botao-secundario" onClick={limpar}>
                <FiTrash2 size={17} /> Limpar
              </button>
            )}
          </div>
        </div>

        {turmaSelecionada && (
          <p className="texto-suave parametros-resumo">
            {turmaSelecionada.turno} · {turmaSelecionada.disciplinas.length} disciplina(s) · {aulasPrevistas} aulas previstas
            por semana · {turmaSelecionada.aulas_por_dia * 5} horários disponíveis · {horarios.length} aula(s) alocada(s)
          </p>
        )}
      </div>

      {gerou && pendencias.length === 0 && (
        <div className="alerta alerta-sucesso">
          <FiCheckCircle size={18} />
          <span>Horário gerado com sucesso: todas as aulas foram alocadas sem conflitos.</span>
        </div>
      )}

      {pendencias.length > 0 && (
        <div className="alerta alerta-aviso">
          <FiAlertTriangle size={18} />
          <div>
            <strong>Algumas aulas não puderam ser alocadas:</strong>
            <ul>
              {pendencias.map((pendencia) => (
                <li key={pendencia.disciplina}>
                  {pendencia.disciplina} — faltaram {pendencia.aulas_faltando} aula(s). {pendencia.motivo}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="cartao">
        <h2 className="cartao-titulo">Quadro semanal{turmaSelecionada ? ` · ${turmaSelecionada.nome}` : ''}</h2>
        {!turmaId ? (
          <EstadoVazio icone={FiCalendar} titulo="Selecione uma turma" texto="O horário da turma escolhida será exibido aqui." />
        ) : horarios.length === 0 ? (
          <EstadoVazio
            icone={FiCalendar}
            titulo="Esta turma ainda não tem horário"
            texto="Clique em “Gerar horários”. Antes, confirme que a turma tem disciplinas e que os professores têm disponibilidade marcada."
          />
        ) : (
          <QuadroHorario horarios={horarios} periodosPorDia={turmaSelecionada?.aulas_por_dia || 8} />
        )}
      </div>
    </>
  );
}
