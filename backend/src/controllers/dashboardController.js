const db = require('../config/db');

exports.resumo = async (req, res) => {
  const [professores, turmas, disciplinas, atividades] = await Promise.all([
    db.query('SELECT COUNT(*)::int AS total FROM professores'),
    db.query('SELECT COUNT(*)::int AS total FROM turmas'),
    db.query('SELECT COUNT(*)::int AS total FROM disciplinas'),
    db.query('SELECT id, descricao, criado_em FROM atividades ORDER BY criado_em DESC, id DESC LIMIT 8'),
  ]);

  res.json({
    totais: {
      professores: professores.rows[0].total,
      turmas: turmas.rows[0].total,
      disciplinas: disciplinas.rows[0].total,
    },
    atividades: atividades.rows,
  });
};
