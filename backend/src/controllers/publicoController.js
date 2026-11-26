const db = require('../config/db');
const { estruturaDoDia } = require('../config/horarios');
const { buscarHorarios } = require('../services/consultasHorarios');

// Rotas PÚBLICAS (sem login): os alunos só consultam as grades já publicadas pela gestão.
exports.turmas = async (req, res) => {
  const { rows } = await db.query(
    `SELECT DISTINCT t.id, t.nome, t.turno
       FROM turmas t JOIN horarios h ON h.turma_id = t.id
      ORDER BY t.nome`
  );
  res.json(rows);
};

exports.grade = async (req, res) => {
  const turma = await db.query('SELECT id, nome, turno, aulas_por_dia FROM turmas WHERE id = $1', [req.params.turmaId]);
  if (!turma.rows[0]) return res.status(404).json({ mensagem: 'Turma não encontrada.' });

  res.json({
    turma: { id: turma.rows[0].id, nome: turma.rows[0].nome, turno: turma.rows[0].turno },
    estrutura: estruturaDoDia(turma.rows[0].aulas_por_dia),
    horarios: await buscarHorarios('publicado', turma.rows[0].id),
  });
};
