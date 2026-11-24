const db = require('../config/db');
const { registrarAtividade } = require('../utils/atividades');

const TURNOS = ['Integral', 'Manhã', 'Noite'];

const CONSULTA_BASE = `
  SELECT t.*,
    COALESCE((
      SELECT json_agg(json_build_object('id', d.id, 'nome', d.nome, 'aulas_semanais', d.aulas_semanais) ORDER BY d.nome)
      FROM turma_disciplinas td JOIN disciplinas d ON d.id = td.disciplina_id
      WHERE td.turma_id = t.id
    ), '[]') AS disciplinas
  FROM turmas t
`;

function validar(corpo) {
  const erros = [];
  const nome = (corpo.nome || '').trim();
  const turno = corpo.turno || 'Integral';
  const aulasPorDia = Number(corpo.aulas_por_dia || 8);
  const disciplinas = Array.isArray(corpo.disciplinas) ? corpo.disciplinas.map(Number) : [];

  if (nome.length < 2) erros.push('Informe o nome da turma.');
  if (!TURNOS.includes(turno)) erros.push('Turno inválido.');
  if (!Number.isInteger(aulasPorDia) || aulasPorDia < 1 || aulasPorDia > 8) {
    erros.push('A quantidade de aulas por dia deve ser um número entre 1 e 8.');
  }
  if (disciplinas.some((id) => !Number.isInteger(id))) erros.push('Lista de disciplinas inválida.');

  return { erros, dados: { nome, turno, aulas_por_dia: aulasPorDia, disciplinas } };
}

async function salvarDisciplinas(cliente, turmaId, disciplinas) {
  await cliente.query('DELETE FROM turma_disciplinas WHERE turma_id = $1', [turmaId]);
  for (const disciplinaId of disciplinas) {
    await cliente.query(
      'INSERT INTO turma_disciplinas (turma_id, disciplina_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [turmaId, disciplinaId]
    );
  }
}

exports.listar = async (req, res) => {
  const { rows } = await db.query(`${CONSULTA_BASE} ORDER BY t.nome`);
  res.json(rows);
};

exports.buscar = async (req, res) => {
  const { rows } = await db.query(`${CONSULTA_BASE} WHERE t.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
  res.json(rows[0]);
};

exports.criar = async (req, res) => {
  const { erros, dados } = validar(req.body);
  if (erros.length) return res.status(400).json({ mensagem: erros.join(' ') });

  try {
    const id = await db.transacao(async (cliente) => {
      const { rows } = await cliente.query(
        'INSERT INTO turmas (nome, turno, aulas_por_dia) VALUES ($1, $2, $3) RETURNING id',
        [dados.nome, dados.turno, dados.aulas_por_dia]
      );
      await salvarDisciplinas(cliente, rows[0].id, dados.disciplinas);
      return rows[0].id;
    });
    await registrarAtividade(`Turma "${dados.nome}" cadastrada`);
    const { rows } = await db.query(`${CONSULTA_BASE} WHERE t.id = $1`, [id]);
    res.status(201).json(rows[0]);
  } catch (erro) {
    if (erro.code === '23505') return res.status(409).json({ mensagem: 'Já existe uma turma com esse nome.' });
    if (erro.code === '23503') return res.status(400).json({ mensagem: 'Disciplina informada não existe.' });
    throw erro;
  }
};

exports.atualizar = async (req, res) => {
  const { erros, dados } = validar(req.body);
  if (erros.length) return res.status(400).json({ mensagem: erros.join(' ') });

  try {
    const encontrada = await db.transacao(async (cliente) => {
      const { rowCount } = await cliente.query(
        'UPDATE turmas SET nome = $1, turno = $2, aulas_por_dia = $3 WHERE id = $4',
        [dados.nome, dados.turno, dados.aulas_por_dia, req.params.id]
      );
      if (!rowCount) return false;
      await salvarDisciplinas(cliente, req.params.id, dados.disciplinas);
      return true;
    });
    if (!encontrada) return res.status(404).json({ mensagem: 'Turma não encontrada.' });

    await registrarAtividade(`Turma "${dados.nome}" atualizada`);
    const { rows } = await db.query(`${CONSULTA_BASE} WHERE t.id = $1`, [req.params.id]);
    res.json(rows[0]);
  } catch (erro) {
    if (erro.code === '23505') return res.status(409).json({ mensagem: 'Já existe uma turma com esse nome.' });
    if (erro.code === '23503') return res.status(400).json({ mensagem: 'Disciplina informada não existe.' });
    throw erro;
  }
};

exports.excluir = async (req, res) => {
  const { rows } = await db.query('DELETE FROM turmas WHERE id = $1 RETURNING nome', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
  await registrarAtividade(`Turma "${rows[0].nome}" excluída`);
  res.status(204).send();
};
