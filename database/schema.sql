-- ÉCOLE - Esquema do banco de dados (PostgreSQL)
-- Pode ser executado várias vezes sem problemas: cria o que falta e atualiza bancos antigos.

CREATE TABLE IF NOT EXISTS usuarios (
    id          SERIAL PRIMARY KEY,
    nome        VARCHAR(120) NOT NULL,
    usuario     VARCHAR(60)  NOT NULL UNIQUE,
    email       VARCHAR(150) UNIQUE,
    senha_hash  TEXT         NOT NULL,
    perfil      VARCHAR(20)  NOT NULL DEFAULT 'admin',
    criado_em   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS disciplinas (
    id              SERIAL PRIMARY KEY,
    nome            VARCHAR(120) NOT NULL UNIQUE,
    aulas_semanais  INTEGER      NOT NULL CHECK (aulas_semanais BETWEEN 1 AND 20),
    criado_em       TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- turno: Integral, Manhã ou Noite (validado na API)
-- aulas_por_dia: quantas aulas a turma tem por dia (normalmente 8; algumas turmas têm 6)
CREATE TABLE IF NOT EXISTS turmas (
    id             SERIAL PRIMARY KEY,
    nome           VARCHAR(80) NOT NULL UNIQUE,
    turno          VARCHAR(20) NOT NULL DEFAULT 'Integral',
    aulas_por_dia  SMALLINT    NOT NULL DEFAULT 8 CHECK (aulas_por_dia BETWEEN 1 AND 8),
    criado_em      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- Quais disciplinas cada turma cursa
CREATE TABLE IF NOT EXISTS turma_disciplinas (
    turma_id       INTEGER NOT NULL REFERENCES turmas(id)       ON DELETE CASCADE,
    disciplina_id  INTEGER NOT NULL REFERENCES disciplinas(id)  ON DELETE CASCADE,
    PRIMARY KEY (turma_id, disciplina_id)
);

CREATE TABLE IF NOT EXISTS professores (
    id                      SERIAL PRIMARY KEY,
    nome                    VARCHAR(150) NOT NULL,
    informacoes_adicionais  TEXT,
    criado_em               TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Quais disciplinas cada professor leciona
CREATE TABLE IF NOT EXISTS professor_disciplinas (
    professor_id   INTEGER NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
    disciplina_id  INTEGER NOT NULL REFERENCES disciplinas(id) ON DELETE CASCADE,
    PRIMARY KEY (professor_id, disciplina_id)
);

-- Disponibilidade: dia_semana (1 = segunda ... 5 = sexta) e período (1 a 8)
CREATE TABLE IF NOT EXISTS disponibilidades (
    professor_id  INTEGER  NOT NULL REFERENCES professores(id) ON DELETE CASCADE,
    dia_semana    SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
    periodo       SMALLINT NOT NULL CHECK (periodo BETWEEN 1 AND 8),
    PRIMARY KEY (professor_id, dia_semana, periodo)
);

-- Horários gerados. As restrições UNIQUE impedem conflitos no banco:
-- uma turma não tem duas aulas no mesmo horário e um professor não está em duas turmas ao mesmo tempo.
CREATE TABLE IF NOT EXISTS horarios (
    id             SERIAL PRIMARY KEY,
    turma_id       INTEGER  NOT NULL REFERENCES turmas(id)       ON DELETE CASCADE,
    disciplina_id  INTEGER  NOT NULL REFERENCES disciplinas(id)  ON DELETE CASCADE,
    professor_id   INTEGER  NOT NULL REFERENCES professores(id)  ON DELETE CASCADE,
    dia_semana     SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
    periodo        SMALLINT NOT NULL CHECK (periodo BETWEEN 1 AND 8),
    UNIQUE (turma_id, dia_semana, periodo),
    UNIQUE (professor_id, dia_semana, periodo)
);

-- Registro de atividades exibido no dashboard
CREATE TABLE IF NOT EXISTS atividades (
    id         SERIAL PRIMARY KEY,
    descricao  TEXT      NOT NULL,
    criado_em  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Atualização de bancos criados com a versão anterior (6 períodos, sem aulas_por_dia).
-- Em um banco novo estes comandos não mudam nada.
-- ---------------------------------------------------------------------------
-- Pontuação do professor: prioridade na escolha de aulas (maior = prioridade)
ALTER TABLE professores ADD COLUMN IF NOT EXISTS pontuacao NUMERIC(7,2) NOT NULL DEFAULT 0;

ALTER TABLE turmas ADD COLUMN IF NOT EXISTS aulas_por_dia SMALLINT NOT NULL DEFAULT 8;

ALTER TABLE turmas DROP CONSTRAINT IF EXISTS turmas_aulas_por_dia_check;
ALTER TABLE turmas ADD CONSTRAINT turmas_aulas_por_dia_check CHECK (aulas_por_dia BETWEEN 1 AND 8);

ALTER TABLE disponibilidades DROP CONSTRAINT IF EXISTS disponibilidades_periodo_check;
ALTER TABLE disponibilidades ADD CONSTRAINT disponibilidades_periodo_check CHECK (periodo BETWEEN 1 AND 8);

ALTER TABLE horarios DROP CONSTRAINT IF EXISTS horarios_periodo_check;
ALTER TABLE horarios ADD CONSTRAINT horarios_periodo_check CHECK (periodo BETWEEN 1 AND 8);

-- ---------------------------------------------------------------------------
-- Rascunho x grade oficial
--   horarios           = grade OFICIAL (publicada, visível para os alunos)
--   horarios_rascunho  = horário gerado que ainda aguarda a gestão aceitar
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS horarios_rascunho (
    id             SERIAL PRIMARY KEY,
    turma_id       INTEGER  NOT NULL REFERENCES turmas(id)       ON DELETE CASCADE,
    disciplina_id  INTEGER  NOT NULL REFERENCES disciplinas(id)  ON DELETE CASCADE,
    professor_id   INTEGER  NOT NULL REFERENCES professores(id)  ON DELETE CASCADE,
    dia_semana     SMALLINT NOT NULL CHECK (dia_semana BETWEEN 1 AND 5),
    periodo        SMALLINT NOT NULL CHECK (periodo BETWEEN 1 AND 8),
    UNIQUE (turma_id, dia_semana, periodo)
);

-- Regras pedidas pela gestão no chat com a IA (ex.: "matemática só depois das 12:00").
-- turma_id vazio = vale para todas as turmas. regra guarda horários em minutos desde 00:00.
CREATE TABLE IF NOT EXISTS restricoes (
    id         SERIAL PRIMARY KEY,
    turma_id   INTEGER REFERENCES turmas(id) ON DELETE CASCADE,
    descricao  TEXT      NOT NULL,
    regra      JSONB     NOT NULL,
    criado_em  TIMESTAMP NOT NULL DEFAULT NOW()
);
