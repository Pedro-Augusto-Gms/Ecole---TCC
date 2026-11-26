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
 * Saída: { alocacoes: [{ dia_semana, periodo, disciplina_id, professor_id }], pendencias: [...] }
 *
 * Regras: turma sem duas aulas no mesmo horário; professor só na sua disponibilidade e em uma turma
 * por vez; aulas da disciplina espalhadas pelos dias; maior pontuação tem prioridade; restrições da gestão.
 */
function gerarHorario({ disciplinas, professores, ocupacaoExterna, periodosPorDia, restricoes = [] }) {
  const chave = (dia, periodo) => `${dia}-${periodo}`;

  const professoresPreparados = professores
    .map((professor) => ({
      id: professor.id,
      pontuacao: Number(professor.pontuacao) || 0,
      disciplinas: professor.disciplinas,
      disponibilidade: new Set(professor.disponibilidade.map((d) => chave(d.dia_semana, d.periodo))),
    }))
    .sort((a, b) => b.pontuacao - a.pontuacao);

  const professorOcupado = new Set(ocupacaoExterna.map((o) => `${o.professor_id}-${chave(o.dia_semana, o.periodo)}`));
  const gradeTurma = new Set();
  const alocacoes = [];
  const pendencias = [];

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

  for (const disciplina of ordenadas) {
    const candidatos = professoresPreparados.filter((p) => p.disciplinas.includes(disciplina.id));

    if (candidatos.length === 0) {
      pendencias.push({
        disciplina: disciplina.nome,
        aulas_faltando: disciplina.aulas_semanais,
        motivo: 'Nenhum professor vinculado a esta disciplina.',
      });
      continue;
    }

    const aulasPorDia = {};
    let alocadas = 0;

    for (let aula = 0; aula < disciplina.aulas_semanais; aula++) {
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
          if (!melhorOpcao || carga < melhorOpcao.carga) {
            melhorOpcao = { dia: dia.numero, periodo, slot, professor, carga };
          }
        }
      }

      if (!melhorOpcao) break;

      gradeTurma.add(melhorOpcao.slot);
      professorOcupado.add(`${melhorOpcao.professor.id}-${melhorOpcao.slot}`);
      aulasPorDia[melhorOpcao.dia] = melhorOpcao.carga + 1;
      alocacoes.push({
        dia_semana: melhorOpcao.dia,
        periodo: melhorOpcao.periodo,
        disciplina_id: disciplina.id,
        professor_id: melhorOpcao.professor.id,
      });
      alocadas++;
    }

    if (alocadas < disciplina.aulas_semanais) {
      pendencias.push({
        disciplina: disciplina.nome,
        aulas_faltando: disciplina.aulas_semanais - alocadas,
        motivo: restricoes.length
          ? 'Sem horários livres compatíveis com a disponibilidade dos professores e as restrições pedidas.'
          : 'Sem horários livres compatíveis com a disponibilidade dos professores.',
      });
    }
  }

  return { alocacoes, pendencias };
}

module.exports = { gerarHorario };
