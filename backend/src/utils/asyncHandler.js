// Permite usar funções async nas rotas do Express 4 sem try/catch em cada uma.
module.exports = (funcao) => (req, res, next) => {
  Promise.resolve(funcao(req, res, next)).catch(next);
};
