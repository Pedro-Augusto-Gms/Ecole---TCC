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
 * Matérias com 2+ aulas/semana ganham aulas seguidas (3 aulas = dupla + 1 em outro dia; 4 = duas duplas).
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
  const totalAulasDia = {};
  const alocacoes = [];
  const pendencias = [];
  const ajustes = [];

  function temEvitarDiasSeguidos(disciplinaId, professorId) {
    return restricoes.some((regra) => {
      if (regra.disciplina_id && regra.disciplina_id !== disciplinaId) return false;
      if (regra.professor_id && regra.professor_id !== professorId) return false;
      return Boolean(regra.evitar_dias_seguidos);
    });
  }

  function contarDiasAdjacentes(aulasPorDia, dia) {
    return (aulasPorDia[dia - 1] ? 1 : 0) + (aulasPorDia[dia + 1] ? 1 : 0);
  }

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
    totalAulasDia[dia] = (totalAulasDia[dia] || 0) + 1;
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

  // Duas aulas são "seguidas" se a segunda começa quando a primeira termina (sem intervalo ou almoço no meio).
  function seguidos(periodo) {
    const a = intervaloDoPeriodo(periodosPorDia, periodo);
    const b = intervaloDoPeriodo(periodosPorDia, periodo + 1);
    return Boolean(a && b && a.fim === b.inicio);
  }

  // 2 aulas = 1 dupla; 3 = dupla + 1; 4 = 2 duplas; 5 = 2 duplas + 1... (1 aula por semana fica sozinha)
  function blocosDaDisciplina(aulas) {
    const blocos = Array(Math.floor(aulas / 2)).fill(2);
    if (aulas % 2) blocos.push(1);
    return blocos;
  }

  // Uma aula avulsa dentro da disponibilidade, evitando repetir dia ou colocar em dias seguidos e equilibrando os dias.
  function tentarAvulsa(disciplina, candidatos) {
    const { aulasPorDia } = estado.get(disciplina.id);
    let melhor = null;
    for (const dia of DIAS) {
      for (let periodo = 1; periodo <= periodosPorDia; periodo++) {
        const slot = chave(dia.numero, periodo);
        if (gradeTurma.has(slot)) continue;
        const idxProfessor = candidatos.findIndex(
          (c) => c.disponibilidade.has(slot) && !professorOcupado.has(`${c.id}-${slot}`) && permitido(disciplina.id, c.id, dia.numero, periodo)
        );
        if (idxProfessor === -1) continue;
        const professor = candidatos[idxProfessor];
        const aulasNoDia = aulasPorDia[dia.numero] || 0;
        const adjacentes = contarDiasAdjacentes(aulasPorDia, dia.numero);
        const cargaDia = totalAulasDia[dia.numero] || 0;
        const pesoAdjacente = temEvitarDiasSeguidos(disciplina.id, professor.id) ? 500 : 50;
        const custo = aulasNoDia * 1000 + adjacentes * pesoAdjacente + cargaDia * 2 + periodo * 0.05 + idxProfessor * 0.001;
        if (!melhor || custo < melhor.custo) melhor = { dia: dia.numero, periodo, professor, custo };
      }
    }
    if (!melhor) return false;
    alocar(disciplina, melhor.professor, melhor.dia, melhor.periodo, false);
    return true;
  }

  // Duas aulas seguidas, com o mesmo professor, no mesmo dia. `estrito`: ambas dentro da disponibilidade.
  function tentarDupla(disciplina, candidatos, estrito) {
    const estadoDisciplina = estado.get(disciplina.id);
    let melhor = null;
    for (const dia of DIAS) {
      for (let periodo = 1; periodo < periodosPorDia; periodo++) {
        if (!seguidos(periodo)) continue;
        const slotA = chave(dia.numero, periodo);
        const slotB = chave(dia.numero, periodo + 1);
        if (gradeTurma.has(slotA) || gradeTurma.has(slotB)) continue;
        for (let idxProfessor = 0; idxProfessor < candidatos.length; idxProfessor++) {
          const professor = candidatos[idxProfessor];
          if (professorOcupado.has(`${professor.id}-${slotA}`) || professorOcupado.has(`${professor.id}-${slotB}`)) continue;
          if (!permitido(disciplina.id, professor.id, dia.numero, periodo) || !permitido(disciplina.id, professor.id, dia.numero, periodo + 1)) continue;
          if (estrito && !(professor.disponibilidade.has(slotA) && professor.disponibilidade.has(slotB))) continue;
          const aulasNoDia = estadoDisciplina.aulasPorDia[dia.numero] || 0;
          const adjacentes = contarDiasAdjacentes(estadoDisciplina.aulasPorDia, dia.numero);
          const cargaDia = totalAulasDia[dia.numero] || 0;
          const evitarSeguidos = temEvitarDiasSeguidos(disciplina.id, professor.id);
          const custo = estrito
            ? aulasNoDia * 1000 + adjacentes * (evitarSeguidos ? 500 : 50) + cargaDia * 2 + periodo * 0.05 + idxProfessor * 0.001
            : aulasNoDia * 100 +
              adjacentes * (evitarSeguidos ? 30 : 4) +
              cargaDia * 0.5 +
              distancia(professor, dia.numero, periodo) +
              distancia(professor, dia.numero, periodo + 1) +
              periodo * 0.01 +
              idxProfessor * 0.001;
          if (!melhor || custo < melhor.custo) melhor = { dia: dia.numero, periodo, professor, custo };
        }
      }
    }
    if (!melhor) return false;
    for (const periodo of [melhor.periodo, melhor.periodo + 1]) {
      alocar(disciplina, melhor.professor, melhor.dia, periodo, !melhor.professor.disponibilidade.has(chave(melhor.dia, periodo)));
    }
    estadoDisciplina.temDupla = true;
    return true;
  }

  // Fase 1: só dentro da disponibilidade. Disciplinas com mais aulas primeiro (são as mais difíceis de encaixar).
  for (const disciplina of ordenadas) {
    estado.set(disciplina.id, { aulasPorDia: {}, alocadas: 0, temDupla: false });
    const candidatos = professoresPreparados.filter((p) => p.disciplinas.includes(disciplina.id));
    if (candidatos.length === 0) continue;

    for (const bloco of blocosDaDisciplina(disciplina.aulas_semanais)) {
      if (bloco === 2 && tentarDupla(disciplina, candidatos, true)) continue;
      // Sem dupla possível (ou aula única): coloca avulsas
      for (let i = 0; i < bloco; i++) {
        if (!tentarAvulsa(disciplina, candidatos)) break;
      }
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
      const { aulasPorDia, alocadas, temDupla } = estado.get(disciplina.id);
      if (!temDupla && disciplina.aulas_semanais - alocadas >= 2 && tentarDupla(disciplina, candidatos, false)) continue;
      let melhor = null;

      for (const dia of DIAS) {
        for (let periodo = 1; periodo <= periodosPorDia; periodo++) {
          const slot = chave(dia.numero, periodo);
          if (gradeTurma.has(slot)) continue;
          for (let idxProfessor = 0; idxProfessor < candidatos.length; idxProfessor++) {
            const professor = candidatos[idxProfessor];
            if (professorOcupado.has(`${professor.id}-${slot}`)) continue;
            if (!permitido(disciplina.id, professor.id, dia.numero, periodo)) continue;
            const aulasNoDia = aulasPorDia[dia.numero] || 0;
            const adjacentes = contarDiasAdjacentes(aulasPorDia, dia.numero);
            const cargaDia = totalAulasDia[dia.numero] || 0;
            const pesoAdjacente = temEvitarDiasSeguidos(disciplina.id, professor.id) ? 30 : 4;
            const custo =
              distancia(professor, dia.numero, periodo) +
              aulasNoDia * 100 +
              adjacentes * pesoAdjacente +
              cargaDia * 0.5 +
              periodo * 0.01 +
              idxProfessor * 0.001;
            if (!melhor || custo < melhor.custo) melhor = { dia: dia.numero, periodo, professor, custo };
          }
        }
      }

      if (!melhor) break;
      alocar(disciplina, melhor.professor, melhor.dia, melhor.periodo, !melhor.professor.disponibilidade.has(chave(melhor.dia, melhor.periodo)));
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
