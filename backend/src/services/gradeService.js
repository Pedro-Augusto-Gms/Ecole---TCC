const { normalizar } = require('./importacaoService');

const HORAS_POR_AULA = 40; // 40 h = 1 aula por semana, 80 h = 2, 120 h = 3, 160 h = 4
const LIMITE_NOME = 30; // nomes maiores que isso viram sigla
const PALAVRAS_DE_LIGACAO = new Set([
  'de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'as', 'os', 'em', 'na', 'no', 'nas', 'nos',
  'para', 'por', 'com', 'ao', 'aos', 'sua', 'suas', 'seu', 'seus',
]);

// "Estudos Avançados de Ciências da Natureza e suas Tecnologias" -> "EACNT"
function abreviar(nome, limite = LIMITE_NOME) {
  const limpo = String(nome || '').replace(/\s+/g, ' ').trim();
  if (limpo.length <= limite) return limpo;

  const sigla = limpo
    .split(' ')
    .filter((palavra) => !PALAVRAS_DE_LIGACAO.has(normalizar(palavra)))
    .map((palavra) => (palavra.match(/\p{L}/u) || [''])[0])
    .join('')
    .toUpperCase();

  return sigla.length >= 2 ? sigla : limpo.slice(0, limite);
}

const ROMANOS = ['', 'I', 'II', 'III', 'IV'];

// "Matemática I e II" / "Matemática I, II e III" -> { base: 'Matemática', maximo: 2 }
function detectarSequencia(nome) {
  const m = String(nome).match(/^(.*?\S)\s+((?:IV|III|II|I)(?:\s*(?:,|e|a|ao|\/|-)\s*(?:IV|III|II|I))+)$/);
  if (!m) return null;
  const numeros = m[2].match(/IV|III|II|I/g).map((r) => ROMANOS.indexOf(r));
  return { base: m[1].trim(), maximo: Math.max(...numeros) };
}

function limparTexto(valor) {
  return String(valor || '').replace(/\s+/g, ' ').trim();
}

// Confere o que a IA leu da grade curricular e converte horas em aulas por semana.
function sanitizarGrade(bruto) {
  const avisos = (Array.isArray(bruto?.avisos) ? bruto.avisos : []).map(limparTexto).filter(Boolean);
  const cursos = [];

  for (const itemCurso of Array.isArray(bruto?.cursos) ? bruto.cursos : []) {
    const curso = limparTexto(itemCurso?.curso);
    if (curso.length < 2) {
      avisos.push('Um curso sem nome foi ignorado.');
      continue;
    }

    const series = [];
    const contadores = new Map(); // matéria em sequência (I, II, III) -> quantas séries já tiveram
    const ordenadas = [...(Array.isArray(itemCurso?.series) ? itemCurso.series : [])].sort((a, b) => Number(a?.serie) - Number(b?.serie));
    for (const itemSerie of ordenadas) {
      const serie = Number(itemSerie?.serie);
      if (!Number.isInteger(serie) || serie < 1 || serie > 4) {
        avisos.push(`Uma série com número inválido em "${curso}" foi ignorada.`);
        continue;
      }

      const vistos = new Set();
      const disciplinas = [];
      for (const itemDisciplina of Array.isArray(itemSerie?.disciplinas) ? itemSerie.disciplinas : []) {
        let completo = limparTexto(itemDisciplina?.nome);
        if (completo.length < 2) continue;

        // "Matemática I e II": a 1ª série que tiver a matéria fica com I, a seguinte com II, e assim por diante.
        let sufixo = '';
        const sequencia = detectarSequencia(completo);
        if (sequencia) {
          const chave = normalizar(sequencia.base);
          const numero = (contadores.get(chave) || 0) + 1;
          contadores.set(chave, numero);
          if (numero > sequencia.maximo) {
            avisos.push(`${curso}: "${completo}" aparece em mais séries do que o previsto; usei ${ROMANOS[Math.min(numero, 4)]}.`);
          }
          sufixo = ` ${ROMANOS[Math.min(numero, 4)]}`;
          completo = sequencia.base + sufixo;
        }

        const horas = Number(String(itemDisciplina?.horas).replace(',', '.'));
        const aulas = Math.round(horas / HORAS_POR_AULA);
        if (!Number.isFinite(horas) || aulas < 1 || aulas > 20) {
          avisos.push(`${serie}ª série de ${curso}: "${completo}" sem carga horária válida, ignorada.`);
          continue;
        }
        if (horas % HORAS_POR_AULA !== 0) {
          avisos.push(`${serie}ª série de ${curso}: "${completo}" tem ${horas} h (não é múltiplo de 40); usei ${aulas} aula(s) por semana.`);
        }

        const nome = sufixo ? abreviar(completo.slice(0, -sufixo.length)) + sufixo : abreviar(completo);
        if (vistos.has(normalizar(nome))) continue;
        vistos.add(normalizar(nome));
        disciplinas.push({ nome, nome_completo: nome !== completo ? completo : null, horas, aulas_semanais: aulas });
      }

      if (disciplinas.length > 0) {
        series.push({ serie, nome_turma: `${serie}º ${curso}`.slice(0, 80), disciplinas });
      }
    }

    series.sort((a, b) => a.serie - b.serie);
    if (series.length > 0) cursos.push({ curso, series });
  }

  return { cursos, avisos };
}

module.exports = { detectarSequencia, abreviar, sanitizarGrade, HORAS_POR_AULA };
