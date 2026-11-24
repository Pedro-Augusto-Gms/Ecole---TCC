const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

exports.login = async (req, res) => {
  const usuario = (req.body.usuario || '').trim();
  const senha = req.body.senha || '';

  if (!usuario || !senha) {
    return res.status(400).json({ mensagem: 'Informe usuário (ou e-mail) e senha.' });
  }

  const { rows } = await db.query(
    'SELECT * FROM usuarios WHERE LOWER(usuario) = LOWER($1) OR LOWER(email) = LOWER($1)',
    [usuario]
  );
  const encontrado = rows[0];

  const senhaCorreta = encontrado && (await bcrypt.compare(senha, encontrado.senha_hash));
  if (!senhaCorreta) {
    return res.status(401).json({ mensagem: 'Usuário ou senha incorretos.' });
  }

  const token = jwt.sign(
    { id: encontrado.id, nome: encontrado.nome, perfil: encontrado.perfil },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.json({
    token,
    usuario: { id: encontrado.id, nome: encontrado.nome, perfil: encontrado.perfil },
  });
};
