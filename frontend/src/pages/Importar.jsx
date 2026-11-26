import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUpload, FiCpu, FiTrash2, FiCheckCircle, FiAlertTriangle, FiX, FiFileText } from 'react-icons/fi';
import PageHeader from '../components/PageHeader.jsx';
import ImportarGrade from './ImportarGrade.jsx';
import { normalizar, lerArquivo, reduzirImagem, TIPOS_ACEITOS, MAX_ARQUIVOS, MAX_MB } from '../utils/arquivos.js';
import GradeDisponibilidade from '../components/GradeDisponibilidade.jsx';
import api, { mensagemErro } from '../services/api.js';

function ImportarProfessores() {
  const [arquivos, setArquivos] = useState([]);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [segundos, setSegundos] = useState(0);
  const [info, setInfo] = useState('');
  const controle = useRef(null);

  // Contador mostrado enquanto a IA lê, para a gestão ver que o sistema está trabalhando.
  useEffect(() => {
    if (!lendo) {
      setSegundos(0);
      return undefined;
    }
    const relogio = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(relogio);
  }, [lendo]);

  const [previa, setPrevia] = useState(null); // { professores, avisos, disciplinas_existentes }
  const [aulasNovas, setAulasNovas] = useState({}); // nome normalizado -> aulas semanais
  const [resultado, setResultado] = useState(null);

  function escolherArquivos(evento) {
    setErro('');
    const escolhidos = Array.from(evento.target.files || []);
    evento.target.value = '';

    const todos = [...arquivos, ...escolhidos];
    if (todos.length > MAX_ARQUIVOS) return setErro(`Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.`);
    const grande = todos.find((a) => a.size > MAX_MB * 1024 * 1024);
    if (grande) return setErro(`"${grande.name}" passa de ${MAX_MB} MB. Reduza a foto ou envie outra.`);
    setArquivos(todos);
  }

  async function lerComIA() {
    setErro('');
    setInfo('');
    setResultado(null);
    setLendo(true);
    const abort = new AbortController();
    controle.current = abort;
    try {
      const enviados = await Promise.all(arquivos.map(async (arquivo) => lerArquivo(await reduzirImagem(arquivo))));
      if (abort.signal.aborted) return;
      const { data } = await api.post('/importacao/ler', { arquivos: enviados }, { signal: abort.signal });
      setPrevia(data);
      setAulasNovas({});
    } catch (e) {
      if (abort.signal.aborted || e.code === 'ERR_CANCELED') setInfo('Leitura cancelada. Nada foi salvo.');
      else setErro(e.message && !e.response ? e.message : mensagemErro(e));
    } finally {
      controle.current = null;
      setLendo(false);
    }
  }

  function cancelarLeitura() {
    controle.current?.abort();
  }

  function atualizarProfessor(indice, mudancas) {
    setPrevia((atual) => ({
      ...atual,
      professores: atual.professores.map((p, i) => (i === indice ? { ...p, ...mudancas } : p)),
    }));
  }

  function removerProfessor(indice) {
    setPrevia((atual) => ({ ...atual, professores: atual.professores.filter((_, i) => i !== indice) }));
  }

  function removerDisciplina(indiceProfessor, indiceDisciplina) {
    const professor = previa.professores[indiceProfessor];
    atualizarProfessor(indiceProfessor, { disciplinas: professor.disciplinas.filter((_, i) => i !== indiceDisciplina) });
  }

  function adicionarDisciplina(indiceProfessor, idDisciplina) {
    if (!idDisciplina) return;
    const existente = previa.disciplinas_existentes.find((d) => String(d.id) === String(idDisciplina));
    const professor = previa.professores[indiceProfessor];
    if (!existente || professor.disciplinas.some((d) => normalizar(d.nome) === normalizar(existente.nome))) return;
    atualizarProfessor(indiceProfessor, { disciplinas: [...professor.disciplinas, { nome: existente.nome, id: existente.id }] });
  }

  // Disciplinas que a IA leu mas ainda não existem no sistema (sem repetir)
  const disciplinasNovas = [];
  if (previa) {
    const vistas = new Set();
    previa.professores.forEach((p) =>
      p.disciplinas.forEach((d) => {
        const chave = normalizar(d.nome);
        if (!d.id && !vistas.has(chave)) {
          vistas.add(chave);
          disciplinasNovas.push({ chave, nome: d.nome });
        }
      })
    );
  }

  async function confirmar() {
    setErro('');
    setSalvando(true);
    try {
      const { data } = await api.post('/importacao/confirmar', {
        professores: previa.professores.map((p) => ({
          nome: p.nome,
          pontuacao: p.pontuacao,
          disciplinas: p.disciplinas.map((d) => d.nome),
          disponibilidade: p.disponibilidade,
          informacoes_adicionais: p.informacoes_adicionais,
        })),
        novas_disciplinas: disciplinasNovas.map((d) => ({ nome: d.nome, aulas_semanais: Number(aulasNovas[d.chave] ?? 2) })),
      });
      setResultado(data);
      setPrevia(null);
      setArquivos([]);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  }

  function cancelar() {
    setPrevia(null);
    setErro('');
  }

  return (
    <>
      {erro && <div className="alerta alerta-erro">{erro}</div>}

      {info && <div className="alerta alerta-aviso">{info}</div>}

      {resultado && (
        <div className="alerta alerta-sucesso">
          <FiCheckCircle size={18} />
          <div>
            <strong>Importação concluída.</strong> {resultado.criados} professor(es) novo(s), {resultado.atualizados} atualizado(s) e{' '}
            {resultado.disciplinas_criadas} disciplina(s) criada(s). <Link to="/professores">Ver professores</Link>
            {resultado.avisos.length > 0 && (
              <ul>
                {resultado.avisos.map((aviso, i) => (
                  <li key={i}>{aviso}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {!previa && (
        <div className="cartao">
          <label className="area-upload">
            <FiUpload size={30} />
            <strong>Clique para escolher os arquivos</strong>
            <span>
              Fotos (JPG, PNG, WEBP), PDF ou texto · até {MAX_ARQUIVOS} arquivos de {MAX_MB} MB
            </span>
            <input type="file" accept={TIPOS_ACEITOS} multiple onChange={escolherArquivos} hidden />
          </label>

          {arquivos.length > 0 && (
            <ul className="lista-arquivos">
              {arquivos.map((arquivo, i) => (
                <li key={`${arquivo.name}-${i}`}>
                  <FiFileText size={18} />
                  <span>{arquivo.name}</span>
                  <small>{(arquivo.size / 1024 / 1024).toFixed(1)} MB</small>
                  <button type="button" className="botao-icone perigo" onClick={() => setArquivos(arquivos.filter((_, j) => j !== i))} title="Remover">
                    <FiX size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {lendo && (
            <p className="texto-suave previa-nota">
              A IA está lendo os arquivos ({segundos}s). Normalmente leva de 10 a 60 segundos. Não feche nem recarregue a página.
            </p>
          )}

          <div className="modal-rodape">
            <button type="button" className="botao botao-primario" onClick={lerComIA} disabled={lendo || arquivos.length === 0}>
              <FiCpu size={18} /> {lendo ? `Lendo com IA... ${segundos}s` : 'Ler com IA'}
            </button>
            {lendo && (
              <button type="button" className="botao botao-secundario" onClick={cancelarLeitura}>
                <FiX size={18} /> Cancelar leitura
              </button>
            )}
          </div>
        </div>
      )}

      {previa && (
        <>
          <div className="alerta alerta-aviso">
            <FiAlertTriangle size={18} />
            <span>Nada foi salvo ainda. Confira e corrija os dados lidos pela IA antes de confirmar.</span>
          </div>

          {previa.avisos.length > 0 && (
            <div className="alerta alerta-aviso">
              <FiAlertTriangle size={18} />
              <div>
                <strong>Avisos da leitura:</strong>
                <ul>
                  {previa.avisos.map((aviso, i) => (
                    <li key={i}>{aviso}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {previa.professores.length === 0 && (
            <div className="cartao">
              <p className="texto-suave">A IA não encontrou nenhum professor nos arquivos. Tente com uma foto mais nítida.</p>
            </div>
          )}

          {previa.professores.map((professor, indice) => {
            const idsUsados = new Set(professor.disciplinas.map((d) => normalizar(d.nome)));
            const opcoes = previa.disciplinas_existentes.filter((d) => !idsUsados.has(normalizar(d.nome)));
            return (
              <div className="cartao previa-professor" key={indice}>
                <div className="previa-topo">
                  <div className="linha-campos previa-campos">
                    <label className="campo">
                      <span>Nome completo</span>
                      <input type="text" value={professor.nome} onChange={(e) => atualizarProfessor(indice, { nome: e.target.value })} />
                    </label>
                    <label className="campo">
                      <span>Pontuação</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={professor.pontuacao ?? ''}
                        onChange={(e) => atualizarProfessor(indice, { pontuacao: e.target.value === '' ? null : Number(e.target.value) })}
                      />
                    </label>
                  </div>
                  <button type="button" className="botao-icone perigo" title="Descartar este professor" onClick={() => removerProfessor(indice)}>
                    <FiTrash2 size={18} />
                  </button>
                </div>

                {professor.ja_existe && <p className="texto-suave previa-nota">Já cadastrado: ao confirmar, disciplinas e disponibilidade serão substituídas pelas deste formulário.</p>}

                <div className="campo">
                  <span>Disciplinas</span>
                  <div className="chips">
                    {professor.disciplinas.length === 0 && <span className="texto-suave">Nenhuma disciplina lida.</span>}
                    {professor.disciplinas.map((disciplina, i) => (
                      <span key={disciplina.nome} className={`chip ${disciplina.id ? '' : 'chip-aviso'}`}>
                        {disciplina.nome}
                        {!disciplina.id && ' (nova)'}
                        <button type="button" className="chip-remover" onClick={() => removerDisciplina(indice, i)} aria-label={`Remover ${disciplina.nome}`}>
                          <FiX size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                  {opcoes.length > 0 && (
                    <select className="previa-adicionar" value="" onChange={(e) => adicionarDisciplina(indice, e.target.value)}>
                      <option value="">+ Adicionar disciplina já cadastrada...</option>
                      {opcoes.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <details className="previa-detalhes">
                  <summary>Disponibilidade ({professor.disponibilidade.length} períodos marcados)</summary>
                  <GradeDisponibilidade valor={professor.disponibilidade} aoMudar={(disponibilidade) => atualizarProfessor(indice, { disponibilidade })} />
                </details>

                <label className="campo">
                  <span>Informações adicionais</span>
                  <textarea rows="2" value={professor.informacoes_adicionais} onChange={(e) => atualizarProfessor(indice, { informacoes_adicionais: e.target.value })} />
                </label>
              </div>
            );
          })}

          {disciplinasNovas.length > 0 && (
            <div className="cartao">
              <h2 className="cartao-titulo">Disciplinas novas</h2>
              <p className="texto-suave previa-nota">Estas disciplinas não existem no sistema e serão criadas. Informe as aulas por semana de cada uma.</p>
              <div className="novas-disciplinas">
                {disciplinasNovas.map((d) => (
                  <label className="campo" key={d.chave}>
                    <span>{d.nome}</span>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={aulasNovas[d.chave] ?? 2}
                      onChange={(e) => setAulasNovas({ ...aulasNovas, [d.chave]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="modal-rodape">
            <button type="button" className="botao botao-secundario" onClick={cancelar}>
              Cancelar
            </button>
            <button type="button" className="botao botao-primario" onClick={confirmar} disabled={salvando || previa.professores.length === 0}>
              <FiCheckCircle size={18} /> {salvando ? 'Salvando...' : `Confirmar e salvar (${previa.professores.length})`}
            </button>
          </div>
        </>
      )}
    </>
  );
}

export default function Importar() {
  const [aba, setAba] = useState('professores');
  return (
    <>
      <PageHeader
        titulo="Importar com IA"
        subtitulo="Envie fotos ou PDFs. A IA lê os dados e você confere antes de salvar."
      />
      <div className="abas-visao abas-importar">
        <button type="button" className={aba === 'professores' ? 'ativa' : ''} onClick={() => setAba('professores')}>
          Professores (disponibilidade)
        </button>
        <button type="button" className={aba === 'grade' ? 'ativa' : ''} onClick={() => setAba('grade')}>
          Grade curricular (curso e turmas)
        </button>
      </div>
      {aba === 'professores' ? <ImportarProfessores /> : <ImportarGrade />}
    </>
  );
}
