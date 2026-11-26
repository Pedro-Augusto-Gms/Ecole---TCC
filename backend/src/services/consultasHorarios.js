const db = require('../config/db');

const TABELAS = { rascunho: 'horarios_rascunho', publicado: 'horarios' };

// Aulas de uma turma, com nomes de disciplina e professor. `alvo` é "rascunho" ou "publicado".
async function buscarHorarios(alvo, turmaId) {
  const tabela = TABELAS[alvo];
  const { rows } = await db.query(
    `SELECT h.id, h.dia_semana, h.periodo,
            d.id AS disciplina_id, d.nome AS disciplina,
            p.id AS professor_id,  p.nome AS professor
       FROM ${tabela} h
       JOIN disciplinas d ON d.id = h.disciplina_id
       JOIN professores p ON p.id = h.professor_id
      WHERE h.turma_id = $1
      ORDER BY h.dia_semana, h.periodo`,
    [turmaId]
  );
  return rows;
}

module.exports = { buscarHorarios };
