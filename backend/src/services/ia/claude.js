const { erroIA } = require('./erro');

// Provedor alternativo (pago por uso): Claude, da Anthropic.
// Para usar: AI_PROVIDER=claude e ANTHROPIC_API_KEY=... no backend/.env.
async function extrair(arquivos, prompt) {
  const chave = process.env.ANTHROPIC_API_KEY;
  if (!chave) {
    throw erroIA(400, 'Chave da Anthropic não configurada. Adicione ANTHROPIC_API_KEY no arquivo backend/.env e reinicie a API.');
  }
  const modelo = process.env.CLAUDE_MODEL || 'claude-haiku-5-5';

  const conteudo = [];
  for (const arquivo of arquivos) {
    conteudo.push({ type: 'text', text: `Arquivo: ${arquivo.nome}` });
    if (arquivo.tipo === 'application/pdf') {
      conteudo.push({ type: 'document', source: { type: 'base64', media_type: arquivo.tipo, data: arquivo.dados } });
    } else if (arquivo.tipo === 'text/plain') {
      conteudo.push({ type: 'text', text: Buffer.from(arquivo.dados, 'base64').toString('utf8') });
    } else {
      conteudo.push({ type: 'image', source: { type: 'base64', media_type: arquivo.tipo, data: arquivo.dados } });
    }
  }
  conteudo.push({ type: 'text', text: prompt });

  let resposta;
  try {
    resposta = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': chave, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: modelo, max_tokens: 4096, messages: [{ role: 'user', content: conteudo }] }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (erro) {
    throw erroIA(502, `Não foi possível falar com a Anthropic (${erro.name === 'TimeoutError' ? 'demorou demais' : erro.message}).`);
  }

  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const detalhe = dados?.error?.message || `erro ${resposta.status}`;
    if (resposta.status === 401) throw erroIA(502, 'Chave da Anthropic inválida. Confira ANTHROPIC_API_KEY no backend/.env.');
    if (resposta.status === 429) throw erroIA(429, 'Limite de uso atingido na Anthropic. Aguarde e tente de novo.');
    throw erroIA(502, `A Anthropic recusou o pedido: ${detalhe}`);
  }

  const texto = (dados.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  if (!texto.trim()) throw erroIA(502, 'A IA não devolveu nenhum texto. Tente de novo.');
  return texto;
}

module.exports = { extrair };
