const { erroIA } = require('./erro');
const { PROMPT_EXTRACAO, PROMPT_GRADE } = require('./prompt');

const PROVEDORES = {
  gemini: require('./gemini'),
  claude: require('./claude'),
};

function interpretarJson(texto) {
  const limpo = texto.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(limpo);
  } catch (erro) {
    const inicio = limpo.indexOf('{');
    const fim = limpo.lastIndexOf('}');
    if (inicio !== -1 && fim > inicio) {
      try {
        return JSON.parse(limpo.slice(inicio, fim + 1));
      } catch (erro2) {
        // cai no erro abaixo
      }
    }
    throw erroIA(502, 'A IA devolveu uma resposta que não consegui interpretar. Tente de novo ou use uma foto mais nítida.');
  }
}

function escolherProvedor() {
  const nome = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const provedor = PROVEDORES[nome];
  if (!provedor) throw erroIA(500, `AI_PROVIDER inválido ("${nome}"). Use "gemini" ou "claude".`);
  return provedor;
}

// Envia arquivos + instruções à IA configurada em AI_PROVIDER (padrão: gemini) e devolve o JSON lido.
// opcoes.signal permite cancelar a leitura.
async function extrairDados(arquivos, prompt, opcoes = {}) {
  const texto = await escolherProvedor().extrair(arquivos, prompt, opcoes);
  return interpretarJson(texto);
}

const extrairProfessores = (arquivos, opcoes) => extrairDados(arquivos, PROMPT_EXTRACAO, opcoes);
const extrairGrade = (arquivos, opcoes) => extrairDados(arquivos, PROMPT_GRADE, opcoes);

// Pergunta só em texto (sem arquivos). Usado no chat de ajuste de horários.
const consultarIA = (prompt) => extrairDados([], prompt);

module.exports = { extrairProfessores, extrairGrade, consultarIA, interpretarJson };
