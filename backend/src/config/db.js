const { Pool } = require('pg');
require('dotenv').config();

// Hospedagem (Neon/Render): usa DATABASE_URL. Local: usa DB_HOST, DB_PORT etc.
const url = process.env.DATABASE_URL;

const pool = new Pool(
  url
    ? {
        connectionString: url,
        // O Neon exige SSL. Se a URL já traz sslmode, ele é respeitado.
        ssl: /sslmode=/.test(url) ? undefined : { rejectUnauthorized: false },
      }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        database: process.env.DB_NAME || 'ecole',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD,
      }
);

// Bancos gratuitos "dormem" e derrubam conexões ociosas. Sem este tratamento, o Node encerraria o servidor.
pool.on('error', (erro) => console.error('Conexão ociosa com o banco encerrada:', erro.message));

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
