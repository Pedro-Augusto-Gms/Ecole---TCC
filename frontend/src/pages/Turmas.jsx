import { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiLayers } from 'react-icons/fi';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import api, { mensagemErro } from '../services/api.js';
import { TURNOS, MAX_PERIODOS } from '../utils/constantes.js';

const FORMULARIO_VAZIO = { nome: '', turno: 'Integral', aulas_por_dia: 8, disciplinas: [] };

export default function Turmas() {
  const [turmas, setTurmas] = useState([]);
  const [disciplinasDisponiveis, setDisciplinasDisponiveis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState('');
  const [busca, setBusca] = useState('');

  const [modalFormulario, setModalFormulario] = useState(false);
  const [turmaVisualizada, setTurmaVisualizada] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [erroFormulario, setErroFormulario] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      const [respostaTurmas, respostaDisciplinas] = await Promise.all([api.get('/turmas'), api.get('/disciplinas')]);
      setTurmas(respostaTurmas.data);
      setDisciplinasDisponiveis(respostaDisciplinas.data);
    } catch (e) {
      setErroGeral(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    carregar();
  }, []);

  function abrirNovo() {
    setEditandoId(null);
    setFormulario(FORMULARIO_VAZIO);
    setErroFormulario('');
    setModalFormulario(true);
  }

  function abrirEdicao(turma) {
    setEditandoId(turma.id);
    setFormulario({
      nome: turma.nome,
      turno: turma.turno,
      aulas_por_dia: turma.aulas_por_dia,
      disciplinas: turma.disciplinas.map((d) => d.id),
    });
    setErroFormulario('');
    setModalFormulario(true);
  }

  function alternarDisciplina(id) {
    const selecionadas = formulario.disciplinas.includes(id)
      ? formulario.disciplinas.filter((d) => d !== id)
      : [...formulario.disciplinas, id];
    setFormulario({ ...formulario, disciplinas: selecionadas });
  }

  async function salvar(evento) {
    evento.preventDefault();
    setErroFormulario('');

    if (formulario.nome.trim().length < 2) return setErroFormulario('Informe o nome da turma.');

    setSalvando(true);
    try {
      const dados = { ...formulario, nome: formulario.nome.trim(), aulas_por_dia: Number(formulario.aulas_por_dia) };
      if (editandoId) await api.put(`/turmas/${editandoId}`, dados);
      else await api.post('/turmas', dados);
      setModalFormulario(false);
      await carregar();
    } catch (e) {
      setErroFormulario(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(turma) {
    if (!window.confirm(`Excluir a turma "${turma.nome}"? O horário gerado para ela também será removido.`)) return;
    try {
      await api.delete(`/turmas/${turma.id}`);
      await carregar();
    } catch (e) {
      setErroGeral(mensagemErro(e));
    }
  }

  const totalAulas = (turma) => turma.disciplinas.reduce((soma, d) => soma + d.aulas_semanais, 0);
  const aulasSelecionadas = disciplinasDisponiveis
    .filter((d) => formulario.disciplinas.includes(d.id))
    .reduce((soma, d) => soma + d.aulas_semanais, 0);
  const filtradas = turmas.filter((t) => t.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <>
      <PageHeader titulo="Turmas" subtitulo="Administre as turmas e defina quais disciplinas cada uma cursa.">
        <button type="button" className="botao botao-primario" onClick={abrirNovo}>
          <FiPlus size={18} /> Nova turma
        </button>
      </PageHeader>

      {erroGeral && <div className="alerta alerta-erro">{erroGeral}</div>}

      <div className="cartao">
        <div className="barra-ferramentas">
          <input type="search" className="input-busca" placeholder="Buscar turma..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <span className="contador">{filtradas.length} registro(s)</span>
        </div>

        {carregando ? (
          <p className="texto-suave">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <EstadoVazio icone={FiLayers} titulo="Nenhuma turma encontrada" texto="Cadastre a primeira turma para começar.">
            <button type="button" className="botao botao-primario" onClick={abrirNovo}>
              <FiPlus size={18} /> Nova turma
            </button>
          </EstadoVazio>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Turma</th>
                  <th>Turno</th>
                  <th>Aulas/dia</th>
                  <th>Disciplinas</th>
                  <th>Aulas/semana</th>
                  <th className="coluna-acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((turma) => (
                  <tr key={turma.id}>
                    <td>
                      <strong>{turma.nome}</strong>
                    </td>
                    <td>{turma.turno}</td>
                    <td>{turma.aulas_por_dia}</td>
                    <td>{turma.disciplinas.length}</td>
                    <td>{totalAulas(turma)}</td>
                    <td className="coluna-acoes">
                      <button type="button" className="botao-icone" title="Visualizar" onClick={() => setTurmaVisualizada(turma)}>
                        <FiEye size={17} />
                      </button>
                      <button type="button" className="botao-icone" title="Editar" onClick={() => abrirEdicao(turma)}>
                        <FiEdit2 size={17} />
                      </button>
                      <button type="button" className="botao-icone perigo" title="Excluir" onClick={() => excluir(turma)}>
                        <FiTrash2 size={17} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalFormulario && (
        <Modal titulo={editandoId ? 'Editar turma' : 'Nova turma'} aoFechar={() => setModalFormulario(false)}>
          <form onSubmit={salvar} noValidate>
            {erroFormulario && <div className="alerta alerta-erro">{erroFormulario}</div>}

            <div className="linha-campos">
              <label className="campo">
                <span>Nome da turma</span>
                <input
                  type="text"
                  value={formulario.nome}
                  onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
                  placeholder="Ex.: 1º Ano A"
                  autoFocus
                />
              </label>
              <label className="campo">
                <span>Turno</span>
                <select value={formulario.turno} onChange={(e) => setFormulario({ ...formulario, turno: e.target.value })}>
                  {TURNOS.map((turno) => (
                    <option key={turno}>{turno}</option>
                  ))}
                </select>
              </label>
              <label className="campo">
                <span>Aulas por dia</span>
                <select
                  value={formulario.aulas_por_dia}
                  onChange={(e) => setFormulario({ ...formulario, aulas_por_dia: Number(e.target.value) })}
                >
                  {Array.from({ length: MAX_PERIODOS }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="campo">
              <span>
                Disciplinas da turma{' '}
                <small className="texto-suave">
                  ({aulasSelecionadas} aulas selecionadas · a turma tem {Number(formulario.aulas_por_dia) * 5} horários por semana)
                </small>
              </span>
              {disciplinasDisponiveis.length === 0 ? (
                <p className="texto-suave">Cadastre disciplinas primeiro para poder vinculá-las à turma.</p>
              ) : (
                <div className="lista-checkbox">
                  {disciplinasDisponiveis.map((disciplina) => (
                    <label key={disciplina.id} className={`opcao-checkbox ${formulario.disciplinas.includes(disciplina.id) ? 'marcada' : ''}`}>
                      <input
                        type="checkbox"
                        checked={formulario.disciplinas.includes(disciplina.id)}
                        onChange={() => alternarDisciplina(disciplina.id)}
                      />
                      <span>{disciplina.nome}</span>
                      <small>{disciplina.aulas_semanais}x</small>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-rodape">
              <button type="button" className="botao botao-secundario" onClick={() => setModalFormulario(false)}>
                Cancelar
              </button>
              <button type="submit" className="botao botao-primario" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {turmaVisualizada && (
        <Modal titulo={turmaVisualizada.nome} aoFechar={() => setTurmaVisualizada(null)} largura="pequena">
          <dl className="detalhes">
            <dt>Turno</dt>
            <dd>{turmaVisualizada.turno}</dd>
            <dt>Aulas por dia</dt>
            <dd>{turmaVisualizada.aulas_por_dia}</dd>
            <dt>Aulas por semana</dt>
            <dd>{totalAulas(turmaVisualizada)}</dd>
            <dt>Disciplinas</dt>
            <dd>
              {turmaVisualizada.disciplinas.length === 0 ? (
                <span className="texto-suave">Nenhuma disciplina vinculada.</span>
              ) : (
                <div className="chips">
                  {turmaVisualizada.disciplinas.map((d) => (
                    <span className="chip" key={d.id}>
                      {d.nome} · {d.aulas_semanais}x
                    </span>
                  ))}
                </div>
              )}
            </dd>
          </dl>
        </Modal>
      )}
    </>
  );
}
