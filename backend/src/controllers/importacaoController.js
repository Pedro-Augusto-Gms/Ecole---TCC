const db = require('../config/db');
const { extrairProfessores } = require('../services/ia');
const { normalizar, numeroOuNull, sanitizarDisponibilidade, sanitizarResultado } = require('../services/importacaoService');
const { registrarAtividade } = require('../utils/atividades');

const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf', 'text/plain'];
const MAX_ARQUIVOS = 6;

// Passo 1: a IA lê os arquivos e devolve uma PRÉVIA. Nada é gravado aqui.
exports.ler = async (req, res) => {
  const arquivos = Array.isArray(req.body.arquivos) ? req.body.arquivos : [];

  if (arquivos.length === 0) return res.status(400).json({ mensagem: 'Envie pelo menos um arquivo.' });
  if (arquivos.length > MAX_ARQUIVOS) return res.status(400).json({ mensagem: `Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.` });

  for (const arquivo of arquivos) {
    if (!TIPOS_ACEITOS.includes(arquivo?.tipo) || typeof arquivo?.dados !== 'string' || !arquivo.dados) {
      return res.status(400).json({
        mensagem: `Arquivo "${arquivo?.nome || '?'}" não aceito. Use foto (JPG, PNG, WEBP), PDF ou texto.`,
      });
    }
  }

  let bruto;
  try {
    bruto = await extrairProfessores(arquivos);
  } catch (erro) {
    return res.status(erro.status || 502).json({ mensagem: erro.message });
  }

  const { professores, avisos } = sanitizarResultado(bruto);

  const disciplinas = await db.query('SELECT id, nome FROM disciplinas ORDER BY nome');
  const idPorNome = new Map(disciplinas.rows.map((d) => [normalizar(d.nome), d.id]));
  const cadastrados = await db.query('SELECT nome FROM professores');
  const professoresExistentes = new Set(cadastrados.rows.map((p) => normalizar(p.nome)));

  res.json({
    professores: professores.map((p) => ({
      ...p,
      ja_existe: professoresExistentes.has(normalizar(p.nome)),
      disciplinas: p.disciplinas.map((nome) => ({ nome, id: idPorNome.get(normalizar(nome)) || null })),
    })),
    avisos,
    disciplinas_existentes: disciplinas.rows,
  });
};

// Passo 2: a gestão revisou a prévia e confirmou. Aqui sim grava no banco.
exports.confirmar = async (req, res) => {
  const recebidos = Array.isArray(req.body.professores) ? req.body.professores : [];
  const novasDisciplinas = Array.isArray(req.body.novas_disciplinas) ? req.body.novas_disciplinas : [];

  if (recebidos.length === 0) return res.status(400).json({ mensagem: 'Não há professores para salvar.' });

  const resumo = { criados: 0, atualizados: 0, disciplinas_criadas: 0, avisos: [] };

  await db.transacao(async (cliente) => {
    const idPorDisciplina = new Map();
    (await cliente.query('SELECT id, nome FROM disciplinas')).rows.forEach((d) => idPorDisciplina.set(normalizar(d.nome), d.id));

    // Cria as disciplinas novas (as que a IA leu e ainda não existiam)
    for (const nova of novasDisciplinas) {
      const nome = String(nova?.nome || '').trim();
      const aulas = Number(nova?.aulas_semanais);
      if (nome.length < 2 || idPorDisciplina.has(normalizar(nome))) continue;
      if (!Number.isInteger(aulas) || aulas < 1 || aulas > 20) {
        resumo.avisos.push(`Disciplina "${nome}" ignorada: aulas semanais deve ficar entre 1 e 20.`);
        continue;
      }
      const { rows } = await cliente.query('INSERT INTO disciplinas (nome, aulas_semanais) VALUES ($1, $2) RETURNING id', [nome, aulas]);
      idPorDisciplina.set(normalizar(nome), rows[0].id);
      resumo.disciplinas_criadas++;
    }

    const idPorProfessor = new Map();
    (await cliente.query('SELECT id, nome FROM professores')).rows.forEach((p) => idPorProfessor.set(normalizar(p.nome), p.id));

    for (const item of recebidos) {
      const nome = String(item?.nome || '').trim();
      if (nome.length < 3) {
        resumo.avisos.push(`Um professor sem nome válido foi ignorado.`);
        continue;
      }

      const pontuacao = numeroOuNull(item.pontuacao) ?? 0;
      const informacoes = String(item.informacoes_adicionais || '').trim() || null;
      const disponibilidade = sanitizarDisponibilidade(item.disponibilidade);

      const idsDisciplinas = new Set();
      for (const nomeDisciplina of Array.isArray(item.disciplinas) ? item.disciplinas : []) {
        const id = idPorDisciplina.get(normalizar(nomeDisciplina));
        if (id) idsDisciplinas.add(id);
        else resumo.avisos.push(`${nome}: disciplina "${nomeDisciplina}" não existe e não foi vinculada.`);
      }

      let professorId = idPorProfessor.get(normalizar(nome));
      if (professorId) {
        // Professor já cadastrado: o novo formulário substitui disciplinas e disponibilidade
        await cliente.query(
          'UPDATE professores SET nome = $1, pontuacao = $2, informacoes_adicionais = COALESCE($3, informacoes_adicionais) WHERE id = $4',
          [nome, pontuacao, informacoes, professorId]
        );
        await cliente.query('DELETE FROM professor_disciplinas WHERE professor_id = $1', [professorId]);
        await cliente.query('DELETE FROM disponibilidades WHERE professor_id = $1', [professorId]);
        resumo.atualizados++;
      } else {
        const { rows } = await cliente.query(
          'INSERT INTO professores (nome, pontuacao, informacoes_adicionais) VALUES ($1, $2, $3) RETURNING id',
          [nome, pontuacao, informacoes]
        );
        professorId = rows[0].id;
        idPorProfessor.set(normalizar(nome), professorId);
        resumo.criados++;
      }

      for (const disciplinaId of idsDisciplinas) {
        await cliente.query('INSERT INTO professor_disciplinas (professor_id, disciplina_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [professorId, disciplinaId]);
      }
      for (const { dia_semana, periodo } of disponibilidade) {
        await cliente.query('INSERT INTO disponibilidades (professor_id, dia_semana, periodo) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [professorId, dia_semana, periodo]);
      }
    }
  });

  await registrarAtividade(
    `Importação por IA: ${resumo.criados} professor(es) novo(s), ${resumo.atualizados} atualizado(s), ${resumo.disciplinas_criadas} disciplina(s) criada(s)`
  );
  res.json(resumo);
};
