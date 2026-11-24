// Dias da semana e limite de períodos usados na geração de horários.
const DIAS = [
  { numero: 1, nome: 'Segunda-feira' },
  { numero: 2, nome: 'Terça-feira' },
  { numero: 3, nome: 'Quarta-feira' },
  { numero: 4, nome: 'Quinta-feira' },
  { numero: 5, nome: 'Sexta-feira' },
];

const MAX_PERIODOS = 8; // ETEC: até 8 aulas por dia

module.exports = { DIAS, MAX_PERIODOS };
