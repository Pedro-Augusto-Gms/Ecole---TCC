const { MAX_PERIODOS } = require('../config/horarios');

// Remove acentos, caixa e espaços extras para comparar nomes ("Matemática" = "matematica ").
function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function numeroOuNull(valor) {
  if (valor === null || valor === undefined || valor === '') return null;
  const numero = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(numero) || numero < 0 || numero > 99999) return null;
  return Math.round(numero * 100) / 100;
}

function unicosPorNome(lista) {
  const vistos = new Set();
  return lista.filter((item) => {
    const chave = normalizar(item);
    if (!chave || vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
}

// Converte o item lido pela IA em número de período (1 a 8).
// Formulário da escola: 6 aulas na manhã e 6 na tarde, mas no dia real só valem
//   manhã 1-6  -> períodos 1-6   (a 6ª da manhã é a 6ª aula, 12:30, das turmas de 6 aulas)
//   tarde 1-3  -> períodos 6-8   (as 3 últimas aulas do dia); tarde 4-6 não existem e são ignoradas
function periodoDoItem(item) {
  if (item?.turno !== undefined && item?.turno !== null && item?.aula !== undefined) {
    const turno = normalizar(item.turno);
    const aula = Number(item.aula);
    if (!Number.isInteger(aula) || aula < 1) return null;
    if (turno.startsWith('manha')) return aula <= 6 ? aula : null;
    if (turno.startsWith('tarde')) return aula <= 3 ? 5 + aula : null;
    return null;
  }
  return Number(item?.periodo);
}

// Mantém só pares válidos (dia 1-5, período 1-MAX_PERIODOS) e sem repetição.
function sanitizarDisponibilidade(lista) {
  if (!Array.isArray(lista)) return [];
  const vistos = new Set();
  const resultado = [];
  for (const item of lista) {
    const dia = Number(item?.dia_semana);
    const periodo = periodoDoItem(item);
    if (!Number.isInteger(dia) || dia < 1 || dia > 5) continue;
    if (!Number.isInteger(periodo) || periodo < 1 || periodo > MAX_PERIODOS) continue;
    const chave = `${dia}-${periodo}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    resultado.push({ dia_semana: dia, periodo });
  }
  return resultado.sort((a, b) => a.dia_semana - b.dia_semana || a.periodo - b.periodo);
}

// Nunca confia no que a IA devolveu: limpa e valida tudo antes de mostrar na prévia.
function sanitizarResultado(bruto) {
  const lista = Array.isArray(bruto?.professores) ? bruto.professores : [];
  const professores = lista
    .map((p) => ({
      nome: String(p?.nome || '').trim(),
      pontuacao: numeroOuNull(p?.pontuacao),
      disciplinas: unicosPorNome((Array.isArray(p?.disciplinas) ? p.disciplinas : []).map((d) => String(d || '').trim())),
      disponibilidade: sanitizarDisponibilidade(p?.disponibilidade),
      informacoes_adicionais: String(p?.informacoes_adicionais || '').trim(),
    }))
    .filter((p) => p.nome.length >= 2);

  const avisos = (Array.isArray(bruto?.avisos) ? bruto.avisos : []).map((a) => String(a || '').trim()).filter(Boolean);
  return { professores, avisos };
}

module.exports = { normalizar, numeroOuNull, sanitizarDisponibilidade, sanitizarResultado };
