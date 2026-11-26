const db = require('../config/db');
const { gerarHorario } = require('../services/geradorHorarios');
const { registrarAtividade } = require('../utils/atividades');

async function buscarHorariosDaTurma(turmaId) {
  const { rows } = await db.query(
    `SELECT h.id, h.dia_semana, h.periodo,
            d.id AS disciplina_id, d.nome AS disciplina,
            p.id AS professor_id,  p.nome AS professor
       FROM horarios h
       JOIN disciplinas d ON d.id = h.disciplina_id
       JOIN professores p ON p.id = h.professor_id
      WHERE h.turma_id = $1
      ORDER BY h.dia_semana, h.periodo`,
    [turmaId]
  );
  return rows;
}

exports.listarPorTurma = async (req, res) => {
  res.json(await buscarHorariosDaTurma(req.params.turmaId));
};

exports.gerar = async (req, res) => {
  const turmaId = Number(req.body.turma_id);

  if (!Number.isInteger(turmaId)) {
    return res.status(400).json({ mensagem: 'Selecione uma turma.' });
  }

  // A quantidade de aulas por dia vem do cadastro da turma (ex.: 8, ou 6 em algumas turmas).
  const turma = await db.query('SELECT id, nome, aulas_por_dia FROM turmas WHERE id = $1', [turmaId]);
  if (!turma.rows[0]) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
  const periodosPorDia = turma.rows[0].aulas_por_dia;

  const disciplinas = await db.query(
    `SELECT d.id, d.nome, d.aulas_semanais
       FROM turma_disciplinas td JOIN disciplinas d ON d.id = td.disciplina_id
      WHERE td.turma_id = $1`,
    [turmaId]
  );
  if (disciplinas.rowCount === 0) {
    return res.status(400).json({ mensagem: 'Esta turma ainda não tem disciplinas. Edite a turma e selecione as disciplinas.' });
  }

  const professores = await db.query(
    `SELECT p.id, p.pontuacao,
            COALESCE((SELECT array_agg(disciplina_id) FROM professor_disciplinas WHERE professor_id = p.id), '{}'::int[]) AS disciplinas,
            COALESCE((SELECT json_agg(json_build_object('dia_semana', dia_semana, 'periodo', periodo))
                        FROM disponibilidades WHERE professor_id = p.id), '[]') AS disponibilidade
       FROM professores p`
  );

  const ocupacaoExterna = await db.query(
    'SELECT professor_id, dia_semana, periodo FROM horarios WHERE turma_id <> $1',
    [turmaId]
  );

  const { alocacoes, pendencias } = gerarHorario({
    disciplinas: disciplinas.rows,
    professores: professores.rows,
    ocupacaoExterna: ocupacaoExterna.rows,
    periodosPorDia,
  });

  await db.transacao(async (cliente) => {
    await cliente.query('DELETE FROM horarios WHERE turma_id = $1', [turmaId]);
    for (const aula of alocacoes) {
      await cliente.query(
        `INSERT INTO horarios (turma_id, disciplina_id, professor_id, dia_semana, periodo)
         VALUES ($1, $2, $3, $4, $5)`,
        [turmaId, aula.disciplina_id, aula.professor_id, aula.dia_semana, aula.periodo]
      );
    }
  });

  await registrarAtividade(`Horário da turma "${turma.rows[0].nome}" gerado`);
  res.json({ horarios: await buscarHorariosDaTurma(turmaId), pendencias });
};

exports.limparDaTurma = async (req, res) => {
  const turma = await db.query('SELECT nome FROM turmas WHERE id = $1', [req.params.turmaId]);
  if (!turma.rows[0]) return res.status(404).json({ mensagem: 'Turma não encontrada.' });

  await db.query('DELETE FROM horarios WHERE turma_id = $1', [req.params.turmaId]);
  await registrarAtividade(`Horário da turma "${turma.rows[0].nome}" removido`);
  res.status(204).send();
};
