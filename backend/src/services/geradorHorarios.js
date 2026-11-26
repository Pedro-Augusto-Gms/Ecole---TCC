const { DIAS, intervaloDoPeriodo } = require('../config/horarios');

/**
 * Gerador de horários (algoritmo guloso). Continua isolado aqui para ser evoluído no TCC
 * sem mexer em controllers ou frontend.
 *
 * Entrada:
 *  - disciplinas: [{ id, nome, aulas_semanais }]                    disciplinas da turma
 *  - professores: [{ id, pontuacao, disciplinas: [ids], disponibilidade: [{ dia_semana, periodo }] }]
 *  - ocupacaoExterna: [{ professor_id, dia_semana, periodo }]       aulas em OUTRAS turmas
 *  - periodosPorDia: aulas por dia da turma (define os horários reais de cada aula)
 *  - restricoes: [{ disciplina_id?, professor_id?, depois_de?, antes_de?, dias_permitidos?, dias_proibidos? }]
 *      depois_de/antes_de em minutos desde 00:00. Uma regra vale para a aula quando a disciplina e o
 *      professor citados (se houver) coincidem com os dela.
 *
 * Saída: { alocacoes: [{ dia_semana, periodo, disciplina_id, professor_id }], pendencias: [...], ajustes: [...] }
 *
 * Duas fases: (1) só dentro da disponibilidade dos professores; (2) as aulas que sobraram são colocadas
 * no horário livre MAIS PRÓXIMO da disponibilidade do professor, e cada uma vira um aviso em "ajustes".
 *
 * Regras: turma sem duas aulas no mesmo horário; professor só na sua disponibilidade e em uma turma
 * por vez; aulas da disciplina espalhadas pelos dias; maior pontuação tem prioridade; restrições da gestão.
 */
function gerarHorario({ disciplinas, professores, ocupacaoExterna, periodosPorDia, restricoes = [] }) {
  const chave = (dia, periodo) => `${dia}-${periodo}`;

  const professoresPreparados = professores
    .map((professor) => ({
      id: professor.id,
      nome: professor.nome || `Professor ${professor.id}`,
      pontuacao: Number(professor.pontuacao) || 0,
      disciplinas: professor.disciplinas,
      disponibilidade: new Set(professor.disponibilidade.map((d) => chave(d.dia_semana, d.periodo))),
    }))
    .sort((a, b) => b.pontuacao - a.pontuacao);

  const professorOcupado = new Set(ocupacaoExterna.map((o) => `${o.professor_id}-${chave(o.dia_semana, o.periodo)}`));
  const gradeTurma = new Set();
  const alocacoes = [];
  const pendencias = [];
  const ajustes = [];

  // A aula respeita todas as regras da gestão que se aplicam a ela?
  function permitido(disciplinaId, professorId, dia, periodo) {
    const horario = intervaloDoPeriodo(periodosPorDia, periodo);
    if (!horario) return false;
    for (const regra of restricoes) {
      if (regra.disciplina_id && regra.disciplina_id !== disciplinaId) continue;
      if (regra.professor_id && regra.professor_id !== professorId) continue;
      if (regra.depois_de != null && horario.inicio < regra.depois_de) return false;
      if (regra.antes_de != null && horario.fim > regra.antes_de) return false;
      if (regra.dias_permitidos && regra.dias_permitidos.length && !regra.dias_permitidos.includes(dia)) return false;
      if (regra.dias_proibidos && regra.dias_proibidos.includes(dia)) return false;
    }
    return true;
  }

  // Disciplinas com mais aulas primeiro (são as mais difíceis de encaixar)
  const ordenadas = [...disciplinas].sort((a, b) => b.aulas_semanais - a.aulas_semanais);

  const NOMES_DIAS = Object.fromEntries(DIAS.map((d) => [d.numero, d.nome.replace('-feira', '')]));
  const estado = new Map(); // disciplina.id -> { aulasPorDia, alocadas }

  function alocar(disciplina, professor, dia, periodo, foraDaDisponibilidade) {
    const slot = chave(dia, periodo);
    const situacao = estado.get(disciplina.id);
    gradeTurma.add(slot);
    professorOcupado.add(`${professor.id}-${slot}`);
    situacao.aulasPorDia[dia] = (situacao.aulasPorDia[dia] || 0) + 1;
    situacao.alocadas++;
    alocacoes.push({ dia_semana: dia, periodo, disciplina_id: disciplina.id, professor_id: professor.id });
    if (foraDaDisponibilidade) {
      ajustes.push({
        disciplina: disciplina.nome,
        professor: professor.nome,
        dia_semana: dia,
        periodo,
        mensagem: `${disciplina.nome}: aula na ${NOMES_DIAS[dia]}, ${periodo}ª aula, FORA da disponibilidade de ${professor.nome} (foi o horário livre mais próximo do que foi marcado).`,
      });
    }
  }

  // Fase 1: só dentro da disponibilidade. Disciplinas com mais aulas primeiro (são as mais difíceis de encaixar).
  for (const disciplina of ordenadas) {
    estado.set(disciplina.id, { aulasPorDia: {}, alocadas: 0 });
    const candidatos = professoresPreparados.filter((p) => p.disciplinas.includes(disciplina.id));
    if (candidatos.length === 0) continue;

    for (let aula = 0; aula < disciplina.aulas_semanais; aula++) {
      const { aulasPorDia } = estado.get(disciplina.id);
      let melhorOpcao = null;

      for (const dia of DIAS) {
        for (let periodo = 1; periodo <= periodosPorDia; periodo++) {
          const slot = chave(dia.numero, periodo);
          if (gradeTurma.has(slot)) continue;

          const professor = candidatos.find(
            (c) =>
              c.disponibilidade.has(slot) &&
              !professorOcupado.has(`${c.id}-${slot}`) &&
              permitido(disciplina.id, c.id, dia.numero, periodo)
          );
          if (!professor) continue;

          const carga = aulasPorDia[dia.numero] || 0;
          if (!melhorOpcao || carga < melhorOpcao.carga) melhorOpcao = { dia: dia.numero, periodo, professor, carga };
        }
      }

      if (!melhorOpcao) break;
      alocar(disciplina, melhorOpcao.professor, melhorOpcao.dia, melhorOpcao.periodo, false);
    }
  }

  // Distância do horário até a disponibilidade do professor: mesmo dia conta pela diferença de aulas;
  // outro dia pesa mais. Sem nenhuma disponibilidade informada, qualquer horário vale igual.
  function distancia(professor, dia, periodo) {
    if (professor.disponibilidade.size === 0) return 50;
    let menor = Infinity;
    for (const item of professor.disponibilidade) {
      const [d, p] = item.split('-').map(Number);
      const valor = d === dia ? Math.abs(p - periodo) : 10 + Math.abs(d - dia) * 2 + Math.abs(p - periodo) * 0.1;
      if (valor < menor) menor = valor;
    }
    return menor;
  }

  // Fase 2: o que sobrou vai para o horário livre mais próximo da disponibilidade, com aviso.
  for (const disciplina of ordenadas) {
    const candidatos = professoresPreparados.filter((p) => p.disciplinas.includes(disciplina.id));
    if (candidatos.length === 0) {
      pendencias.push({ disciplina: disciplina.nome, aulas_faltando: disciplina.aulas_semanais, motivo: 'Nenhum professor vinculado a esta disciplina.' });
      continue;
    }

    while (estado.get(disciplina.id).alocadas < disciplina.aulas_semanais) {
      const { aulasPorDia } = estado.get(disciplina.id);
      let melhor = null;

      for (const dia of DIAS) {
        for (let periodo = 1; periodo <= periodosPorDia; periodo++) {
          const slot = chave(dia.numero, periodo);
          if (gradeTurma.has(slot)) continue;
          for (const professor of candidatos) {
            if (professorOcupado.has(`${professor.id}-${slot}`)) continue;
            if (!permitido(disciplina.id, professor.id, dia.numero, periodo)) continue;
            const custo = distancia(professor, dia.numero, periodo) + (aulasPorDia[dia.numero] || 0) * 0.5;
            if (!melhor || custo < melhor.custo) melhor = { dia: dia.numero, periodo, professor, custo };
          }
        }
      }

      if (!melhor) break;
      alocar(disciplina, melhor.professor, melhor.dia, melhor.periodo, true);
    }

    const faltando = disciplina.aulas_semanais - estado.get(disciplina.id).alocadas;
    if (faltando > 0) {
      pendencias.push({
        disciplina: disciplina.nome,
        aulas_faltando: faltando,
        motivo: restricoes.length
          ? 'Não há mais horário livre na turma ou os professores já estão ocupados em outras turmas, considerando as restrições pedidas.'
          : 'Não há mais horário livre na turma ou os professores já estão ocupados em outras turmas.',
      });
    }
  }

  return { alocacoes, pendencias, ajustes };
}

module.exports = { gerarHorario };
