// Dias da semana e estrutura do dia letivo da ETEC.
const DIAS = [
  { numero: 1, nome: 'Segunda-feira' },
  { numero: 2, nome: 'Terça-feira' },
  { numero: 3, nome: 'Quarta-feira' },
  { numero: 4, nome: 'Quinta-feira' },
  { numero: 5, nome: 'Sexta-feira' },
];

const MAX_PERIODOS = 8; // ETEC: até 8 aulas por dia

// ---------------------------------------------------------------------------
// Horário do dia (para mudar horários, edite só esta parte)
//   - aulas de 50 minutos, o dia começa às 08:00
//   - 2 aulas, intervalo 09:40-10:00, 3 aulas, almoço 12:30-13:30, 3 aulas (até 16:00)
//   - turmas com 6 aulas por dia (ou menos) não têm almoço: a 6ª aula começa às 12:30
// ---------------------------------------------------------------------------
const INICIO_DO_DIA = 8 * 60; // em minutos desde 00:00
const DURACAO_AULA = 50;
const BLOCOS = [
  { aulas: 2, depois: { nome: 'Intervalo', minutos: 20 } },
  { aulas: 3, depois: { nome: 'Almoço', minutos: 60, somenteSeMaisQue: 6 } }, // só existe se a turma tem mais de 6 aulas
  { aulas: 3 },
];

function minutosParaHora(minutos) {
  const h = String(Math.floor(minutos / 60)).padStart(2, '0');
  const m = String(minutos % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// Lista (em minutos) de aulas e intervalos de um dia para uma turma com `aulasPorDia` aulas.
function itensDoDia(aulasPorDia) {
  const itens = [];
  let relogio = INICIO_DO_DIA;
  let periodo = 0;

  for (const bloco of BLOCOS) {
    for (let i = 0; i < bloco.aulas && periodo < aulasPorDia; i++) {
      periodo++;
      itens.push({ tipo: 'aula', periodo, inicio: relogio, fim: relogio + DURACAO_AULA });
      relogio += DURACAO_AULA;
    }
    if (periodo >= aulasPorDia) break;

    const pausa = bloco.depois;
    if (pausa && (!pausa.somenteSeMaisQue || aulasPorDia > pausa.somenteSeMaisQue)) {
      itens.push({ tipo: 'intervalo', nome: pausa.nome, inicio: relogio, fim: relogio + pausa.minutos });
      relogio += pausa.minutos;
    }
  }
  return itens;
}

// Versão para a tela: horários como texto "HH:MM".
function estruturaDoDia(aulasPorDia) {
  return itensDoDia(aulasPorDia).map((item) => ({
    ...item,
    inicio: minutosParaHora(item.inicio),
    fim: minutosParaHora(item.fim),
  }));
}

// Início e fim (em minutos) de uma aula. Usado para as regras "depois das 12:00" etc.
function intervaloDoPeriodo(aulasPorDia, periodo) {
  const item = itensDoDia(aulasPorDia).find((i) => i.tipo === 'aula' && i.periodo === periodo);
  return item ? { inicio: item.inicio, fim: item.fim } : null;
}

module.exports = { DIAS, MAX_PERIODOS, estruturaDoDia, intervaloDoPeriodo, minutosParaHora };
