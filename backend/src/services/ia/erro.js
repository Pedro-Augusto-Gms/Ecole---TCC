// Erro com código HTTP, usado pelos serviços de IA para devolver mensagens claras à tela.
function erroIA(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

// Sinal que cancela a chamada à IA quando o tempo acaba (2 min) ou quando a gestão clica em "Cancelar".
function sinalComTempo(sinalExterno, ms = 120000) {
  const tempo = AbortSignal.timeout(ms);
  return sinalExterno ? AbortSignal.any([sinalExterno, tempo]) : tempo;
}

module.exports = { erroIA, sinalComTempo };
