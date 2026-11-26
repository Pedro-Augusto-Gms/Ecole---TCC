const { normalizar } = require('./importacaoService');
const { minutosParaHora } = require('../config/horarios');

// Aceita "12:00", "12h", "12h30", "12".
function lerHora(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const m = String(valor).trim().toLowerCase().match(/^(\d{1,2})(?:[:h](\d{2})?)?$/);
  if (!m) return null;
  const horas = Number(m[1]);
  const minutos = Number(m[2] || 0);
  if (horas > 23 || minutos > 59) return null;
  return horas * 60 + minutos;
}

function lerDias(valor) {
  if (!Array.isArray(valor)) return undefined;
  const dias = [...new Set(valor.map(Number).filter((d) => Number.isInteger(d) && d >= 1 && d <= 5))];
  return dias.length ? dias : undefined;
}

// Acha pelo nome: igual (sem acento/caixa) ou, se só um nome contém o texto, esse (ex.: "João" -> "João da Silva").
function acharPorNome(lista, nome) {
  const alvo = normalizar(nome);
  if (!alvo) return null;
  const exato = lista.find((item) => normalizar(item.nome) === alvo);
  if (exato) return exato;
  const parecidos = lista.filter((item) => normalizar(item.nome).includes(alvo));
  return parecidos.length === 1 ? parecidos[0] : null;
}

/**
 * Nunca confia no que a IA devolveu: confere nomes, horários e dias antes de virar regra.
 * contexto: { disciplinas: [{id,nome}], professores: [{id,nome}], turmas: [{id,nome}] }
 * Devolve { restricoes: [{ turma_id, descricao, regra }], avisos: [] }
 */
function validarRestricoes(bruto, contexto) {
  const lista = Array.isArray(bruto?.restricoes) ? bruto.restricoes : [];
  const restricoes = [];
  const avisos = [];

  for (const item of lista) {
    const regra = {};
    const partes = [];

    if (item?.disciplina) {
      const disciplina = acharPorNome(contexto.disciplinas, item.disciplina);
      if (!disciplina) {
        avisos.push(`Não encontrei a disciplina "${item.disciplina}". Regra ignorada.`);
        continue;
      }
      regra.disciplina_id = disciplina.id;
      partes.push(disciplina.nome);
    }
    if (item?.professor) {
      const professor = acharPorNome(contexto.professores, item.professor);
      if (!professor) {
        avisos.push(`Não encontrei o professor "${item.professor}". Regra ignorada.`);
        continue;
      }
      regra.professor_id = professor.id;
      partes.push(professor.nome);
    }

    let turmaId = null;
    if (item?.turma) {
      const turma = acharPorNome(contexto.turmas, item.turma);
      if (!turma) {
        avisos.push(`Não encontrei a turma "${item.turma}". Regra ignorada.`);
        continue;
      }
      turmaId = turma.id;
    }

    const depois = lerHora(item?.depois_de);
    const antes = lerHora(item?.antes_de);
    if (item?.depois_de && depois === null) avisos.push(`Horário "${item.depois_de}" inválido.`);
    if (item?.antes_de && antes === null) avisos.push(`Horário "${item.antes_de}" inválido.`);
    if (depois !== null) {
      regra.depois_de = depois;
      partes.push(`a partir das ${minutosParaHora(depois)}`);
    }
    if (antes !== null) {
      regra.antes_de = antes;
      partes.push(`até as ${minutosParaHora(antes)}`);
    }

    const permitidos = lerDias(item?.dias_permitidos);
    const proibidos = lerDias(item?.dias_proibidos);
    if (permitidos) regra.dias_permitidos = permitidos;
    if (proibidos) regra.dias_proibidos = proibidos;

    if (regra.depois_de === undefined && regra.antes_de === undefined && !permitidos && !proibidos) {
      avisos.push('Uma regra sem condição de horário ou dia foi ignorada.');
      continue;
    }

    const descricao = String(item?.descricao || '').trim().slice(0, 300) || partes.join(' · ');
    restricoes.push({ turma_id: turmaId, descricao, regra });
  }

  return { restricoes, avisos };
}

module.exports = { validarRestricoes, lerHora, acharPorNome };
