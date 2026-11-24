const db = require('../config/db');

// Registra uma atividade para o painel inicial. Nunca derruba a requisição.
async function registrarAtividade(descricao) {
  try {
    await db.query('INSERT INTO atividades (descricao) VALUES ($1)', [descricao]);
  } catch (erro) {
    console.error('Não foi possível registrar atividade:', erro.message);
  }
}

module.exports = { registrarAtividade };
