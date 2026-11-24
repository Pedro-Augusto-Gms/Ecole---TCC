// Cria o primeiro usuário administrativo.
// Uso: npm run db:admin            (cria admin / admin123)
//      npm run db:admin -- nome usuario senha email
const bcrypt = require('bcryptjs');
const db = require('../config/db');

async function criarAdmin() {
  const [nome = 'Administrador', usuario = 'admin', senha = 'admin123', email = null] = process.argv.slice(2);
  const senhaHash = await bcrypt.hash(senha, 10);

  const resultado = await db.query(
    `INSERT INTO usuarios (nome, usuario, email, senha_hash, perfil)
     VALUES ($1, $2, $3, $4, 'admin')
     ON CONFLICT (usuario) DO NOTHING
     RETURNING id`,
    [nome, usuario, email, senhaHash]
  );

  if (resultado.rowCount === 0) {
    console.log(`O usuário "${usuario}" já existe. Nada foi alterado.`);
  } else {
    console.log(`Usuário administrativo criado. Login: ${usuario} | Senha: ${senha}`);
    console.log('Troque essa senha antes de usar o sistema de verdade.');
  }
  await db.end();
}

criarAdmin().catch((erro) => {
  const detalhe = erro.message || (erro.errors && erro.errors[0] && erro.errors[0].message) || erro.code || String(erro);
  console.error('Falha ao criar administrador:', detalhe);
  process.exit(1);
});