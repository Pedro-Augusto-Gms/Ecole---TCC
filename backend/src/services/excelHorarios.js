const ExcelJS = require('exceljs');
const { estruturaDoDia } = require('../config/horarios');

const DIAS_EXCEL = [
  { numero: 1, nome: 'SEGUNDA' },
  { numero: 2, nome: 'TERÇA' },
  { numero: 3, nome: 'QUARTA' },
  { numero: 4, nome: 'QUINTA' },
  { numero: 5, nome: 'SEXTA' },
];

const CONECTORES = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E']);

const COR_BORDA_FORTE = { argb: 'FF1E293B' };
const COR_BORDA_INTERNA = { argb: 'FF64748B' };

const BORDA_EXTERNA = { style: 'thin', color: COR_BORDA_FORTE };
const BORDA_INTERNA = { style: 'thin', color: COR_BORDA_INTERNA };

function formatarDataHoje() {
  const agora = new Date();
  const dia = String(agora.getDate()).padStart(2, '0');
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const ano = agora.getFullYear();
  return `${dia}/${mes}/${ano}`;
}

// Monta mapa de nome completo -> nome curto estilo quadro escolar (ex.: "LUIZ F", "FIDELIS").
function criarFormatadorProfessores(turmasComHorarios) {
  const nomesUnicos = new Set();
  for (const { horarios } of turmasComHorarios) {
    for (const h of horarios || []) {
      const limpo = String(h.professor || '').replace(/\s+/g, ' ').trim().toUpperCase();
      if (limpo) nomesUnicos.add(limpo);
    }
  }

  const partesPorNome = new Map();
  const contagemPrimeiro = new Map();
  for (const nome of nomesUnicos) {
    const palavras = nome.split(' ').filter((p) => p && !CONECTORES.has(p));
    partesPorNome.set(nome, palavras);
    const primeiro = palavras[0] || nome;
    contagemPrimeiro.set(primeiro, (contagemPrimeiro.get(primeiro) || 0) + 1);
  }

  const contagemComInicial = new Map();
  const parcial = new Map();
  for (const nome of nomesUnicos) {
    if (nome.length <= 13) {
      parcial.set(nome, nome);
      continue;
    }
    const palavras = partesPorNome.get(nome);
    const primeiro = palavras[0] || nome;
    let curto = primeiro;
    if ((contagemPrimeiro.get(primeiro) || 0) > 1 && palavras.length > 1) {
      curto = `${primeiro} ${palavras[1][0]}`;
    }
    parcial.set(nome, curto);
    contagemComInicial.set(curto, (contagemComInicial.get(curto) || 0) + 1);
  }

  const mapaFinal = new Map();
  for (const nome of nomesUnicos) {
    const curto = parcial.get(nome);
    const palavras = partesPorNome.get(nome);
    if ((contagemComInicial.get(curto) || 0) > 1 && palavras.length > 1) {
      mapaFinal.set(nome, `${palavras[0]} ${palavras[1]}`);
    } else {
      mapaFinal.set(nome, curto);
    }
  }

  return (nomeBruto) => {
    const limpo = String(nomeBruto || '').replace(/\s+/g, ' ').trim().toUpperCase();
    return mapaFinal.get(limpo) || limpo;
  };
}

// Divide a estrutura do dia em blocos contínuos de aulas separados por intervalos/almoço.
function agruparBlocosDoDia(estrutura) {
  const blocos = [];
  let atual = [];
  for (const item of estrutura) {
    if (item.tipo === 'intervalo') {
      if (atual.length > 0) {
        blocos.push({ tipo: 'aulas', itens: atual });
        atual = [];
      }
      blocos.push({ tipo: 'intervalo', item });
    } else {
      atual.push(item);
    }
  }
  if (atual.length > 0) blocos.push({ tipo: 'aulas', itens: atual });
  return blocos;
}

/**
 * Gera um buffer .xlsx no formato de quadro escolar:
 * - Coluna à esquerda com dias da semana na vertical (SEGUNDA a SEXTA)
 * - Colunas de horário (início e fim)
 * - Blocos independentes por turma separados nos intervalos, com Disciplina e Professor
 *   na mesma linha sem divisória vertical interna, exatamente como o modelo impresso.
 */
async function gerarExcelHorarios({ titulo, turmasComHorarios }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'ÉCOLE';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Horário', {
    views: [{ showGridLines: false }],
    pageSetup: {
      paperSize: 9, // A4
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.15, footer: 0.15 },
    },
  });

  const formatarProfessor = criarFormatadorProfessores(turmasComHorarios);
  const numTurmas = turmasComHorarios.length;
  const totalColunas = 4 + numTurmas * 3;
  const unicaTurma = numTurmas === 1;

  // Larguras base das colunas de dia e horário
  sheet.getColumn(1).width = 4.6; // Dia (rotacionado 90°)
  sheet.getColumn(2).width = 1.2; // Espaçador
  sheet.getColumn(3).width = 5.8; // Início
  sheet.getColumn(4).width = 5.8; // Fim

  // Calcula larguras ideais por turma para evitar cortes/quebras desnecessárias
  for (let i = 0; i < numTurmas; i++) {
    const base = 5 + i * 3;
    sheet.getColumn(base).width = 1.5; // Espaçador entre turmas

    let maxDisc = 7;
    let maxProf = 9;
    for (const h of turmasComHorarios[i].horarios || []) {
      const disc = String(h.disciplina || '').trim().toUpperCase();
      const prof = formatarProfessor(h.professor);
      if (disc.length > maxDisc) maxDisc = disc.length;
      if (prof.length > maxProf) maxProf = prof.length;
    }

    sheet.getColumn(base + 1).width = unicaTurma ? Math.max(14, Math.min(28, maxDisc + 2)) : Math.max(9, Math.min(20, maxDisc + 1.5));
    sheet.getColumn(base + 2).width = unicaTurma ? Math.max(16, Math.min(28, maxProf + 2)) : Math.max(11, Math.min(20, maxProf + 2));
  }

  // Linha 1: Título principal
  const linhaTitulo = sheet.getRow(1);
  linhaTitulo.height = 24;
  sheet.mergeCells(1, 1, 1, totalColunas);
  const celulaTitulo = sheet.getCell(1, 1);
  celulaTitulo.value = (titulo || 'HORÁRIO ESCOLAR').toUpperCase();
  celulaTitulo.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FF0F172A' } };
  celulaTitulo.alignment = { vertical: 'middle', horizontal: 'center' };

  // Linha 2: Espaço
  sheet.getRow(2).height = 5;

  // Linha 3: Nome das turmas (sem caixa/borda, alinhado à esquerda acima do bloco)
  const linhaCabecalho = sheet.getRow(3);
  linhaCabecalho.height = 17;
  for (let i = 0; i < numTurmas; i++) {
    const colDisc = 6 + i * 3;
    const colProf = colDisc + 1;
    sheet.mergeCells(3, colDisc, 3, colProf);
    const celulaTurma = sheet.getCell(3, colDisc);
    celulaTurma.value = turmasComHorarios[i].turma.nome.toUpperCase();
    celulaTurma.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF0F172A' } };
    celulaTurma.alignment = { vertical: 'bottom', horizontal: 'left' };
  }

  const maxAulas = Math.max(1, ...turmasComHorarios.map((t) => Number(t.turma.aulas_por_dia) || 8));
  const estruturaBase = estruturaDoDia(maxAulas);
  const blocosDoDia = agruparBlocosDoDia(estruturaBase);

  const mapasPorTurma = turmasComHorarios.map(({ horarios }) => {
    const mapa = new Map();
    for (const h of horarios || []) {
      mapa.set(`${h.dia_semana}-${h.periodo}`, h);
    }
    return mapa;
  });

  let linhaAtual = 4;

  for (const dia of DIAS_EXCEL) {
    const linhaInicialDia = linhaAtual;

    for (const bloco of blocosDoDia) {
      if (bloco.tipo === 'intervalo') {
        const row = sheet.getRow(linhaAtual);
        row.height = 12;

        // Colunas de horário mantêm o intervalo (09:40 - 10:00 / 12:30 - 13:30)
        const cIni = sheet.getCell(linhaAtual, 3);
        const cFim = sheet.getCell(linhaAtual, 4);
        cIni.value = bloco.item.inicio;
        cFim.value = bloco.item.fim;
        for (const c of [cIni, cFim]) {
          c.font = { name: 'Arial', size: 7.5, color: { argb: 'FF475569' } };
          c.alignment = { vertical: 'middle', horizontal: 'center' };
          c.border = { top: BORDA_INTERNA, bottom: BORDA_INTERNA, left: BORDA_EXTERNA, right: BORDA_EXTERNA };
        }
        // Nas colunas das turmas, a linha de intervalo fica em branco e sem bordas, separando os blocos!
        linhaAtual++;
        continue;
      }

      const itens = bloco.itens;
      for (let idx = 0; idx < itens.length; idx++) {
        const item = itens[idx];
        const row = sheet.getRow(linhaAtual);
        let alturaLinha = 16.5;

        const ehPrimeiroBlocoDia = bloco === blocosDoDia[0] && idx === 0;
        const ehUltimoBlocoDia = bloco === blocosDoDia[blocosDoDia.length - 1] && idx === itens.length - 1;

        const cIni = sheet.getCell(linhaAtual, 3);
        const cFim = sheet.getCell(linhaAtual, 4);
        cIni.value = item.inicio;
        cFim.value = item.fim;
        for (const [colIdx, c] of [
          [3, cIni],
          [4, cFim],
        ]) {
          c.font = { name: 'Arial', size: 8, color: { argb: 'FF0F172A' } };
          c.alignment = { vertical: 'middle', horizontal: 'center' };
          c.border = {
            top: ehPrimeiroBlocoDia ? BORDA_EXTERNA : BORDA_INTERNA,
            bottom: ehUltimoBlocoDia ? BORDA_EXTERNA : BORDA_INTERNA,
            left: colIdx === 3 ? BORDA_EXTERNA : BORDA_INTERNA,
            right: colIdx === 4 ? BORDA_EXTERNA : BORDA_INTERNA,
          };
        }

        for (let i = 0; i < numTurmas; i++) {
          const turma = turmasComHorarios[i].turma;
          const aulasPorDiaTurma = Number(turma.aulas_por_dia) || 8;
          if (item.periodo > aulasPorDiaTurma) continue;

          const colDisc = 6 + i * 3;
          const colProf = colDisc + 1;
          const cDisc = sheet.getCell(linhaAtual, colDisc);
          const cProf = sheet.getCell(linhaAtual, colProf);

          // Determina o primeiro e o último período visível desta turma dentro deste bloco
          const itensVisiveisTurma = itens.filter((it) => it.periodo <= aulasPorDiaTurma);
          const primeiroDoBlocoTurma = itensVisiveisTurma[0]?.periodo === item.periodo;
          const ultimoDoBlocoTurma = itensVisiveisTurma[itensVisiveisTurma.length - 1]?.periodo === item.periodo;

          const bordaTop = primeiroDoBlocoTurma ? BORDA_EXTERNA : BORDA_INTERNA;
          const bordaBottom = ultimoDoBlocoTurma ? BORDA_EXTERNA : BORDA_INTERNA;

          // Caixa contínua na linha: borda esquerda só na Disciplina, borda direita só no Professor (sem risco vertical no meio)
          cDisc.border = { top: bordaTop, bottom: bordaBottom, left: BORDA_EXTERNA };
          cProf.border = { top: bordaTop, bottom: bordaBottom, right: BORDA_EXTERNA };

          const aula = mapasPorTurma[i].get(`${dia.numero}-${item.periodo}`);
          if (aula) {
            const nomeDisc = String(aula.disciplina || '').replace(/\s+/g, ' ').trim().toUpperCase();
            const nomeProf = formatarProfessor(aula.professor);

            cDisc.value = nomeDisc;
            cProf.value = nomeProf;

            cDisc.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF0F172A' } };
            cProf.font = { name: 'Arial', size: 8, color: { argb: 'FF0F172A' } };

            cDisc.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            cProf.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };

            const larguraDisc = sheet.getColumn(colDisc).width || 12;
            const larguraProf = sheet.getColumn(colProf).width || 12;
            const linhasDisc = Math.ceil(nomeDisc.length / Math.max(6, larguraDisc - 1));
            const linhasProf = Math.ceil(nomeProf.length / Math.max(6, larguraProf - 1));
            const maxLinhas = Math.max(linhasDisc, linhasProf);
            if (maxLinhas > 1) {
              alturaLinha = Math.max(alturaLinha, maxLinhas * 11.5 + 4);
            }
          }
        }

        row.height = alturaLinha;
        linhaAtual++;
      }
    }

    const linhaFinalDia = linhaAtual - 1;
    sheet.mergeCells(linhaInicialDia, 1, linhaFinalDia, 1);
    const celulaDia = sheet.getCell(linhaInicialDia, 1);
    celulaDia.value = dia.nome;
    celulaDia.font = { name: 'Arial', size: 9.5, bold: true, color: { argb: 'FF0F172A' } };
    celulaDia.alignment = { vertical: 'middle', horizontal: 'center', textRotation: 90 };
    for (let r = linhaInicialDia; r <= linhaFinalDia; r++) {
      sheet.getCell(r, 1).border = {
        top: r === linhaInicialDia ? BORDA_EXTERNA : undefined,
        bottom: r === linhaFinalDia ? BORDA_EXTERNA : undefined,
        left: BORDA_EXTERNA,
        right: BORDA_EXTERNA,
      };
    }

    // Linha em branco entre os dias da semana
    sheet.getRow(linhaAtual).height = 8;
    linhaAtual++;
  }

  // Rodapé com data de emissão
  const linhaRodape = sheet.getRow(linhaAtual);
  linhaRodape.height = 16;
  const colInicioRodape = Math.max(1, totalColunas - 1);
  sheet.mergeCells(linhaAtual, colInicioRodape, linhaAtual, totalColunas);
  const celulaRodape = sheet.getCell(linhaAtual, colInicioRodape);
  celulaRodape.value = `EMITIDO EM: ${formatarDataHoje()}`;
  celulaRodape.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FF334155' } };
  celulaRodape.alignment = { vertical: 'middle', horizontal: 'right' };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function slugArquivo(texto) {
  return (
    String(texto || 'horario')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'horario'
  );
}

async function enviarExcelHorarios(res, { titulo, nomeArquivo, turmasComHorarios }) {
  const buffer = await gerarExcelHorarios({ titulo, turmasComHorarios });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  res.send(buffer);
}

module.exports = { gerarExcelHorarios, enviarExcelHorarios, slugArquivo };
