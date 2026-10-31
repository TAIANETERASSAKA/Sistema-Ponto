const { Fechamento, FechamentoItem, Usuario, Modalidade } = require('../models');
const frequencia = require('../services/frequenciaService');
const calc = require('../services/calculoHoras');
const { exportar } = require('../services/exportacaoService');
const { fecharMes, nomeMes } = require('../services/fechamentoService');
const { auditar } = require('../services/auditoriaService');
const { obterConfiguracao } = require('../services/configuracaoService');
const { chaveDia, chaveMes, limitesDia, inicioSemana, somarDias, diaDaSemana } = require('../utils/datas');
const { invalido } = require('../utils/erros');
const v = require('../utils/validacao');

const FORMATOS = ['json', 'csv', 'xlsx', 'pdf'];
const formatoDe = (req) => {
  const formato = req.query.formato || 'json';
  if (!FORMATOS.includes(formato)) throw invalido('Formato inválido. Use pdf, xlsx ou csv.');
  return formato;
};
const dataBr = (dia) => dia.split('-').reverse().join('/');
const horaBr = (data) => data ? new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: frequencia.FUSO }) : '';

// Exporta e registra na auditoria quando é um download (RF11 / RF12)
async function responder(req, res, dados) {
  const formato = formatoDe(req);
  if (formato !== 'json') {
    await auditar(req, { acao: 'EXPORTACAO', entidade: 'relatorio', depois: { relatorio: dados.nomeArquivo, formato, filtros: req.query } });
  }
  await exportar(res, formato, dados);
}

// Linhas do relatório mensal: do fechamento oficial (se existir) ou calculadas na hora
async function linhasMensais(mes) {
  const fechamento = await Fechamento.findOne({ where: { mes } });
  if (fechamento) {
    const itens = await FechamentoItem.findAll({
      where: { fechamento_id: fechamento.id },
      include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nome', 'numero_usp', 'modalidade_id'] }]
    });
    return {
      oficial: true,
      fechadoEm: fechamento.updated_at,
      linhas: itens.map(i => ({
        usuario_id: i.usuario_id, modalidade_id: i.usuario?.modalidade_id,
        nome: i.usuario?.nome, numero_usp: i.usuario?.numero_usp, modalidade: i.modalidade_nome,
        exigidos: i.minutos_exigidos, realizados: i.minutos_realizados, abonados: i.minutos_abonados,
        pendentes: Math.max(0, -i.saldo_minutos), excedentes: Math.max(0, i.saldo_minutos),
        saldo_banco: i.saldo_banco_minutos, percentual: i.percentual, cumpriu: i.cumpriu,
        dias_trabalhados: i.dias_trabalhados, atrasos: i.atrasos
      }))
    };
  }

  const resumos = await frequencia.resumosDoMes(mes, await frequencia.buscarPesquisadores());
  return {
    oficial: false,
    linhas: resumos.filter(r => r.resumo.minutosExigidos > 0).map(({ pesquisador, resumo, atrasos }) => ({
      usuario_id: pesquisador.id, modalidade_id: pesquisador.modalidade?.id,
      nome: pesquisador.nome, numero_usp: pesquisador.numero_usp, modalidade: pesquisador.modalidade?.nome,
      exigidos: resumo.minutosExigidos, realizados: resumo.minutosRealizados, abonados: resumo.minutosAbonados,
      pendentes: resumo.minutosFaltantes, excedentes: resumo.minutosExcedentes, saldo_banco: resumo.saldoBancoMinutos,
      percentual: resumo.percentual, cumpriu: resumo.cumpriu, dias_trabalhados: resumo.diasTrabalhados, atrasos: atrasos.length
    }))
  };
}

// GET /api/relatorios/mensal?mes=&situacao=&modalidade_id=&formato= (RF07)
exports.mensal = async (req, res) => {
  const mes = req.query.mes ? v.mes(req.query.mes) : chaveMes(new Date(), frequencia.FUSO);
  const config = await obterConfiguracao();
  const { oficial, linhas: todas } = await linhasMensais(mes);

  let linhas = todas.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
  if (req.query.situacao === 'cumpriu') linhas = linhas.filter(l => l.cumpriu);
  if (req.query.situacao === 'nao_cumpriu') linhas = linhas.filter(l => !l.cumpriu);
  if (req.query.modalidade_id) linhas = linhas.filter(l => String(l.modalidade_id) === String(req.query.modalidade_id));

  const cumpriram = todas.filter(l => l.cumpriu).length;
  const colunas = [
    { chave: 'nome', titulo: 'Pesquisador', tipo: 'texto' },
    { chave: 'numero_usp', titulo: 'Nº USP', tipo: 'texto' },
    { chave: 'modalidade', titulo: 'Modalidade', tipo: 'texto' },
    { chave: 'exigidos', titulo: 'Exigidas', tipo: 'horas' },
    { chave: 'realizados', titulo: 'Realizadas', tipo: 'horas' },
    { chave: 'abonados', titulo: 'Abonadas', tipo: 'horas' },
    { chave: 'pendentes', titulo: 'Pendentes', tipo: 'horas' },
    { chave: 'excedentes', titulo: 'Excedentes', tipo: 'horas' },
    { chave: 'percentual', titulo: 'Cumprimento', tipo: 'percentual' },
    { chave: 'cumpriu', titulo: 'Cumpriu', tipo: 'booleano' },
    { chave: 'atrasos', titulo: 'Atrasos', tipo: 'numero' }
  ];
  if (config.banco_horas_ativo) colunas.push({ chave: 'saldo_banco', titulo: 'Banco de horas', tipo: 'horas' });

  await responder(req, res, {
    titulo: `Relatório mensal de frequência — ${nomeMes(mes)}`,
    subtitulo: oficial ? 'Fechamento oficial do mês' : 'Parcial: o mês ainda não foi fechado',
    nomeArquivo: `frequencia-mensal-${mes}`,
    colunas,
    linhas,
    resumo: [
      { rotulo: 'Pesquisadores', valor: todas.length },
      { rotulo: 'Cumpriram', valor: cumpriram },
      { rotulo: 'Não cumpriram', valor: todas.length - cumpriram },
      { rotulo: 'Taxa de cumprimento', valor: `${todas.length ? calc.percentual(cumpriram, todas.length) : 0}%` }
    ]
  });
};

// GET /api/relatorios/frequencia?periodo=dia|semana&data=AAAA-MM-DD&formato= (seção 7 — operacionais)
exports.frequencia = async (req, res) => {
  const periodo = req.query.periodo || 'dia';
  if (!['dia', 'semana'].includes(periodo)) throw invalido('Período inválido. Use dia ou semana (o mensal tem relatório próprio).');
  const data = req.query.data ? v.dia(req.query.data) : chaveDia(new Date(), frequencia.FUSO);
  const pesquisadores = await frequencia.buscarPesquisadores();
  const ids = pesquisadores.map(p => p.id);
  const agora = new Date();

  if (periodo === 'dia') {
    const { inicio, fim } = limitesDia(data, frequencia.FUSO);
    const dados = await frequencia.buscarDados(ids, inicio, fim);
    const linhas = pesquisadores.map(p => {
      const registros = dados.registros[p.id] || [];
      const planejado = calc.minutosPlanejadosNoDia(dados.horarios[p.id] || [], diaDaSemana(data));
      const ultimo = registros[registros.length - 1];
      return {
        nome: p.nome, modalidade: p.modalidade?.nome,
        entrada: registros[0] ? horaBr(registros[0].entrada) : '',
        saida: ultimo ? (ultimo.saida ? horaBr(ultimo.saida) : 'em aberto') : '',
        realizados: registros.reduce((s, r) => s + calc.minutosDoRegistro(r, agora), 0),
        planejados: planejado,
        situacao: registros.length ? 'Presente' : planejado > 0 ? 'Ausente' : 'Sem expediente previsto'
      };
    });
    return responder(req, res, {
      titulo: `Frequência diária — ${dataBr(data)}`,
      nomeArquivo: `frequencia-diaria-${data}`,
      colunas: [
        { chave: 'nome', titulo: 'Pesquisador', tipo: 'texto' },
        { chave: 'modalidade', titulo: 'Modalidade', tipo: 'texto' },
        { chave: 'entrada', titulo: '1ª entrada', tipo: 'texto' },
        { chave: 'saida', titulo: 'Última saída', tipo: 'texto' },
        { chave: 'realizados', titulo: 'Realizadas', tipo: 'horas' },
        { chave: 'planejados', titulo: 'Planejadas', tipo: 'horas' },
        { chave: 'situacao', titulo: 'Situação', tipo: 'texto' }
      ],
      linhas,
      resumo: [
        { rotulo: 'Presentes', valor: linhas.filter(l => l.situacao === 'Presente').length },
        { rotulo: 'Ausentes', valor: linhas.filter(l => l.situacao === 'Ausente').length }
      ]
    });
  }

  const segunda = inicioSemana(data);
  const domingo = somarDias(segunda, 6);
  const dados = await frequencia.buscarDados(ids, limitesDia(segunda, frequencia.FUSO).inicio, limitesDia(domingo, frequencia.FUSO).fim);
  const linhas = pesquisadores.map(p => {
    const realizados = (dados.registros[p.id] || []).reduce((s, r) => s + calc.minutosDoRegistro(r, agora), 0);
    const abonados = (dados.abonos[p.id] || []).reduce((s, a) => s + a.minutos, 0);
    const exigidos = p.modalidade ? Math.round(p.modalidade.horas_semanais * 60) : 0;
    const total = realizados + abonados;
    return {
      nome: p.nome, modalidade: p.modalidade?.nome, realizados, abonados, exigidos,
      pendentes: Math.max(0, exigidos - total), excedentes: Math.max(0, total - exigidos),
      percentual: calc.percentual(total, exigidos)
    };
  });
  await responder(req, res, {
    titulo: `Frequência semanal — ${dataBr(segunda)} a ${dataBr(domingo)}`,
    nomeArquivo: `frequencia-semanal-${segunda}`,
    colunas: [
      { chave: 'nome', titulo: 'Pesquisador', tipo: 'texto' },
      { chave: 'modalidade', titulo: 'Modalidade', tipo: 'texto' },
      { chave: 'exigidos', titulo: 'Exigidas', tipo: 'horas' },
      { chave: 'realizados', titulo: 'Realizadas', tipo: 'horas' },
      { chave: 'abonados', titulo: 'Abonadas', tipo: 'horas' },
      { chave: 'pendentes', titulo: 'Pendentes', tipo: 'horas' },
      { chave: 'excedentes', titulo: 'Excedentes', tipo: 'horas' },
      { chave: 'percentual', titulo: 'Cumprimento', tipo: 'percentual' }
    ],
    linhas
  });
};

// GET /api/relatorios/modalidades?mes=&formato= — horas por modalidade
exports.modalidades = async (req, res) => {
  const mes = req.query.mes ? v.mes(req.query.mes) : chaveMes(new Date(), frequencia.FUSO);
  const { linhas: porPesquisador } = await linhasMensais(mes);
  const modalidades = await Modalidade.findAll({ order: [['horas_semanais', 'DESC']] });

  const linhas = modalidades.map(m => {
    const grupo = porPesquisador.filter(l => l.modalidade_id === m.id || (!l.modalidade_id && l.modalidade === m.nome));
    const exigidos = grupo.reduce((s, l) => s + l.exigidos, 0);
    const considerados = grupo.reduce((s, l) => s + l.realizados + l.abonados, 0);
    const cumpriram = grupo.filter(l => l.cumpriu).length;
    return {
      modalidade: m.nome, carga_semanal: `${m.horas_semanais}h`, pesquisadores: grupo.length,
      realizados: grupo.reduce((s, l) => s + l.realizados, 0), exigidos,
      percentual: calc.percentual(considerados, exigidos),
      taxa: grupo.length ? calc.percentual(cumpriram, grupo.length) : 0
    };
  }).filter(l => l.pesquisadores > 0);

  await responder(req, res, {
    titulo: `Horas por modalidade — ${nomeMes(mes)}`,
    nomeArquivo: `horas-por-modalidade-${mes}`,
    colunas: [
      { chave: 'modalidade', titulo: 'Modalidade', tipo: 'texto' },
      { chave: 'carga_semanal', titulo: 'Carga semanal', tipo: 'texto' },
      { chave: 'pesquisadores', titulo: 'Pesquisadores', tipo: 'numero' },
      { chave: 'exigidos', titulo: 'Exigidas', tipo: 'horas' },
      { chave: 'realizados', titulo: 'Realizadas', tipo: 'horas' },
      { chave: 'percentual', titulo: 'Cumprimento', tipo: 'percentual' },
      { chave: 'taxa', titulo: 'Taxa de cumprimento', tipo: 'percentual' }
    ],
    linhas
  });
};

// GET /api/relatorios/evolucao?meses=12&formato= — evolução mensal (seção 7 — gerenciais)
exports.evolucao = async (req, res) => {
  const meses = req.query.meses ? v.numero(req.query.meses, 'a quantidade de meses', { min: 1, max: 60, inteiro: true }) : 12;
  const fechamentos = await Fechamento.findAll({
    order: [['mes', 'DESC']], limit: meses,
    include: [{ model: FechamentoItem, as: 'itens', attributes: ['minutos_realizados', 'percentual'] }]
  });
  const linhas = fechamentos.reverse().map(f => ({
    mes: nomeMes(f.mes),
    pesquisadores: f.total_pesquisadores,
    cumpriram: f.total_cumpriram,
    nao_cumpriram: f.total_pesquisadores - f.total_cumpriram,
    taxa: f.total_pesquisadores ? calc.percentual(f.total_cumpriram, f.total_pesquisadores) : 0,
    realizados: f.itens.reduce((s, i) => s + i.minutos_realizados, 0),
    media: f.itens.length ? Math.round(f.itens.reduce((s, i) => s + i.percentual, 0) / f.itens.length * 10) / 10 : 0
  }));

  await responder(req, res, {
    titulo: 'Evolução mensal da frequência',
    subtitulo: `Últimos ${linhas.length} meses fechados`,
    nomeArquivo: 'evolucao-mensal',
    colunas: [
      { chave: 'mes', titulo: 'Mês', tipo: 'texto' },
      { chave: 'pesquisadores', titulo: 'Pesquisadores', tipo: 'numero' },
      { chave: 'cumpriram', titulo: 'Cumpriram', tipo: 'numero' },
      { chave: 'nao_cumpriram', titulo: 'Não cumpriram', tipo: 'numero' },
      { chave: 'taxa', titulo: 'Taxa de cumprimento', tipo: 'percentual' },
      { chave: 'media', titulo: 'Cumprimento médio', tipo: 'percentual' },
      { chave: 'realizados', titulo: 'Horas realizadas', tipo: 'horas' }
    ],
    linhas
  });
};

// GET /api/relatorios/fechamentos — lista de meses fechados
exports.listarFechamentos = async (req, res) => {
  const fechamentos = await Fechamento.findAll({ order: [['mes', 'DESC']] });
  res.json({ fechamentos });
};

// POST /api/relatorios/fechamentos { mes } — gera ou reprocessa o fechamento (admin)
exports.fechar = async (req, res) => {
  const mes = v.mes(req.body.mes);
  const fechamento = await fecharMes(mes, { geradoPorId: req.usuario.id, req });
  res.json({ fechamento });
};
