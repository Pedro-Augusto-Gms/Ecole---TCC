import { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiEye, FiUsers } from 'react-icons/fi';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import GradeDisponibilidade from '../components/GradeDisponibilidade.jsx';
import api, { mensagemErro } from '../services/api.js';

const FORMULARIO_VAZIO = { nome: '', pontuacao: '', disciplinas: [], disponibilidade: [], informacoes_adicionais: '' };

export default function Professores() {
  const [professores, setProfessores] = useState([]);
  const [disciplinasDisponiveis, setDisciplinasDisponiveis] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState('');
  const [busca, setBusca] = useState('');

  const [modalFormulario, setModalFormulario] = useState(false);
  const [professorVisualizado, setProfessorVisualizado] = useState(null);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [erroFormulario, setErroFormulario] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      const [respostaProfessores, respostaDisciplinas] = await Promise.all([
        api.get('/professores'),
        api.get('/disciplinas'),
      ]);
      setProfessores(respostaProfessores.data);
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

  function abrirEdicao(professor) {
    setEditandoId(professor.id);
    setFormulario({
      nome: professor.nome,
      pontuacao: professor.pontuacao ?? '',
      disciplinas: professor.disciplinas.map((d) => d.id),
      disponibilidade: professor.disponibilidade,
      informacoes_adicionais: professor.informacoes_adicionais || '',
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

    if (formulario.nome.trim().length < 3) return setErroFormulario('Informe o nome completo do professor.');

    setSalvando(true);
    try {
      const dados = { ...formulario, nome: formulario.nome.trim() };
      if (editandoId) await api.put(`/professores/${editandoId}`, dados);
      else await api.post('/professores', dados);
      setModalFormulario(false);
      await carregar();
    } catch (e) {
      setErroFormulario(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(professor) {
    if (!window.confirm(`Excluir o professor "${professor.nome}"? Os horários gerados com ele também serão removidos.`)) return;
    try {
      await api.delete(`/professores/${professor.id}`);
      await carregar();
    } catch (e) {
      setErroGeral(mensagemErro(e));
    }
  }

  const filtrados = professores.filter((p) => p.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <>
      <PageHeader titulo="Professores" subtitulo="Cadastre os professores, as disciplinas que lecionam e a disponibilidade de horários.">
        <button type="button" className="botao botao-primario" onClick={abrirNovo}>
          <FiPlus size={18} /> Novo professor
        </button>
      </PageHeader>

      {erroGeral && <div className="alerta alerta-erro">{erroGeral}</div>}

      <div className="cartao">
        <div className="barra-ferramentas">
          <input type="search" className="input-busca" placeholder="Buscar professor..." value={busca} onChange={(e) => setBusca(e.target.value)} />
          <span className="contador">{filtrados.length} registro(s)</span>
        </div>

        {carregando ? (
          <p className="texto-suave">Carregando...</p>
        ) : filtrados.length === 0 ? (
          <EstadoVazio icone={FiUsers} titulo="Nenhum professor encontrado" texto="Cadastre o primeiro professor para começar.">
            <button type="button" className="botao botao-primario" onClick={abrirNovo}>
              <FiPlus size={18} /> Novo professor
            </button>
          </EstadoVazio>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Professor</th>
                  <th>Disciplinas</th>
                  <th>Pontuação</th>
                  <th>Horários disponíveis</th>
                  <th className="coluna-acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((professor) => (
                  <tr key={professor.id}>
                    <td>
                      <strong>{professor.nome}</strong>
                    </td>
                    <td>
                      {professor.disciplinas.length === 0 ? (
                        <span className="texto-suave">—</span>
                      ) : (
                        <div className="chips">
                          {professor.disciplinas.map((d) => (
                            <span className="chip" key={d.id}>
                              {d.nome}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{Number(professor.pontuacao)}</td>
                    <td>{professor.disponibilidade.length} períodos</td>
                    <td className="coluna-acoes">
                      <button type="button" className="botao-icone" title="Visualizar" onClick={() => setProfessorVisualizado(professor)}>
                        <FiEye size={17} />
                      </button>
                      <button type="button" className="botao-icone" title="Editar" onClick={() => abrirEdicao(professor)}>
                        <FiEdit2 size={17} />
                      </button>
                      <button type="button" className="botao-icone perigo" title="Excluir" onClick={() => excluir(professor)}>
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
        <Modal titulo={editandoId ? 'Editar professor' : 'Novo professor'} aoFechar={() => setModalFormulario(false)} largura="grande">
          <form onSubmit={salvar} noValidate>
            {erroFormulario && <div className="alerta alerta-erro">{erroFormulario}</div>}

            <div className="linha-campos">
              <label className="campo">
                <span>Nome completo</span>
                <input
                  type="text"
                  value={formulario.nome}
                  onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
                  placeholder="Ex.: Maria da Silva"
                  autoFocus
                />
              </label>
              <label className="campo">
                <span>Pontuação</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formulario.pontuacao}
                  onChange={(e) => setFormulario({ ...formulario, pontuacao: e.target.value })}
                  placeholder="0"
                />
              </label>
            </div>

            <div className="campo">
              <span>Disciplinas que leciona</span>
              {disciplinasDisponiveis.length === 0 ? (
                <p className="texto-suave">Cadastre disciplinas primeiro para poder vinculá-las ao professor.</p>
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
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="campo">
              <span>
                Disponibilidade de horários <small className="texto-suave">(clique nos períodos em que o professor pode lecionar)</small>
              </span>
              <GradeDisponibilidade
                valor={formulario.disponibilidade}
                aoMudar={(disponibilidade) => setFormulario({ ...formulario, disponibilidade })}
              />
            </div>

            <label className="campo">
              <span>Informações adicionais</span>
              <textarea
                rows="3"
                value={formulario.informacoes_adicionais}
                onChange={(e) => setFormulario({ ...formulario, informacoes_adicionais: e.target.value })}
                placeholder="Observações, restrições, contato..."
              />
            </label>

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

      {professorVisualizado && (
        <Modal titulo={professorVisualizado.nome} aoFechar={() => setProfessorVisualizado(null)}>
          <dl className="detalhes">
            <dt>Pontuação</dt>
            <dd>{Number(professorVisualizado.pontuacao)}</dd>
            <dt>Disciplinas</dt>
            <dd>
              {professorVisualizado.disciplinas.length === 0 ? (
                <span className="texto-suave">Nenhuma disciplina vinculada.</span>
              ) : (
                <div className="chips">
                  {professorVisualizado.disciplinas.map((d) => (
                    <span className="chip" key={d.id}>
                      {d.nome}
                    </span>
                  ))}
                </div>
              )}
            </dd>
            <dt>Disponibilidade</dt>
            <dd>
              <GradeDisponibilidade valor={professorVisualizado.disponibilidade} somenteLeitura />
            </dd>
            <dt>Informações adicionais</dt>
            <dd>{professorVisualizado.informacoes_adicionais || <span className="texto-suave">Nenhuma informação.</span>}</dd>
          </dl>
        </Modal>
      )}
    </>
  );
}
