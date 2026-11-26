# ÉCOLE — Sistema de geração de horários escolares

Versão inicial do sistema web ÉCOLE (TCC): login, dashboard, CRUD de professores, turmas e disciplinas, e geração de horários.

**Tecnologias:** React (Vite) · Node.js + Express · PostgreSQL · HTML5 e CSS3 · autenticação JWT.

## Estrutura

```
ecole/
├── frontend/   React (componentes, páginas, estilos em CSS separados)
├── backend/    API Express (rotas, controllers, middlewares, services, config)
└── database/   schema.sql com todas as tabelas
```

## Pré-requisitos

- Node.js 18 ou superior (versão LTS)
- PostgreSQL instalado e rodando (anote a senha do usuário `postgres`)

## Como rodar

### 1. Backend

```bash
cd backend
npm install
```

Crie o arquivo `.env` copiando o `.env.example` e preencha `DB_PASSWORD` (senha do seu PostgreSQL) e `JWT_SECRET`:

```bash
# Windows (PowerShell):  copy .env.example .env
# Linux / Mac:           cp .env.example .env
```

Crie o banco e as tabelas, e depois o primeiro usuário administrador:

```bash
npm run db:init      # cria o banco "ecole" e todas as tabelas
npm run db:admin     # cria o usuário admin (login: admin / senha: admin123)
npm run dev          # inicia a API em http://localhost:3001
```

Para criar um administrador com outros dados: `npm run db:admin -- "Seu Nome" seuusuario suasenha seu@email.com`

### 2. Frontend (em outro terminal)

```bash
cd frontend
npm install
npm run dev          # abre em http://localhost:5173
```

### 3. Logo

Copie o arquivo da logo para `frontend/public/` com o nome **`logo-ecole.png`**.
Ela é exibida sem nenhuma alteração na tela de login e no menu lateral. Enquanto o arquivo não existir, aparece apenas o texto "ÉCOLE".
Se a sua logo tiver outro formato (ex.: `.svg`), ajuste o caminho em `frontend/src/components/Logo.jsx`.

## Fluxo de uso

1. Entre com o usuário administrador.
2. Cadastre as **disciplinas** (nome e aulas por semana).
3. Cadastre os **professores**: disciplinas que lecionam e disponibilidade (clique nos períodos).
4. Cadastre as **turmas** e marque as disciplinas de cada uma.
5. Em **Horários**, escolha a turma, os períodos por dia e clique em *Gerar horários*.

## Importar formulários com IA (gratuito)

Na tela **Importar (IA)** a gestão envia fotos, PDFs ou textos dos formulários dos professores. A IA lê nome, pontuação, disciplinas e disponibilidade, mostra uma **prévia editável** e só grava no banco depois que você confirma.

1. Crie uma chave gratuita em https://aistudio.google.com/apikey (Gemini).
2. No `backend/.env`, adicione (veja o `.env.example`):
   ```
   AI_PROVIDER=gemini
   GEMINI_API_KEY=sua_chave
   ```
3. Reinicie a API. Se aparecer "Modelo não encontrado", defina `GEMINI_MODEL` com um modelo listado no Google AI Studio.

Para usar a Claude no lugar (pago por uso): `AI_PROVIDER=claude` e `ANTHROPIC_API_KEY=...`.
O texto das instruções enviado à IA fica em `backend/src/services/ia/prompt.js` e pode ser ajustado ao formato do formulário da escola.
A **pontuação** do professor também pode ser editada na tela Professores e dá prioridade a ele na geração de horários.

## Onde evoluir o algoritmo (TCC)

Toda a lógica de geração está isolada em `backend/src/services/geradorHorarios.js`.
A versão atual é um algoritmo guloso simples. Dá para trocá-lo (backtracking, algoritmo genético, programação por restrições) mantendo a mesma entrada e saída, sem alterar controllers ou frontend.
O banco já impede conflitos: um professor não pode estar em duas turmas no mesmo dia/período, e uma turma não pode ter duas aulas no mesmo horário.

## Principais rotas da API

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login (retorna token JWT) |
| GET | `/api/dashboard` | Totais e atividades recentes |
| GET/POST/PUT/DELETE | `/api/professores` | CRUD de professores |
| GET/POST/PUT/DELETE | `/api/turmas` | CRUD de turmas |
| GET/POST/PUT/DELETE | `/api/disciplinas` | CRUD de disciplinas |
| GET | `/api/horarios/turma/:id` | Horário salvo de uma turma |
| POST | `/api/horarios/gerar` | Gera o horário de uma turma |
| POST | `/api/importacao/ler` | IA lê os formulários e devolve uma prévia (não grava) |
| POST | `/api/importacao/confirmar` | Grava a prévia confirmada |
| DELETE | `/api/horarios/turma/:id` | Remove o horário de uma turma |

Todas as rotas, exceto o login, exigem o cabeçalho `Authorization: Bearer <token>`.
