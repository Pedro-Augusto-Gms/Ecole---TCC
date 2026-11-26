const db = require('../config/db');
const { MAX_PERIODOS } = require('../config/horarios');
const { registrarAtividade } = require('../utils/atividades');

const CONSULTA_BASE = `
  SELECT p.*,
    COALESCE((
      SELECT json_agg(json_build_object('id', d.id, 'nome', d.nome) ORDER BY d.nome)
      FROM professor_disciplinas pd JOIN disciplinas d ON d.id = pd.disciplina_id
      WHERE pd.professor_id = p.id
    ), '[]') AS disciplinas,
    COALESCE((
      SELECT json_agg(json_build_object('dia_semana', di.dia_semana, 'periodo', di.periodo)
                      ORDER BY di.dia_semana, di.periodo)
      FROM disponibilidades di
      WHERE di.professor_id = p.id
    ), '[]') AS disponibilidade
  FROM professores p
`;

function validar(corpo) {
  const erros = [];
  const nome = (corpo.nome || '').trim();
  const informacoes = (corpo.informacoes_adicionais || '').trim();
  const pontuacaoInformada = corpo.pontuacao === undefined || corpo.pontuacao === null || corpo.pontuacao === '' ? 0 : Number(corpo.pontuacao);
  const disciplinas = Array.isArray(corpo.disciplinas) ? corpo.disciplinas.map(Number) : [];
  const disponibilidade = Array.isArray(corpo.disponibilidade) ? corpo.disponibilidade : [];

  if (nome.length < 3) erros.push('Informe o nome completo do professor.');
  if (disciplinas.some((id) => !Number.isInteger(id))) erros.push('Lista de disciplinas inválida.');
  if (!Number.isFinite(pontuacaoInformada) || pontuacaoInformada < 0 || pontuacaoInformada > 99999) {
    erros.push('A pontuação deve ser um número maior ou igual a zero.');
  }

  const disponibilidadeValida = disponibilidade.every(
    (item) =>
      Number.isInteger(item.dia_semana) && item.dia_semana >= 1 && item.dia_semana <= 5 &&
      Number.isInteger(item.periodo) && item.periodo >= 1 && item.periodo <= MAX_PERIODOS
  );
  if (!disponibilidadeValida) erros.push('Disponibilidade de horários inválida.');

  return { erros, dados: { nome, informacoes, pontuacao: pontuacaoInformada, disciplinas, disponibilidade } };
}

async function salvarRelacionamentos(cliente, professorId, disciplinas, disponibilidade) {
  await cliente.query('DELETE FROM professor_disciplinas WHERE professor_id = $1', [professorId]);
  await cliente.query('DELETE FROM disponibilidades WHERE professor_id = $1', [professorId]);

  for (const disciplinaId of disciplinas) {
    await cliente.query(
      'INSERT INTO professor_disciplinas (professor_id, disciplina_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [professorId, disciplinaId]
    );
  }
  for (const item of disponibilidade) {
    await cliente.query(
      'INSERT INTO disponibilidades (professor_id, dia_semana, periodo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [professorId, item.dia_semana, item.periodo]
    );
  }
}

exports.listar = async (req, res) => {
  const { rows } = await db.query(`${CONSULTA_BASE} ORDER BY p.nome`);
  res.json(rows);
};

exports.buscar = async (req, res) => {
  const { rows } = await db.query(`${CONSULTA_BASE} WHERE p.id = $1`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ mensagem: 'Professor não encontrado.' });
  res.json(rows[0]);
};

exports.criar = async (req, res) => {
  const { erros, dados } = validar(req.body);
  if (erros.length) return res.status(400).json({ mensagem: erros.join(' ') });

  try {
    const id = await db.transacao(async (cliente) => {
      const { rows } = await cliente.query(
        'INSERT INTO professores (nome, informacoes_adicionais, pontuacao) VALUES ($1, $2, $3) RETURNING id',
        [dados.nome, dados.informacoes || null, dados.pontuacao]
      );
      await salvarRelacionamentos(cliente, rows[0].id, dados.disciplinas, dados.disponibilidade);
      return rows[0].id;
    });
    await registrarAtividade(`Professor(a) ${dados.nome} cadastrado(a)`);
    const { rows } = await db.query(`${CONSULTA_BASE} WHERE p.id = $1`, [id]);
    res.status(201).json(rows[0]);
  } catch (erro) {
    if (erro.code === '23503') return res.status(400).json({ mensagem: 'Disciplina informada não existe.' });
    throw erro;
  }
};

exports.atualizar = async (req, res) => {
  const { erros, dados } = validar(req.body);
  if (erros.length) return res.status(400).json({ mensagem: erros.join(' ') });

  try {
    const encontrado = await db.transacao(async (cliente) => {
      const { rowCount } = await cliente.query(
        'UPDATE professores SET nome = $1, informacoes_adicionais = $2, pontuacao = $3 WHERE id = $4',
        [dados.nome, dados.informacoes || null, dados.pontuacao, req.params.id]
      );
      if (!rowCount) return false;
      await salvarRelacionamentos(cliente, req.params.id, dados.disciplinas, dados.disponibilidade);
      return true;
    });
    if (!encontrado) return res.status(404).json({ mensagem: 'Professor não encontrado.' });

    await registrarAtividade(`Professor(a) ${dados.nome} atualizado(a)`);
    const { rows } = await db.query(`${CONSULTA_BASE} WHERE p.id = $1`, [req.params.id]);
    res.json(rows[0]);
  } catch (erro) {
    if (erro.code === '23503') return res.status(400).json({ mensagem: 'Disciplina informada não existe.' });
    throw erro;
  }
};

exports.excluir = async (req, res) => {
  const { rows } = await db.query('DELETE FROM professores WHERE id = $1 RETURNING nome', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ mensagem: 'Professor não encontrado.' });
  await registrarAtividade(`Professor(a) ${rows[0].nome} excluído(a)`);
  res.status(204).send();
};
