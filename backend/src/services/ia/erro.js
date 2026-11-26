// Erro com código HTTP, usado pelos serviços de IA para devolver mensagens claras à tela.
function erroIA(status, mensagem) {
  const erro = new Error(mensagem);
  erro.status = status;
  return erro;
}

module.exports = { erroIA };
