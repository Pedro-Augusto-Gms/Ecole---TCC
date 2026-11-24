const path = require('path');
const fs = require('fs');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
};
const nomeBanco = process.env.DB_NAME || 'ecole';

async function inicializarBanco() {
  // 1) Cria o banco, se ainda não existir
  const admin = new Client({ ...config, database: 'postgres' });
  await admin.connect();
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nomeBanco]);
  if (existe.rowCount === 0) {
    await admin.query(`CREATE DATABASE "${nomeBanco}"`);
    console.log(`Banco "${nomeBanco}" criado.`);
  } else {
    console.log(`Banco "${nomeBanco}" já existe.`);
  }
  await admin.end();

  // 2) Executa o schema.sql
  const caminhoSchema = path.join(__dirname, '..', '..', '..', 'database', 'schema.sql');
  const sql = fs.readFileSync(caminhoSchema, 'utf8');
  const cliente = new Client({ ...config, database: nomeBanco });
  await cliente.connect();
  await cliente.query(sql);
  await cliente.end();
  console.log('Tabelas criadas/atualizadas com sucesso.');
}

inicializarBanco().catch((erro) => {
  // Em conexões recusadas o Node devolve um AggregateError com a mensagem vazia.
  const detalhe = erro.message || (erro.errors && erro.errors[0] && erro.errors[0].message) || erro.code || String(erro);
  console.error('Falha ao inicializar o banco:', detalhe);
  if (erro.code === 'ECONNREFUSED' || (erro.errors && erro.errors.some((e) => e.code === 'ECONNREFUSED'))) {
    console.error(`Não foi possível conectar ao PostgreSQL em ${config.host}:${config.port}. Ele está instalado, rodando e nessa porta?`);
  } else if (erro.code === '28P01') {
    console.error('Senha incorreta: confira DB_PASSWORD no arquivo backend/.env.');
  }
  process.exit(1);
});