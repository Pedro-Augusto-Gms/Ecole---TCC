const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || 'ecole',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Executa uma função dentro de uma transação (BEGIN / COMMIT / ROLLBACK).
pool.transacao = async function transacao(funcao) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    const resultado = await funcao(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    await cliente.query('ROLLBACK');
    throw erro;
  } finally {
    cliente.release();
  }
};

module.exports = pool;
