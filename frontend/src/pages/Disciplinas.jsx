import { useEffect, useState } from 'react';
import { FiPlus, FiEdit2, FiTrash2, FiBookOpen } from 'react-icons/fi';
import PageHeader from '../components/PageHeader.jsx';
import Modal from '../components/Modal.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import api, { mensagemErro } from '../services/api.js';

const FORMULARIO_VAZIO = { nome: '', aulas_semanais: 2 };

export default function Disciplinas() {
  const [disciplinas, setDisciplinas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroGeral, setErroGeral] = useState('');
  const [busca, setBusca] = useState('');

  const [modalAberto, setModalAberto] = useState(false);
  const [editandoId, setEditandoId] = useState(null);
  const [formulario, setFormulario] = useState(FORMULARIO_VAZIO);
  const [erroFormulario, setErroFormulario] = useState('');
  const [salvando, setSalvando] = useState(false);

  async function carregar() {
    try {
      const { data } = await api.get('/disciplinas');
      setDisciplinas(data);
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
    setModalAberto(true);
  }

  function abrirEdicao(disciplina) {
    setEditandoId(disciplina.id);
    setFormulario({ nome: disciplina.nome, aulas_semanais: disciplina.aulas_semanais });
    setErroFormulario('');
    setModalAberto(true);
  }

  async function salvar(evento) {
    evento.preventDefault();
    setErroFormulario('');

    const aulas = Number(formulario.aulas_semanais);
    if (formulario.nome.trim().length < 2) return setErroFormulario('Informe o nome da disciplina.');
    if (!Number.isInteger(aulas) || aulas < 1 || aulas > 20) {
      return setErroFormulario('Aulas semanais deve ser um número entre 1 e 20.');
    }

    setSalvando(true);
    try {
      const dados = { nome: formulario.nome.trim(), aulas_semanais: aulas };
      if (editandoId) await api.put(`/disciplinas/${editandoId}`, dados);
      else await api.post('/disciplinas', dados);
      setModalAberto(false);
      await carregar();
    } catch (e) {
      setErroFormulario(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  async function excluir(disciplina) {
    const confirmou = window.confirm(
      `Excluir a disciplina "${disciplina.nome}"? Ela também será removida das turmas, dos professores e dos horários gerados.`
    );
    if (!confirmou) return;
    try {
      await api.delete(`/disciplinas/${disciplina.id}`);
      await carregar();
    } catch (e) {
      setErroGeral(mensagemErro(e));
    }
  }

  const filtradas = disciplinas.filter((d) => d.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <>
      <PageHeader titulo="Disciplinas" subtitulo="Cadastre as disciplinas e a quantidade de aulas semanais.">
        <button type="button" className="botao botao-primario" onClick={abrirNovo}>
          <FiPlus size={18} /> Nova disciplina
        </button>
      </PageHeader>

      {erroGeral && <div className="alerta alerta-erro">{erroGeral}</div>}

      <div className="cartao">
        <div className="barra-ferramentas">
          <input
            type="search"
            className="input-busca"
            placeholder="Buscar disciplina..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <span className="contador">{filtradas.length} registro(s)</span>
        </div>

        {carregando ? (
          <p className="texto-suave">Carregando...</p>
        ) : filtradas.length === 0 ? (
          <EstadoVazio
            icone={FiBookOpen}
            titulo="Nenhuma disciplina encontrada"
            texto="Cadastre a primeira disciplina para começar."
          >
            <button type="button" className="botao botao-primario" onClick={abrirNovo}>
              <FiPlus size={18} /> Nova disciplina
            </button>
          </EstadoVazio>
        ) : (
          <div className="tabela-rolagem">
            <table className="tabela">
              <thead>
                <tr>
                  <th>Disciplina</th>
                  <th>Aulas por semana</th>
                  <th className="coluna-acoes">Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((disciplina) => (
                  <tr key={disciplina.id}>
                    <td>
                      <strong>{disciplina.nome}</strong>
                    </td>
                    <td>
                      <span className="chip">{disciplina.aulas_semanais} aulas</span>
                    </td>
                    <td className="coluna-acoes">
                      <button type="button" className="botao-icone" title="Editar" onClick={() => abrirEdicao(disciplina)}>
                        <FiEdit2 size={17} />
                      </button>
                      <button type="button" className="botao-icone perigo" title="Excluir" onClick={() => excluir(disciplina)}>
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

      {modalAberto && (
        <Modal titulo={editandoId ? 'Editar disciplina' : 'Nova disciplina'} aoFechar={() => setModalAberto(false)} largura="pequena">
          <form onSubmit={salvar} noValidate>
            {erroFormulario && <div className="alerta alerta-erro">{erroFormulario}</div>}

            <label className="campo">
              <span>Nome da disciplina</span>
              <input
                type="text"
                value={formulario.nome}
                onChange={(e) => setFormulario({ ...formulario, nome: e.target.value })}
                placeholder="Ex.: Matemática"
                autoFocus
              />
            </label>

            <label className="campo">
              <span>Aulas semanais</span>
              <input
                type="number"
                min="1"
                max="20"
                value={formulario.aulas_semanais}
                onChange={(e) => setFormulario({ ...formulario, aulas_semanais: e.target.value })}
              />
            </label>

            <div className="modal-rodape">
              <button type="button" className="botao botao-secundario" onClick={() => setModalAberto(false)}>
                Cancelar
              </button>
              <button type="submit" className="botao botao-primario" disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </>
  );
}
