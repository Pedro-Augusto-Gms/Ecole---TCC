import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUpload, FiCpu, FiTrash2, FiCheckCircle, FiAlertTriangle, FiX, FiFileText } from 'react-icons/fi';
import api, { mensagemErro } from '../services/api.js';
import { lerArquivo, reduzirImagem, TIPOS_ACEITOS, MAX_ARQUIVOS, MAX_MB } from '../utils/arquivos.js';

const TURNOS = ['Integral', 'Manhã', 'Noite'];

export default function ImportarGrade() {
  const [arquivos, setArquivos] = useState([]);
  const [lendo, setLendo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [info, setInfo] = useState('');
  const [segundos, setSegundos] = useState(0);
  const [previa, setPrevia] = useState(null); // { cursos, avisos }
  const [resultado, setResultado] = useState(null);
  const controle = useRef(null);

  useEffect(() => {
    if (!lendo) {
      setSegundos(0);
      return undefined;
    }
    const relogio = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(relogio);
  }, [lendo]);

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
      const { data } = await api.post('/importacao/grade/ler', { arquivos: enviados }, { signal: abort.signal });
      setPrevia(data);
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

  function mudarSerie(ci, si, mudancas) {
    setPrevia((atual) => ({
      ...atual,
      cursos: atual.cursos.map((c, i) =>
        i !== ci ? c : { ...c, series: c.series.map((s, j) => (j === si ? { ...s, ...mudancas } : s)) }
      ),
    }));
  }

  function mudarDisciplina(ci, si, di, mudancas) {
    const serie = previa.cursos[ci].series[si];
    mudarSerie(ci, si, { disciplinas: serie.disciplinas.map((d, k) => (k === di ? { ...d, ...mudancas } : d)) });
  }

  function removerDisciplina(ci, si, di) {
    const serie = previa.cursos[ci].series[si];
    mudarSerie(ci, si, { disciplinas: serie.disciplinas.filter((_, k) => k !== di) });
  }

  function removerSerie(ci, si) {
    setPrevia((atual) => ({
      ...atual,
      cursos: atual.cursos
        .map((c, i) => (i !== ci ? c : { ...c, series: c.series.filter((_, j) => j !== si) }))
        .filter((c) => c.series.length > 0),
    }));
  }

  const turmas = previa ? previa.cursos.flatMap((c) => c.series) : [];

  async function confirmar() {
    setErro('');
    setSalvando(true);
    try {
      const { data } = await api.post('/importacao/grade/confirmar', {
        turmas: turmas.map((s) => ({
          nome_turma: s.nome_turma,
          turno: s.turno,
          aulas_por_dia: Number(s.aulas_por_dia),
          disciplinas: s.disciplinas.map((d) => ({
            nome: d.nome,
            nome_completo: d.nome_completo || null,
            aulas_semanais: Number(d.aulas_semanais),
          })),
        })),
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

  return (
    <>
      {erro && <div className="alerta alerta-erro">{erro}</div>}
      {info && <div className="alerta alerta-aviso">{info}</div>}

      {resultado && (
        <div className="alerta alerta-sucesso">
          <FiCheckCircle size={18} />
          <div>
            <strong>Grade importada.</strong> {resultado.turmas_criadas} turma(s) criada(s), {resultado.turmas_atualizadas} atualizada(s) e{' '}
            {resultado.disciplinas_criadas} disciplina(s) criada(s). <Link to="/turmas">Ver turmas</Link>
            {resultado.avisos?.length > 0 && (
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
          <p className="texto-suave previa-nota">
            Envie a foto ou o arquivo da grade curricular (curso, 1ª/2ª/3ª série e carga horária). A IA cria as turmas e as disciplinas:
            40 h = 1 aula por semana, 80 h = 2, 120 h = 3, 160 h = 4. Nomes muito longos são abreviados.
          </p>
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
              A IA está lendo a grade ({segundos}s). Normalmente leva de 10 a 60 segundos. Se enviou o arquivo errado, cancele.
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
            <span>Nada foi salvo ainda. Confira turmas, turnos e aulas por semana antes de confirmar.</span>
          </div>

          {previa.avisos?.length > 0 && (
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

          {turmas.length === 0 && (
            <div className="cartao">
              <p className="texto-suave">A IA não encontrou nenhum curso na grade. Tente com uma imagem mais nítida.</p>
            </div>
          )}

          {previa.cursos.map((curso, ci) =>
            curso.series.map((serie, si) => {
              const total = serie.disciplinas.reduce((soma, d) => soma + (Number(d.aulas_semanais) || 0), 0);
              const capacidade = Number(serie.aulas_por_dia) * 5;
              return (
                <div className="cartao previa-professor" key={`${ci}-${si}`}>
                  <div className="previa-topo">
                    <div className="linha-campos previa-campos">
                      <label className="campo">
                        <span>Turma</span>
                        <input type="text" value={serie.nome_turma} onChange={(e) => mudarSerie(ci, si, { nome_turma: e.target.value })} />
                      </label>
                      <label className="campo">
                        <span>Turno</span>
                        <select value={serie.turno} onChange={(e) => mudarSerie(ci, si, { turno: e.target.value })}>
                          {TURNOS.map((t) => (
                            <option key={t}>{t}</option>
                          ))}
                        </select>
                      </label>
                      <label className="campo">
                        <span>Aulas por dia</span>
                        <select value={serie.aulas_por_dia} onChange={(e) => mudarSerie(ci, si, { aulas_por_dia: Number(e.target.value) })}>
                          {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <button type="button" className="botao-icone perigo" title="Descartar esta turma" onClick={() => removerSerie(ci, si)}>
                      <FiTrash2 size={18} />
                    </button>
                  </div>

                  {serie.ja_existe && (
                    <p className="texto-suave previa-nota">Esta turma já existe: ao confirmar, as disciplinas dela serão substituídas pelas desta grade.</p>
                  )}

                  <table className="tabela">
                    <thead>
                      <tr>
                        <th>Disciplina</th>
                        <th style={{ width: 130 }}>Aulas/semana</th>
                        <th style={{ width: 50 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {serie.disciplinas.map((d, di) => (
                        <tr key={di}>
                          <td>
                            <input type="text" value={d.nome} onChange={(e) => mudarDisciplina(ci, si, di, { nome: e.target.value })} />
                            {d.nome_completo && <small className="texto-suave">{d.nome_completo}</small>}
                            {!d.existe && <span className="chip chip-aviso"> (nova)</span>}
                          </td>
                          <td>
                            <input
                              type="number"
                              min="1"
                              max="20"
                              value={d.aulas_semanais}
                              onChange={(e) => mudarDisciplina(ci, si, di, { aulas_semanais: e.target.value })}
                            />
                          </td>
                          <td>
                            <button type="button" className="botao-icone perigo" onClick={() => removerDisciplina(ci, si, di)} title="Remover">
                              <FiX size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className={`previa-nota ${total > capacidade ? 'texto-erro' : 'texto-suave'}`}>
                    Total: {total} aulas por semana · cabem {capacidade} ({serie.aulas_por_dia} por dia × 5 dias)
                    {total > capacidade && ' — passou da capacidade, a geração de horário não conseguirá encaixar tudo.'}
                  </p>
                </div>
              );
            })
          )}

          <div className="modal-rodape">
            <button
              type="button"
              className="botao botao-secundario"
              onClick={() => {
                setPrevia(null);
                setErro('');
              }}
            >
              Cancelar
            </button>
            <button type="button" className="botao botao-primario" onClick={confirmar} disabled={salvando || turmas.length === 0}>
              <FiCheckCircle size={18} /> {salvando ? 'Salvando...' : `Confirmar e salvar (${turmas.length} turma${turmas.length === 1 ? '' : 's'})`}
            </button>
          </div>
        </>
      )}
    </>
  );
}
