import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiUsers, FiLayers, FiBookOpen, FiCalendar, FiArrowRight, FiClock } from 'react-icons/fi';
import PageHeader from '../components/PageHeader.jsx';
import CardEstatistica from '../components/CardEstatistica.jsx';
import EstadoVazio from '../components/EstadoVazio.jsx';
import api, { mensagemErro } from '../services/api.js';
import { useAuth } from '../contexts/AuthContext.jsx';

const ATALHOS = [
  { para: '/professores', titulo: 'Professores', texto: 'Cadastre professores e a disponibilidade deles.', icone: FiUsers },
  { para: '/turmas', titulo: 'Turmas', texto: 'Organize as turmas e suas disciplinas.', icone: FiLayers },
  { para: '/disciplinas', titulo: 'Disciplinas', texto: 'Defina as aulas semanais de cada matéria.', icone: FiBookOpen },
  { para: '/horarios', titulo: 'Gerar horários', texto: 'Monte e visualize a grade semanal.', icone: FiCalendar },
];

function formatarData(dataIso) {
  return new Date(dataIso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export default function Dashboard() {
  const { usuario } = useAuth();
  const [resumo, setResumo] = useState(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    api
      .get('/dashboard')
      .then(({ data }) => setResumo(data))
      .catch((e) => setErro(mensagemErro(e)));
  }, []);

  const primeiroNome = (usuario?.nome || '').split(' ')[0];

  return (
    <>
      <PageHeader titulo={`Olá, ${primeiroNome}!`} subtitulo="Veja uma visão geral da sua ETEC." />

      {erro && <div className="alerta alerta-erro">{erro}</div>}

      <section className="grade-estatisticas">
        <CardEstatistica icone={FiUsers} rotulo="Professores" valor={resumo?.totais.professores ?? '–'} detalhe="cadastrados" />
        <CardEstatistica icone={FiLayers} rotulo="Turmas" valor={resumo?.totais.turmas ?? '–'} detalhe="cadastradas" />
        <CardEstatistica icone={FiBookOpen} rotulo="Disciplinas" valor={resumo?.totais.disciplinas ?? '–'} detalhe="cadastradas" />
      </section>

      <section className="dashboard-colunas">
        <div className="cartao">
          <h2 className="cartao-titulo">Atalhos</h2>
          <div className="atalhos">
            {ATALHOS.map(({ para, titulo, texto, icone: Icone }) => (
              <Link key={para} to={para} className="atalho">
                <div className="atalho-icone">
                  <Icone size={22} />
                </div>
                <div>
                  <strong>{titulo}</strong>
                  <span>{texto}</span>
                </div>
                <FiArrowRight size={18} className="atalho-seta" />
              </Link>
            ))}
          </div>
        </div>

        <div className="cartao">
          <h2 className="cartao-titulo">Atividades recentes</h2>
          {resumo && resumo.atividades.length === 0 ? (
            <EstadoVazio icone={FiClock} titulo="Nada por aqui ainda" texto="As ações realizadas no sistema aparecem nesta lista." />
          ) : (
            <ul className="atividades">
              {(resumo?.atividades || []).map((atividade) => (
                <li key={atividade.id}>
                  <span className="atividade-ponto" />
                  <div>
                    <p>{atividade.descricao}</p>
                    <small>{formatarData(atividade.criado_em)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
