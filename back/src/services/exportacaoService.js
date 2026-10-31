const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { formatarMinutos } = require('./calculoHoras');

// RF11 — exporta uma tabela em PDF, Excel ou CSV.
// colunas: [{ chave, titulo, tipo: 'texto' | 'horas' | 'percentual' | 'booleano' | 'numero' | 'data' }]

const formatarTexto = (valor, tipo) => {
  if (valor === null || valor === undefined) return '';
  switch (tipo) {
    case 'horas': return formatarMinutos(valor);
    case 'percentual': return `${Number(valor).toFixed(1).replace('.', ',')}%`;
    case 'booleano': return valor ? 'Sim' : 'Não';
    case 'data': return String(valor).slice(0, 10).split('-').reverse().join('/');
    default: return String(valor);
  }
};

// Em planilhas, horas viram número decimal (permite somar no Excel)
const valorPlanilha = (valor, tipo) => {
  if (valor === null || valor === undefined) return '';
  if (tipo === 'horas') return Math.round((valor / 60) * 100) / 100;
  if (tipo === 'percentual') return Math.round(Number(valor) * 10) / 10;
  if (tipo === 'booleano' || tipo === 'data') return formatarTexto(valor, tipo);
  return valor;
};

const tituloPlanilha = (c) => c.tipo === 'horas' ? `${c.titulo} (h)` : c.tipo === 'percentual' ? `${c.titulo} (%)` : c.titulo;

function gerarCsv(res, { colunas, linhas, nomeArquivo }) {
  const escapar = (v) => {
    // Decimal com vírgula só em números (formato brasileiro do Excel)
    const s = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const conteudo = [
    colunas.map(c => escapar(tituloPlanilha(c))).join(';'),
    ...linhas.map(l => colunas.map(c => escapar(valorPlanilha(l[c.chave], c.tipo))).join(';'))
  ].join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}.csv"`);
  // BOM para o Excel reconhecer acentos; ";" é o separador padrão do Excel em português
  res.send('﻿' + conteudo);
}

async function gerarXlsx(res, { titulo, subtitulo, colunas, linhas, nomeArquivo }) {
  const livro = new ExcelJS.Workbook();
  livro.creator = 'Sistema de Controle de Frequência';
  const planilha = livro.addWorksheet('Relatório');

  planilha.addRow([titulo]).font = { bold: true, size: 14 };
  if (subtitulo) planilha.addRow([subtitulo]).font = { color: { argb: 'FF64748B' } };
  planilha.addRow([]);
  const cabecalho = planilha.addRow(colunas.map(tituloPlanilha));
  cabecalho.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  cabecalho.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075985' } }; });

  for (const linha of linhas) planilha.addRow(colunas.map(c => valorPlanilha(linha[c.chave], c.tipo)));
  colunas.forEach((c, i) => {
    const largura = Math.max(tituloPlanilha(c).length, ...linhas.map(l => formatarTexto(l[c.chave], c.tipo).length));
    planilha.getColumn(i + 1).width = Math.min(Math.max(largura + 2, 10), 45);
  });

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}.xlsx"`);
  await livro.xlsx.write(res);
  res.end();
}

function gerarPdf(res, { titulo, subtitulo, colunas, linhas, resumo, nomeArquivo }) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 36 });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}.pdf"`);
  doc.pipe(res);

  const largura = doc.page.width - 72;
  const larguraColuna = largura / colunas.length;
  const gerado = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  doc.fontSize(16).font('Helvetica-Bold').fillColor('#0c4a6e').text(titulo);
  if (subtitulo) doc.fontSize(10).font('Helvetica').fillColor('#475569').text(subtitulo);
  doc.fontSize(8).fillColor('#94a3b8').text(`Gerado em ${gerado}`);
  if (resumo?.length) {
    doc.moveDown(0.5).fontSize(10).fillColor('#0f172a').font('Helvetica')
      .text(resumo.map(r => `${r.rotulo}: ${r.valor}`).join('    '));
  }
  doc.moveDown();

  const desenharCabecalho = () => {
    const y = doc.y;
    doc.rect(36, y, largura, 18).fill('#075985');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(8);
    colunas.forEach((c, i) => doc.text(c.titulo, 40 + i * larguraColuna, y + 5, { width: larguraColuna - 8, lineBreak: false, ellipsis: true }));
    doc.y = y + 18;
  };

  desenharCabecalho();
  linhas.forEach((linha, indice) => {
    if (doc.y > doc.page.height - 60) {
      doc.addPage();
      desenharCabecalho();
    }
    const y = doc.y;
    if (indice % 2 === 1) doc.rect(36, y, largura, 16).fill('#f1f5f9');
    doc.fillColor('#0f172a').font('Helvetica').fontSize(8);
    colunas.forEach((c, i) => doc.text(formatarTexto(linha[c.chave], c.tipo), 40 + i * larguraColuna, y + 4, {
      width: larguraColuna - 8, lineBreak: false, ellipsis: true
    }));
    doc.y = y + 16;
  });
  if (linhas.length === 0) doc.moveDown().fillColor('#64748b').fontSize(10).text('Nenhum dado para o período.');

  doc.end();
}

async function exportar(res, formato, dados) {
  if (formato === 'csv') return gerarCsv(res, dados);
  if (formato === 'xlsx') return gerarXlsx(res, dados);
  if (formato === 'pdf') return gerarPdf(res, dados);
  res.json({ titulo: dados.titulo, subtitulo: dados.subtitulo, colunas: dados.colunas, linhas: dados.linhas, resumo: dados.resumo || [] });
}

module.exports = { exportar, formatarTexto };
