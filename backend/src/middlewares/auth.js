const jwt = require('jsonwebtoken');

// Protege as rotas: exige o cabeçalho "Authorization: Bearer <token>".
module.exports = function autenticar(req, res, next) {
  const cabecalho = req.headers.authorization || '';
  const [tipo, token] = cabecalho.split(' ');

  if (tipo !== 'Bearer' || !token) {
    return res.status(401).json({ mensagem: 'Acesso não autorizado. Faça login.' });
  }

  try {
    req.usuario = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (erro) {
    return res.status(401).json({ mensagem: 'Sessão expirada. Faça login novamente.' });
  }
};
