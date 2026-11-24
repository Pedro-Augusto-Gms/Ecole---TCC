const { DIAS } = require('../config/horarios');

/**
 * Gerador de horários - VERSÃO INICIAL (algoritmo guloso).
 *
 * Esta é a camada que será evoluída no TCC. A assinatura (entrada/saída) pode
 * ser mantida ao trocar o algoritmo (ex.: backtracking, algoritmo genético,
 * programação por restrições), sem mexer em controllers ou frontend.
 *
 * Entrada:
 *  - disciplinas: [{ id, nome, aulas_semanais }]            disciplinas da turma
 *  - professores: [{ id, disciplinas: [ids], disponibilidade: [{ dia_semana, periodo }] }]
 *  - ocupacaoExterna: [{ professor_id, dia_semana, periodo }] aulas já alocadas em OUTRAS turmas
 *  - periodosPorDia: número de períodos considerados por dia
 *
 * Saída:
 *  - alocacoes: [{ dia_semana, periodo, disciplina_id, professor_id }]
 *  - pendencias: [{ disciplina, aulas_faltando, motivo }]
 *
 * Regras atuais:
 *  1. Uma turma não pode ter duas aulas no mesmo horário.
 *  2. O professor só é usado dentro da sua disponibilidade.
 *  3. O professor não pode estar em duas turmas no mesmo horário.
 *  4. Tenta distribuir as aulas de uma disciplina em dias diferentes.
 */
function gerarHorario({ disciplinas, professores, ocupacaoExterna, periodosPorDia }) {
  const chave = (dia, periodo) => `${dia}-${periodo}`;

  const professoresPreparados = professores.map((professor) => ({
    id: professor.id,
    disciplinas: professor.disciplinas,
    disponibilidade: new Set(professor.disponibilidade.map((d) => chave(d.dia_semana, d.periodo))),
  }));

  const professorOcupado = new Set(
    ocupacaoExterna.map((o) => `${o.professor_id}-${chave(o.dia_semana, o.periodo)}`)
  );
  const gradeTurma = new Set();
  const alocacoes = [];
  const pendencias = [];

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
            (c) => c.disponibilidade.has(slot) && !professorOcupado.has(`${c.id}-${slot}`)
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
        motivo: 'Sem horários livres compatíveis com a disponibilidade dos professores.',
      });
    }
  }

  return { alocacoes, pendencias };
}

module.exports = { gerarHorario };
