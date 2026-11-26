import { useEffect, useState } from 'react';
import { FiZap, FiCheckCircle, FiTrash2, FiAlertTriangle, FiCalendar, FiSend, FiX, FiCopy, FiCpu } from 'react-icons/fi';
import PageHeader from '../components/PageHeader.jsx';
import QuadroHorario from '../components/QuadroHorario.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import api, { mensagemErro } from '../services/api.js';

export default function Horarios() {
  const [turmas, setTurmas] = useState([]);
  const [turmaId, setTurmaId] = useState('');
  const [dados, setDados] = useState(null); // { turma, estrutura, rascunho, publicado, restricoes }
  const [visao, setVisao] = useState('rascunho');
  const [pendencias, setPendencias] = useState([]);
  const [ajustes, setAjustes] = useState([]);
  const [conversa, setConversa] = useState([]);
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  useEffect(() => {
    api
      .get('/turmas')
      .then(({ data }) => setTurmas(data))
      .catch((e) => setErro(mensagemErro(e)));
  }, []);

  // Ao trocar de turma, carrega o rascunho e a grade oficial dela.
  useEffect(() => {
    setDados(null);
    setPendencias([]);
    setAjustes([]);
    setConversa([]);
    setSucesso('');
    if (!turmaId) return;
    api
      .get(`/horarios/turma/${turmaId}`)
      .then(({ data }) => {
        setDados(data);
        setVisao(data.rascunho.length > 0 ? 'rascunho' : 'publicado');
      })
      .catch((e) => setErro(mensagemErro(e)));
  }, [turmaId]);

  async function executar(nome, funcao) {
    setErro('');
    setSucesso('');
    setOcupado(nome);
    try {
      await funcao();
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setOcupado('');
    }
  }

  const gerar = () =>
    executar('gerar', async () => {
      const { data } = await api.post('/horarios/gerar', { turma_id: Number(turmaId) });
      setDados(data);
      setPendencias(data.pendencias || []);
      setAjustes(data.ajustes || []);
      setVisao('rascunho');
    });

  const publicar = () => {
    if (pendencias.length > 0 && !window.confirm('Há aulas que não couberam. Publicar mesmo assim?')) return;
    executar('publicar', async () => {
      const { data } = await api.post('/horarios/publicar', { turma_id: Number(turmaId) });
      setDados(data);
      setPendencias([]);
    setAjustes([]);
      setVisao('publicado');
      setSucesso('Grade publicada! Os alunos já podem ver esta turma na página pública.');
    });
  };

  const descartar = () => {
    if (!window.confirm('Descartar o rascunho? A grade oficial não muda.')) return;
    executar('descartar', async () => {
      const { data } = await api.delete(`/horarios/turma/${turmaId}/rascunho`);
      setDados(data);
      setPendencias([]);
    setAjustes([]);
      setVisao('publicado');
    });
  };

  const despublicar = () => {
    if (!window.confirm('Remover a grade oficial desta turma? Os alunos deixarão de vê-la.')) return;
    executar('despublicar', async () => {
      const { data } = await api.delete(`/horarios/turma/${turmaId}/publicado`);
      setDados(data);
      setVisao('rascunho');
    });
  };

  const removerRestricao = (id) =>
    executar('restricao', async () => {
      const { data } = await api.delete(`/horarios/restricoes/${id}`, { params: { turma_id: turmaId } });
      setDados(data);
      setSucesso('Regra removida. Clique em "Gerar rascunho" para refazer o horário sem ela.');
    });

  async function enviarAjuste(evento) {
    evento.preventDefault();
    const texto = mensagem.trim();
    if (!texto || !turmaId) return;
    setMensagem('');
    setConversa((atual) => [...atual, { papel: 'gestor', texto }]);

    await executar('ajustar', async () => {
      const { data } = await api.post('/horarios/ajustar', { turma_id: Number(turmaId), mensagem: texto });
      setDados(data);
      setPendencias(data.pendencias || []);
      setAjustes(data.ajustes || []);
      if (data.aplicadas.length > 0) setVisao('rascunho');
      setConversa((atual) => [
        ...atual,
        { papel: 'ia', texto: data.resposta || (data.aplicadas.length ? 'Ajuste aplicado.' : 'Não consegui aplicar esse pedido.'), avisos: data.avisos },
      ]);
    });
  }

  const linkAlunos = `${window.location.origin}/grade${turmaId ? `?turma=${turmaId}` : ''}`;
  const copiarLink = () => {
    navigator.clipboard?.writeText(linkAlunos).then(() => setSucesso('Link copiado!'));
  };

  const temRascunho = (dados?.rascunho.length || 0) > 0;
  const temPublicado = (dados?.publicado.length || 0) > 0;
  const horariosVisiveis = visao === 'rascunho' ? dados?.rascunho || [] : dados?.publicado || [];

  return (
    <>
      <PageHeader
        titulo="Geração de horários"
        subtitulo="Gere um rascunho, peça ajustes à IA e, quando estiver bom, publique a grade oficial para os alunos."
      />

      {erro && <div className="alerta alerta-erro">{erro}</div>}
      {sucesso && (
        <div className="alerta alerta-sucesso">
          <FiCheckCircle size={18} />
          <span>{sucesso}</span>
        </div>
      )}

      <div className="cartao">
        <div className="parametros">
          <label className="campo">
            <span>Turma</span>
            <select value={turmaId} onChange={(e) => setTurmaId(e.target.value)}>
              <option value="">Selecione uma turma...</option>
              {turmas.map((turma) => (
                <option key={turma.id} value={turma.id}>
                  {turma.nome} — {turma.turno} ({turma.aulas_por_dia} aulas/dia)
                </option>
              ))}
            </select>
          </label>

          <div className="parametros-acoes">
            <button type="button" className="botao botao-primario" onClick={gerar} disabled={!turmaId || ocupado !== ''}>
              <FiZap size={18} /> {ocupado === 'gerar' ? 'Gerando...' : 'Gerar rascunho'}
            </button>
            <button type="button" className="botao botao-sucesso" onClick={publicar} disabled={!temRascunho || ocupado !== ''}>
              <FiCheckCircle size={18} /> {ocupado === 'publicar' ? 'Publicando...' : 'Aceitar e publicar'}
            </button>
          </div>
        </div>

        {dados && (
          <p className="texto-suave parametros-resumo">
            {dados.turma.turno} · {dados.turma.aulas_por_dia} aulas por dia · grade oficial: {temPublicado ? 'publicada' : 'ainda não publicada'}
          </p>
        )}
      </div>

      {ajustes.length > 0 && (
        <div className="alerta alerta-aviso">
          <FiAlertTriangle size={18} />
          <div>
            <strong>Não coube tudo na disponibilidade dos professores. Estas aulas foram colocadas fora dela, o mais perto possível:</strong>
            <ul>
              {ajustes.map((ajuste, i) => (
                <li key={i}>{ajuste.mensagem}</li>
              ))}
            </ul>
          </div>
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
        <div className="quadro-topo">
          <h2 className="cartao-titulo">Quadro semanal{dados ? ` · ${dados.turma.nome}` : ''}</h2>
          {dados && (
            <div className="abas-visao">
              <button type="button" className={visao === 'rascunho' ? 'ativa' : ''} onClick={() => setVisao('rascunho')}>
                Rascunho{temRascunho ? ` (${dados.rascunho.length})` : ''}
              </button>
              <button type="button" className={visao === 'publicado' ? 'ativa' : ''} onClick={() => setVisao('publicado')}>
                Grade oficial{temPublicado ? ` (${dados.publicado.length})` : ''}
              </button>
            </div>
          )}
        </div>

        {!turmaId ? (
          <EstadoVazio icone={FiCalendar} titulo="Selecione uma turma" texto="O horário da turma escolhida será exibido aqui." />
        ) : !dados ? (
          <p className="texto-suave">Carregando...</p>
        ) : horariosVisiveis.length === 0 ? (
          <EstadoVazio
            icone={FiCalendar}
            titulo={visao === 'rascunho' ? 'Nenhum rascunho ainda' : 'Esta turma ainda não tem grade oficial'}
            texto={
              visao === 'rascunho'
                ? 'Clique em “Gerar rascunho”. Antes, confirme que a turma tem disciplinas e que os professores têm disponibilidade marcada.'
                : 'Gere um rascunho e clique em “Aceitar e publicar” para os alunos verem.'
            }
          />
        ) : (
          <QuadroHorario horarios={horariosVisiveis} estrutura={dados.estrutura} />
        )}

        {dados && (temRascunho || temPublicado) && (
          <div className="quadro-rodape">
            {visao === 'rascunho' && temRascunho && (
              <button type="button" className="botao botao-secundario" onClick={descartar} disabled={ocupado !== ''}>
                <FiTrash2 size={16} /> Descartar rascunho
              </button>
            )}
            {visao === 'publicado' && temPublicado && (
              <button type="button" className="botao botao-secundario" onClick={despublicar} disabled={ocupado !== ''}>
                <FiTrash2 size={16} /> Remover grade oficial
              </button>
            )}
          </div>
        )}
      </div>

      {turmaId && (
        <div className="cartao">
          <h2 className="cartao-titulo">
            <FiCpu size={18} /> Ajustar com a IA
          </h2>
          <p className="texto-suave previa-nota">
            Diga o que quer mudar, por exemplo: “Matemática só depois das 12:00”, “O professor João só dá aula de terça a quinta” ou
            “Nenhuma aula depois das 15:00 nesta turma”. A IA cria a regra e refaz o rascunho.
          </p>

          {conversa.length > 0 && (
            <div className="chat-mensagens">
              {conversa.map((item, i) => (
                <div key={i} className={`chat-msg chat-${item.papel}`}>
                  {item.texto}
                  {item.avisos?.map((aviso, j) => (
                    <small key={j}>{aviso}</small>
                  ))}
                </div>
              ))}
              {ocupado === 'ajustar' && <div className="chat-msg chat-ia">Pensando...</div>}
            </div>
          )}

          <form className="chat-form" onSubmit={enviarAjuste}>
            <textarea
              rows="2"
              value={mensagem}
              onChange={(e) => setMensagem(e.target.value)}
              placeholder="Escreva o ajuste que você quer..."
              disabled={ocupado !== ''}
            />
            <button type="submit" className="botao botao-primario" disabled={ocupado !== '' || !mensagem.trim()}>
              <FiSend size={16} /> Enviar
            </button>
          </form>

          {dados && dados.restricoes.length > 0 && (
            <div className="restricoes">
              <strong>Regras ativas</strong>
              <ul>
                {dados.restricoes.map((regra) => (
                  <li key={regra.id}>
                    <span>
                      {regra.descricao} <small>({regra.turma_id ? 'só esta turma' : 'todas as turmas'})</small>
                    </span>
                    <button type="button" className="botao-icone perigo" title="Remover regra" onClick={() => removerRestricao(regra.id)} disabled={ocupado !== ''}>
                      <FiX size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      <div className="cartao">
        <h2 className="cartao-titulo">Link para os alunos</h2>
        <p className="texto-suave previa-nota">Qualquer pessoa com este link vê as grades já publicadas, sem precisar de login.</p>
        <div className="link-alunos">
          <input type="text" readOnly value={linkAlunos} onFocus={(e) => e.target.select()} />
          <button type="button" className="botao botao-secundario" onClick={copiarLink}>
            <FiCopy size={16} /> Copiar
          </button>
        </div>
      </div>
    </>
  );
}
