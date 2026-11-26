require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const rotas = require('./routes');

if (!process.env.JWT_SECRET) {
  console.error('Defina JWT_SECRET no arquivo backend/.env (copie de .env.example).');
  process.exit(1);
}

const app = express();

app.use(cors());
// Limite maior porque as fotos dos formulários chegam em base64 na importação por IA.
app.use(express.json({ limit: '40mb' }));

app.get('/api/saude', (req, res) => res.json({ status: 'ok', sistema: 'ÉCOLE' }));
app.use('/api', rotas);

// Em produção, a própria API entrega o site (frontend/dist, gerado por "npm run build").
// Assim o sistema inteiro fica em um único endereço.
const pastaSite = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(path.join(pastaSite, 'index.html'))) {
  app.use(express.static(pastaSite));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(pastaSite, 'index.html'));
  });
}

app.use((req, res) => res.status(404).json({ mensagem: 'Rota não encontrada.' }));

// Tratamento central de erros
// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  console.error(erro);
  res.status(500).json({ mensagem: 'Erro interno do servidor.' });
});

// Garante as colunas novas mesmo que o "npm run db:init" não tenha sido rodado depois de uma atualização.
async function garantirColunas() {
  const db = require('./config/db');
  try {
    await db.query('ALTER TABLE turma_disciplinas ADD COLUMN IF NOT EXISTS aulas_semanais INTEGER CHECK (aulas_semanais BETWEEN 1 AND 20)');
    await db.query('ALTER TABLE disciplinas ADD COLUMN IF NOT EXISTS nome_completo VARCHAR(250)');
  } catch (erro) {
    console.error('Não foi possível conferir as colunas do banco:', erro.message);
  }
}

const PORTA = process.env.PORT || 3001;
garantirColunas().finally(() => app.listen(PORTA, () => console.log(`API do ÉCOLE rodando em http://localhost:${PORTA}`)));
