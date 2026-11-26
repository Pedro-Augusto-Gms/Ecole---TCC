const { erroIA } = require('./erro');
const { PROMPT_EXTRACAO } = require('./prompt');

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

// Envia os arquivos para a IA configurada em AI_PROVIDER (padrão: gemini) e devolve o JSON bruto.
async function extrairProfessores(arquivos) {
  const nome = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const provedor = PROVEDORES[nome];
  if (!provedor) throw erroIA(500, `AI_PROVIDER inválido ("${nome}"). Use "gemini" ou "claude".`);

  const texto = await provedor.extrair(arquivos, PROMPT_EXTRACAO);
  return interpretarJson(texto);
}

// Pergunta só em texto (sem arquivos) e devolve o JSON da resposta. Usado no chat de ajuste de horários.
async function consultarIA(prompt) {
  const nome = (process.env.AI_PROVIDER || 'gemini').toLowerCase();
  const provedor = PROVEDORES[nome];
  if (!provedor) throw erroIA(500, `AI_PROVIDER inválido ("${nome}"). Use "gemini" ou "claude".`);

  const texto = await provedor.extrair([], prompt);
  return interpretarJson(texto);
}

module.exports = { extrairProfessores, consultarIA, interpretarJson };
