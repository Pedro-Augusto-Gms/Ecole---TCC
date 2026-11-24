require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rotas = require('./routes');

if (!process.env.JWT_SECRET) {
  console.error('Defina JWT_SECRET no arquivo backend/.env (copie de .env.example).');
  process.exit(1);
}

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api/saude', (req, res) => res.json({ status: 'ok', sistema: 'ÉCOLE' }));
app.use('/api', rotas);

app.use((req, res) => res.status(404).json({ mensagem: 'Rota não encontrada.' }));

// Tratamento central de erros
// eslint-disable-next-line no-unused-vars
app.use((erro, req, res, next) => {
  console.error(erro);
  res.status(500).json({ mensagem: 'Erro interno do servidor.' });
});

const PORTA = process.env.PORT || 3001;
app.listen(PORTA, () => console.log(`API do ÉCOLE rodando em http://localhost:${PORTA}`));
