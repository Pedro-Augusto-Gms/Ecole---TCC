const db = require('../config/db');

const TABELAS = { rascunho: 'horarios_rascunho', publicado: 'horarios' };

const CAMPOS_HORARIO = `
  h.id, h.turma_id, h.dia_semana, h.periodo,
  d.id AS disciplina_id, d.nome AS disciplina, d.nome_completo AS disciplina_completa,
  p.id AS professor_id, p.nome AS professor
`;

// Aulas de uma turma, com nomes de disciplina e professor. `alvo` é "rascunho" ou "publicado".
async function buscarHorarios(alvo, turmaId) {
  const tabela = TABELAS[alvo];
  const { rows } = await db.query(
    `SELECT ${CAMPOS_HORARIO}
       FROM ${tabela} h
       JOIN disciplinas d ON d.id = h.disciplina_id
       JOIN professores p ON p.id = h.professor_id
      WHERE h.turma_id = $1
      ORDER BY h.dia_semana, h.periodo`,
    [turmaId]
  );
  return rows;
}

function agruparPorTurma(rows) {
  const mapa = new Map();
  for (const row of rows) {
    if (!mapa.has(row.turma_id)) mapa.set(row.turma_id, []);
    mapa.get(row.turma_id).push(row);
  }
  return mapa;
}

// Busca turmas + seus horários para exportação (uma turma ou todas).
// Quando `visao === 'rascunho'` para todas as turmas, usa o rascunho da turma se existir, senão o publicado.
async function buscarTurmasParaExportacao({ turmaId = null, visao = 'publicado' } = {}) {
  const filtro = turmaId ? 'WHERE id = $1' : '';
  const params = turmaId ? [turmaId] : [];
  const { rows: turmas } = await db.query(
    `SELECT id, nome, turno, aulas_por_dia FROM turmas ${filtro} ORDER BY nome`,
    params
  );
  if (turmas.length === 0) return [];

  const condicaoTurma = turmaId ? 'WHERE h.turma_id = $1' : '';
  const queryBase = (tabela) =>
    db.query(
      `SELECT ${CAMPOS_HORARIO}
         FROM ${tabela} h
         JOIN disciplinas d ON d.id = h.disciplina_id
         JOIN professores p ON p.id = h.professor_id
        ${condicaoTurma}
        ORDER BY h.dia_semana, h.periodo`,
      params
    );

  const [pubRes, rascRes] = await Promise.all([
    visao === 'publicado' || !turmaId ? queryBase('horarios') : Promise.resolve({ rows: [] }),
    visao === 'rascunho' ? queryBase('horarios_rascunho') : Promise.resolve({ rows: [] }),
  ]);

  const pubPorTurma = agruparPorTurma(pubRes.rows);
  const rascPorTurma = agruparPorTurma(rascRes.rows);

  const resultado = [];
  for (const turma of turmas) {
    const rasc = rascPorTurma.get(turma.id) || [];
    const pub = pubPorTurma.get(turma.id) || [];
    const horarios = visao === 'rascunho' ? (turmaId ? rasc : rasc.length ? rasc : pub) : pub;
    if (horarios.length > 0) {
      resultado.push({ turma, horarios });
    }
  }
  return resultado;
}

module.exports = { buscarHorarios, buscarTurmasParaExportacao };
