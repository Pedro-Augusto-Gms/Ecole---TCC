const db = require('../config/db');
const { estruturaDoDia } = require('../config/horarios');
const { gerarHorario } = require('../services/geradorHorarios');
const { buscarHorarios, buscarTurmasParaExportacao } = require('../services/consultasHorarios');
const { enviarExcelHorarios, slugArquivo } = require('../services/excelHorarios');
const { validarRestricoes } = require('../services/restricoesService');
const { consultarIA } = require('../services/ia');
const { montarPromptAjuste } = require('../services/ia/promptAjuste');
const { registrarAtividade } = require('../utils/atividades');

// Tudo que a tela precisa saber sobre uma turma: rascunho, grade oficial, horários do dia e regras ativas.
async function dadosDaTurma(turmaId) {
  const turma = await db.query('SELECT id, nome, turno, aulas_por_dia FROM turmas WHERE id = $1', [turmaId]);
  if (!turma.rows[0]) return null;

  const restricoes = await db.query(
    'SELECT id, turma_id, descricao FROM restricoes WHERE turma_id IS NULL OR turma_id = $1 ORDER BY id',
    [turmaId]
  );
  return {
    turma: turma.rows[0],
    estrutura: estruturaDoDia(turma.rows[0].aulas_por_dia),
    rascunho: await buscarHorarios('rascunho', turmaId),
    publicado: await buscarHorarios('publicado', turmaId),
    restricoes: restricoes.rows,
  };
}

// Gera um novo RASCUNHO para a turma, respeitando disponibilidades, conflitos e as regras da gestão.
async function gerarRascunho(turmaId) {
  const turma = await db.query('SELECT id, nome, aulas_por_dia FROM turmas WHERE id = $1', [turmaId]);
  if (!turma.rows[0]) return null;

  const disciplinas = await db.query(
    `SELECT d.id, d.nome, COALESCE(td.aulas_semanais, d.aulas_semanais) AS aulas_semanais
       FROM turma_disciplinas td JOIN disciplinas d ON d.id = td.disciplina_id
      WHERE td.turma_id = $1`,
    [turmaId]
  );
  if (disciplinas.rowCount === 0) {
    const erro = new Error('Esta turma ainda não tem disciplinas. Edite a turma e selecione as disciplinas.');
    erro.status = 400;
    throw erro;
  }

  const professores = await db.query(
    `SELECT p.id, p.nome, p.pontuacao,
            COALESCE((SELECT array_agg(disciplina_id) FROM professor_disciplinas WHERE professor_id = p.id), '{}'::int[]) AS disciplinas,
            COALESCE((SELECT json_agg(json_build_object('dia_semana', dia_semana, 'periodo', periodo))
                        FROM disponibilidades WHERE professor_id = p.id), '[]') AS disponibilidade
       FROM professores p`
  );

  // Professores já ocupados em OUTRAS turmas (grades oficiais e rascunhos)
  const ocupacao = await db.query(
    `SELECT professor_id, dia_semana, periodo FROM horarios WHERE turma_id <> $1
     UNION
     SELECT professor_id, dia_semana, periodo FROM horarios_rascunho WHERE turma_id <> $1`,
    [turmaId]
  );

  const regras = await db.query('SELECT regra FROM restricoes WHERE turma_id IS NULL OR turma_id = $1', [turmaId]);

  const { alocacoes, pendencias, ajustes } = gerarHorario({
    disciplinas: disciplinas.rows,
    professores: professores.rows,
    ocupacaoExterna: ocupacao.rows,
    periodosPorDia: turma.rows[0].aulas_por_dia,
    restricoes: regras.rows.map((r) => r.regra),
  });

  await db.transacao(async (cliente) => {
    await cliente.query('DELETE FROM horarios_rascunho WHERE turma_id = $1', [turmaId]);
    for (const aula of alocacoes) {
      await cliente.query(
        `INSERT INTO horarios_rascunho (turma_id, disciplina_id, professor_id, dia_semana, periodo)
         VALUES ($1, $2, $3, $4, $5)`,
        [turmaId, aula.disciplina_id, aula.professor_id, aula.dia_semana, aula.periodo]
      );
    }
  });

  await registrarAtividade(`Rascunho de horário da turma "${turma.rows[0].nome}" gerado`);
  return { pendencias, ajustes };
}

function responderErro(res, erro) {
  return res.status(erro.status || 500).json({ mensagem: erro.message });
}

exports.listarPorTurma = async (req, res) => {
  const dados = await dadosDaTurma(req.params.turmaId);
  if (!dados) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
  res.json(dados);
};

exports.gerar = async (req, res) => {
  const turmaId = Number(req.body.turma_id);
  if (!Number.isInteger(turmaId)) return res.status(400).json({ mensagem: 'Selecione uma turma.' });

  let resultado;
  try {
    resultado = await gerarRascunho(turmaId);
  } catch (erro) {
    if (erro.status) return responderErro(res, erro);
    throw erro;
  }
  if (resultado === null) return res.status(404).json({ mensagem: 'Turma não encontrada.' });

  res.json({ ...(await dadosDaTurma(turmaId)), pendencias: resultado.pendencias, ajustes: resultado.ajustes });
};

// A gestão aceitou o rascunho: ele vira a grade oficial, visível para os alunos.
exports.publicar = async (req, res) => {
  const turmaId = Number(req.body.turma_id);
  if (!Number.isInteger(turmaId)) return res.status(400).json({ mensagem: 'Selecione uma turma.' });

  const turma = await db.query('SELECT nome FROM turmas WHERE id = $1', [turmaId]);
  if (!turma.rows[0]) return res.status(404).json({ mensagem: 'Turma não encontrada.' });

  const rascunho = await db.query('SELECT 1 FROM horarios_rascunho WHERE turma_id = $1 LIMIT 1', [turmaId]);
  if (rascunho.rowCount === 0) return res.status(400).json({ mensagem: 'Não há rascunho para publicar. Gere o horário primeiro.' });

  try {
    await db.transacao(async (cliente) => {
      await cliente.query('DELETE FROM horarios WHERE turma_id = $1', [turmaId]);
      await cliente.query(
        `INSERT INTO horarios (turma_id, disciplina_id, professor_id, dia_semana, periodo)
         SELECT turma_id, disciplina_id, professor_id, dia_semana, periodo FROM horarios_rascunho WHERE turma_id = $1`,
        [turmaId]
      );
      await cliente.query('DELETE FROM horarios_rascunho WHERE turma_id = $1', [turmaId]);
    });
  } catch (erro) {
    if (erro.code === '23505') {
      return res.status(409).json({
        mensagem: 'Um professor deste rascunho já está em outra turma no mesmo horário (outra grade foi publicada nesse meio tempo). Gere o rascunho de novo.',
      });
    }
    throw erro;
  }

  await registrarAtividade(`Grade oficial da turma "${turma.rows[0].nome}" publicada`);
  res.json(await dadosDaTurma(turmaId));
};

exports.descartarRascunho = async (req, res) => {
  await db.query('DELETE FROM horarios_rascunho WHERE turma_id = $1', [req.params.turmaId]);
  const dados = await dadosDaTurma(req.params.turmaId);
  if (!dados) return res.status(404).json({ mensagem: 'Turma não encontrada.' });
  res.json(dados);
};

exports.despublicar = async (req, res) => {
  const turma = await db.query('SELECT nome FROM turmas WHERE id = $1', [req.params.turmaId]);
  if (!turma.rows[0]) return res.status(404).json({ mensagem: 'Turma não encontrada.' });

  await db.query('DELETE FROM horarios WHERE turma_id = $1', [req.params.turmaId]);
  await registrarAtividade(`Grade oficial da turma "${turma.rows[0].nome}" removida`);
  res.json(await dadosDaTurma(req.params.turmaId));
};

// Chat: a gestão escreve o que quer mudar, a IA vira regra, e o rascunho é refeito com ela.
exports.ajustar = async (req, res) => {
  const turmaId = Number(req.body.turma_id);
  const mensagem = String(req.body.mensagem || '').trim();

  if (!Number.isInteger(turmaId)) return res.status(400).json({ mensagem: 'Selecione uma turma.' });
  if (mensagem.length < 3 || mensagem.length > 1000) {
    return res.status(400).json({ mensagem: 'Escreva o pedido com até 1000 caracteres.' });
  }

  const turma = await db.query('SELECT id, nome FROM turmas WHERE id = $1', [turmaId]);
  if (!turma.rows[0]) return res.status(404).json({ mensagem: 'Turma não encontrada.' });

  const [disciplinas, professores, turmas] = await Promise.all([
    db.query('SELECT id, nome FROM disciplinas ORDER BY nome'),
    db.query('SELECT id, nome FROM professores ORDER BY nome'),
    db.query('SELECT id, nome FROM turmas ORDER BY nome'),
  ]);
  const contexto = { disciplinas: disciplinas.rows, professores: professores.rows, turmas: turmas.rows };

  let bruto;
  try {
    bruto = await consultarIA(montarPromptAjuste({ mensagem, turmaAtual: turma.rows[0].nome, ...contexto }));
  } catch (erro) {
    return responderErro(res, erro);
  }

  const { restricoes, avisos } = validarRestricoes(bruto, contexto);
  const resposta = String(bruto?.resposta || '').trim().slice(0, 600);

  for (const restricao of restricoes) {
    await db.query('INSERT INTO restricoes (turma_id, descricao, regra) VALUES ($1, $2, $3)', [
      restricao.turma_id,
      restricao.descricao,
      JSON.stringify(restricao.regra),
    ]);
  }

  let pendencias = [];
  let ajustes = [];
  if (restricoes.length > 0) {
    try {
      const refeito = (await gerarRascunho(turmaId)) || { pendencias: [], ajustes: [] };
      pendencias = refeito.pendencias;
      ajustes = refeito.ajustes;
    } catch (erro) {
      if (erro.status) avisos.push(erro.message);
      else throw erro;
    }
    await registrarAtividade(`Ajuste por IA na turma "${turma.rows[0].nome}": ${restricoes.map((r) => r.descricao).join('; ')}`);
  }

  res.json({
    ...(await dadosDaTurma(turmaId)),
    resposta,
    avisos,
    aplicadas: restricoes.map((r) => r.descricao),
    pendencias,
    ajustes,
  });
};

exports.removerRestricao = async (req, res) => {
  const turmaId = Number(req.query.turma_id);
  await db.query('DELETE FROM restricoes WHERE id = $1', [req.params.id]);
  const dados = Number.isInteger(turmaId) ? await dadosDaTurma(turmaId) : null;
  res.json(dados || { removida: true });
};

exports.exportarExcelTurma = async (req, res) => {
  const turmaId = Number(req.params.turmaId);
  if (!Number.isInteger(turmaId)) return res.status(400).json({ mensagem: 'Turma inválida.' });

  const visao = req.query.visao === 'publicado' ? 'publicado' : 'rascunho';
  const turmasComHorarios = await buscarTurmasParaExportacao({ turmaId, visao });
  if (turmasComHorarios.length === 0) {
    return res.status(400).json({ mensagem: 'Não há aulas nesta visão para exportar.' });
  }

  const nomeTurma = turmasComHorarios[0].turma.nome;
  await enviarExcelHorarios(res, {
    titulo: `HORÁRIO · ${nomeTurma}`,
    nomeArquivo: `horario-${slugArquivo(nomeTurma)}.xlsx`,
    turmasComHorarios,
  });
};

exports.exportarExcelGeral = async (req, res) => {
  const visao = req.query.visao === 'publicado' ? 'publicado' : 'rascunho';
  const turmasComHorarios = await buscarTurmasParaExportacao({ visao });
  if (turmasComHorarios.length === 0) {
    return res.status(400).json({ mensagem: 'Nenhuma turma possui horários para exportar.' });
  }

  await enviarExcelHorarios(res, {
    titulo: 'HORÁRIO ESCOLAR',
    nomeArquivo: 'horarios-escola.xlsx',
    turmasComHorarios,
  });
};
