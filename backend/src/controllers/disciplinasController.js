const db = require('../config/db');
const { registrarAtividade } = require('../utils/atividades');

function validar(corpo) {
  const erros = [];
  const nome = (corpo.nome || '').trim();
  const aulas = Number(corpo.aulas_semanais);

  if (nome.length < 2) erros.push('Informe o nome da disciplina.');
  if (!Number.isInteger(aulas) || aulas < 1 || aulas > 20) {
    erros.push('A quantidade de aulas semanais deve ser um número entre 1 e 20.');
  }
  return { erros, dados: { nome, aulas_semanais: aulas } };
}

exports.listar = async (req, res) => {
  const { rows } = await db.query('SELECT * FROM disciplinas ORDER BY nome');
  res.json(rows);
};

exports.buscar = async (req, res) => {
  const { rows } = await db.query('SELECT * FROM disciplinas WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ mensagem: 'Disciplina não encontrada.' });
  res.json(rows[0]);
};

exports.criar = async (req, res) => {
  const { erros, dados } = validar(req.body);
  if (erros.length) return res.status(400).json({ mensagem: erros.join(' ') });

  try {
    const { rows } = await db.query(
      'INSERT INTO disciplinas (nome, aulas_semanais) VALUES ($1, $2) RETURNING *',
      [dados.nome, dados.aulas_semanais]
    );
    await registrarAtividade(`Disciplina "${dados.nome}" cadastrada`);
    res.status(201).json(rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ mensagem: 'Já existe uma disciplina com esse nome.' });
    }
    throw erro;
  }
};

exports.atualizar = async (req, res) => {
  const { erros, dados } = validar(req.body);
  if (erros.length) return res.status(400).json({ mensagem: erros.join(' ') });

  try {
    const { rows } = await db.query(
      'UPDATE disciplinas SET nome = $1, aulas_semanais = $2 WHERE id = $3 RETURNING *',
      [dados.nome, dados.aulas_semanais, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ mensagem: 'Disciplina não encontrada.' });
    await registrarAtividade(`Disciplina "${dados.nome}" atualizada`);
    res.json(rows[0]);
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({ mensagem: 'Já existe uma disciplina com esse nome.' });
    }
    throw erro;
  }
};

exports.excluir = async (req, res) => {
  const { rows } = await db.query('DELETE FROM disciplinas WHERE id = $1 RETURNING nome', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ mensagem: 'Disciplina não encontrada.' });
  await registrarAtividade(`Disciplina "${rows[0].nome}" excluída`);
  res.status(204).send();
};
