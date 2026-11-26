const db = require('../config/db');
const { extrairProfessores, extrairGrade } = require('../services/ia');
const { sanitizarGrade } = require('../services/gradeService');
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

  // Se a gestão cancelar no site, a conexão fecha e a chamada à IA também é cancelada.
  const cancelador = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) cancelador.abort();
  });

  let bruto;
  try {
    bruto = await extrairProfessores(arquivos, { signal: cancelador.signal });
  } catch (erro) {
    if (erro.status === 499) return undefined;
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

// ---------------------------------------------------------------------------
// Grade curricular: a IA lê curso, séries e horas de cada disciplina.
// ---------------------------------------------------------------------------
const TURNOS = ['Integral', 'Manhã', 'Noite'];

function validarArquivos(arquivos) {
  if (arquivos.length === 0) return 'Envie pelo menos um arquivo.';
  if (arquivos.length > MAX_ARQUIVOS) return `Envie no máximo ${MAX_ARQUIVOS} arquivos por vez.`;
  for (const arquivo of arquivos) {
    if (!TIPOS_ACEITOS.includes(arquivo?.tipo) || typeof arquivo?.dados !== 'string' || !arquivo.dados) {
      return `Arquivo "${arquivo?.nome || '?'}" não aceito. Use foto (JPG, PNG, WEBP), PDF ou texto.`;
    }
  }
  return null;
}

// Passo 1: devolve uma PRÉVIA das turmas e disciplinas. Nada é gravado aqui.
exports.lerGrade = async (req, res) => {
  const arquivos = Array.isArray(req.body.arquivos) ? req.body.arquivos : [];
  const problema = validarArquivos(arquivos);
  if (problema) return res.status(400).json({ mensagem: problema });

  const cancelador = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) cancelador.abort();
  });

  let bruto;
  try {
    bruto = await extrairGrade(arquivos, { signal: cancelador.signal });
  } catch (erro) {
    if (erro.status === 499) return undefined;
    return res.status(erro.status || 502).json({ mensagem: erro.message });
  }

  const { cursos, avisos } = sanitizarGrade(bruto);
  const turmasExistentes = new Set((await db.query('SELECT nome FROM turmas')).rows.map((t) => normalizar(t.nome)));
  const disciplinasExistentes = new Set((await db.query('SELECT nome FROM disciplinas')).rows.map((d) => normalizar(d.nome)));

  res.json({
    cursos: cursos.map((curso) => ({
      ...curso,
      series: curso.series.map((serie) => ({
        ...serie,
        turno: 'Integral',
        aulas_por_dia: 8,
        ja_existe: turmasExistentes.has(normalizar(serie.nome_turma)),
        disciplinas: serie.disciplinas.map((d) => ({ ...d, existe: disciplinasExistentes.has(normalizar(d.nome)) })),
      })),
    })),
    avisos,
  });
};

// Passo 2: a gestão conferiu a prévia. Cria as turmas, as disciplinas e as aulas por semana de cada uma.
exports.confirmarGrade = async (req, res) => {
  const recebidas = Array.isArray(req.body.turmas) ? req.body.turmas : [];
  if (recebidas.length === 0) return res.status(400).json({ mensagem: 'Não há turmas para salvar.' });

  const resumo = { turmas_criadas: 0, turmas_atualizadas: 0, disciplinas_criadas: 0, avisos: [] };

  try {
  await db.transacao(async (cliente) => {
    const idDisciplina = new Map((await cliente.query('SELECT id, nome FROM disciplinas')).rows.map((d) => [normalizar(d.nome), d.id]));
    const idTurma = new Map((await cliente.query('SELECT id, nome FROM turmas')).rows.map((t) => [normalizar(t.nome), t.id]));

    for (const item of recebidas) {
      const nome = String(item?.nome_turma || '').trim().slice(0, 80);
      const turno = TURNOS.includes(item?.turno) ? item.turno : 'Integral';
      const aulasPorDia = Number(item?.aulas_por_dia || 8);

      if (nome.length < 2) {
        resumo.avisos.push('Uma turma sem nome foi ignorada.');
        continue;
      }
      if (!Number.isInteger(aulasPorDia) || aulasPorDia < 1 || aulasPorDia > 8) {
        resumo.avisos.push(`Turma "${nome}" ignorada: aulas por dia deve ficar entre 1 e 8.`);
        continue;
      }

      let turmaId = idTurma.get(normalizar(nome));
      if (turmaId) {
        await cliente.query('UPDATE turmas SET nome = $1, turno = $2, aulas_por_dia = $3 WHERE id = $4', [nome, turno, aulasPorDia, turmaId]);
        await cliente.query('DELETE FROM turma_disciplinas WHERE turma_id = $1', [turmaId]);
        resumo.turmas_atualizadas++;
      } else {
        const { rows } = await cliente.query('INSERT INTO turmas (nome, turno, aulas_por_dia) VALUES ($1, $2, $3) RETURNING id', [nome, turno, aulasPorDia]);
        turmaId = rows[0].id;
        idTurma.set(normalizar(nome), turmaId);
        resumo.turmas_criadas++;
      }

      for (const disciplina of Array.isArray(item.disciplinas) ? item.disciplinas : []) {
        const nomeDisciplina = String(disciplina?.nome || '').trim().slice(0, 120);
        const aulas = Number(disciplina?.aulas_semanais);
        if (nomeDisciplina.length < 2 || !Number.isInteger(aulas) || aulas < 1 || aulas > 20) {
          resumo.avisos.push(`${nome}: disciplina "${nomeDisciplina || '?'}" ignorada (nome ou aulas por semana inválidos).`);
          continue;
        }

        let disciplinaId = idDisciplina.get(normalizar(nomeDisciplina));
        if (!disciplinaId) {
          const completo = String(disciplina?.nome_completo || '').trim().slice(0, 250) || null;
          const { rows } = await cliente.query(
            'INSERT INTO disciplinas (nome, aulas_semanais, nome_completo) VALUES ($1, $2, $3) RETURNING id',
            [nomeDisciplina, aulas, completo]
          );
          disciplinaId = rows[0].id;
          idDisciplina.set(normalizar(nomeDisciplina), disciplinaId);
          resumo.disciplinas_criadas++;
        }

        await cliente.query(
          `INSERT INTO turma_disciplinas (turma_id, disciplina_id, aulas_semanais) VALUES ($1, $2, $3)
           ON CONFLICT (turma_id, disciplina_id) DO UPDATE SET aulas_semanais = EXCLUDED.aulas_semanais`,
          [turmaId, disciplinaId, aulas]
        );
      }
    }
  });
  } catch (erro) {
    console.error('Erro ao salvar a grade curricular:', erro);
    return res.status(500).json({ mensagem: `Não foi possível salvar a grade: ${erro.detail || erro.message}` });
  }

  await registrarAtividade(
    `Importação da grade curricular: ${resumo.turmas_criadas} turma(s) nova(s), ${resumo.turmas_atualizadas} atualizada(s), ${resumo.disciplinas_criadas} disciplina(s) criada(s)`
  );
  res.json(resumo);
};
