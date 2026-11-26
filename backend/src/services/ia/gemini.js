const { erroIA, sinalComTempo } = require('./erro');

// Provedor gratuito: Google Gemini (chave em https://aistudio.google.com/apikey).
async function extrair(arquivos, prompt, opcoes = {}) {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    throw erroIA(400, 'Chave do Gemini não configurada. Adicione GEMINI_API_KEY no arquivo backend/.env e reinicie a API.');
  }
  // Padrão: modelo "flash-lite", bem mais rápido para ler formulários. Para mais precisão (e mais lentidão),
  // defina GEMINI_MODEL=gemini-3.6-flash no .env. Lista de modelos: https://ai.google.dev/gemini-api/docs/models
  const modelo = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const inicio = Date.now();

  const partes = [{ text: prompt }];
  for (const arquivo of arquivos) {
    partes.push({ text: `Arquivo: ${arquivo.nome}` });
    partes.push({ inline_data: { mime_type: arquivo.tipo, data: arquivo.dados } });
  }

  let resposta;
  try {
    resposta = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: partes }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 },
      }),
      signal: sinalComTempo(opcoes.signal),
    });
  } catch (erro) {
    if (opcoes.signal?.aborted) throw erroIA(499, 'Leitura cancelada.');
    throw erroIA(502, `Não foi possível falar com o Gemini (${erro.name === 'TimeoutError' ? 'demorou demais' : erro.message}). Verifique a internet e tente de novo.`);
  }

  const dados = await resposta.json().catch(() => ({}));
  console.log(`[Gemini] ${modelo} respondeu em ${((Date.now() - inicio) / 1000).toFixed(1)}s (status ${resposta.status})`);

  if (!resposta.ok) {
    const detalhe = dados?.error?.message || `erro ${resposta.status}`;
    if (resposta.status === 429) throw erroIA(429, 'Limite gratuito do Gemini atingido. Aguarde alguns minutos e tente de novo.');
    if (resposta.status === 404) throw erroIA(502, `Modelo "${modelo}" não encontrado. Confira o nome em GEMINI_MODEL (veja os modelos no Google AI Studio).`);
    if (resposta.status === 401 || resposta.status === 403 || /api key/i.test(detalhe)) {
      throw erroIA(502, 'Chave do Gemini inválida ou sem permissão. Confira GEMINI_API_KEY no backend/.env.');
    }
    throw erroIA(502, `O Gemini recusou o pedido: ${detalhe}`);
  }

  const texto = (dados.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
  if (!texto.trim()) {
    const bloqueio = dados.promptFeedback?.blockReason;
    throw erroIA(502, bloqueio ? `O Gemini bloqueou a leitura (${bloqueio}).` : 'O Gemini não devolveu nenhum texto. Tente com uma foto mais nítida.');
  }
  return texto;
}

module.exports = { extrair };
