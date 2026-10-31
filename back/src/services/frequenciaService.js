const { Op } = require('sequelize');
const env = require('../config/env');
const { Usuario, Modalidade, Registro, Solicitacao, Horario, Fechamento, FechamentoItem } = require('../models');
const calc = require('./calculoHoras');
const { obterConfiguracao } = require('./configuracaoService');
const { limitesMes, chaveDia, chaveMes, mesAnterior, inicioSemana, somarDias, limitesDia, diasNoMes } = require('../utils/datas');

const FUSO = env.fusoHorario;

const agruparPor = (lista, campo) => lista.reduce((mapa, item) => {
  (mapa[item[campo]] = mapa[item[campo]] || []).push(item);
  return mapa;
}, {});

// Pesquisadores ativos (ou um específico), com modalidade
async function buscarPesquisadores({ usuarioId, incluirInativos = false } = {}) {
  const where = { perfil: 'PESQUISADOR' };
  if (usuarioId) where.id = usuarioId;
  if (!incluirInativos) where.ativo = true;
  return Usuario.findAll({
    where,
    include: [
      { model: Modalidade, as: 'modalidade' },
      { model: Usuario, as: 'orientador', attributes: ['id', 'nome'] }
    ],
    order: [['nome', 'ASC']]
  });
}

// Registros, abonos (justificativas aprovadas) e agendas de vários usuários num intervalo
async function buscarDados(usuarioIds, inicio, fim) {
  if (usuarioIds.length === 0) return { registros: {}, abonos: {}, horarios: {} };
  const [registros, abonos, horarios] = await Promise.all([
    Registro.findAll({
      where: { usuario_id: usuarioIds, entrada: { [Op.gte]: inicio, [Op.lt]: fim } },
      order: [['entrada', 'ASC']]
    }),
    Solicitacao.findAll({
      where: {
        usuario_id: usuarioIds, tipo: 'JUSTIFICATIVA_AUSENCIA', status: 'APROVADA',
        data: { [Op.gte]: chaveDia(inicio, FUSO), [Op.lt]: chaveDia(fim, FUSO) }
      }
    }),
    Horario.findAll({ where: { usuario_id: usuarioIds }, order: [['dia_semana', 'ASC'], ['hora_entrada', 'ASC']] })
  ]);
  return {
    registros: agruparPor(registros.map(r => r.toJSON()), 'usuario_id'),
    abonos: agruparPor(abonos.map(a => ({ usuario_id: a.usuario_id, data: a.data, minutos: a.minutos_abonados || 0 })), 'usuario_id'),
    horarios: agruparPor(horarios.map(h => h.toJSON()), 'usuario_id')
  };
}

// Saldo do banco de horas no fechamento do mês anterior (RN05)
async function saldosBancoAnteriores(mes, usuarioIds) {
  const anterior = await Fechamento.findOne({ where: { mes: mesAnterior(mes) } });
  if (!anterior) return {};
  const itens = await FechamentoItem.findAll({ where: { fechamento_id: anterior.id, usuario_id: usuarioIds } });
  return Object.fromEntries(itens.map(i => [i.usuario_id, i.saldo_banco_minutos]));
}

// Resumo do mês para uma lista de pesquisadores (RF06 / RF07)
async function resumosDoMes(mes, pesquisadores, { agora = new Date() } = {}) {
  const config = await obterConfiguracao();
  const { inicio, fim } = limitesMes(mes, FUSO);
  const ids = pesquisadores.map(p => p.id);
  const [dados, saldos] = await Promise.all([buscarDados(ids, inicio, fim), saldosBancoAnteriores(mes, ids)]);

  return pesquisadores.map(p => {
    const registros = dados.registros[p.id] || [];
    const horarios = dados.horarios[p.id] || [];
    const resumo = calc.resumoMensal({
      registros,
      abonos: dados.abonos[p.id] || [],
      modalidade: p.modalidade,
      mes,
      dataIngresso: p.data_ingresso,
      agora,
      fuso: FUSO,
      bancoHorasAtivo: config.banco_horas_ativo,
      saldoBancoAnterior: saldos[p.id] || 0
    });
    const atrasos = calc.calcularAtrasos(registros, horarios, config.tolerancia_atraso_minutos, FUSO);
    return {
      pesquisador: {
        id: p.id, nome: p.nome, numero_usp: p.numero_usp, email: p.email,
        modalidade: p.modalidade ? { id: p.modalidade.id, nome: p.modalidade.nome, horas_semanais: p.modalidade.horas_semanais } : null,
        orientador: p.orientador ? { id: p.orientador.id, nome: p.orientador.nome } : null,
        semAgenda: horarios.length === 0
      },
      resumo,
      atrasos
    };
  });
}

// Fração do mês já decorrida (para avaliar a frequência "até agora" no mês corrente)
function fracaoDecorrida(mes, agora = new Date()) {
  const atual = chaveMes(agora, FUSO);
  if (mes < atual) return 1;
  if (mes > atual) return 0;
  const [ano, m] = mes.split('-').map(Number);
  return Number(chaveDia(agora, FUSO).slice(8, 10)) / diasNoMes(ano, m);
}

// Painel do pesquisador: hoje, semana atual e mês (RF06 em tempo real)
async function painelDoPesquisador(usuarioId, agora = new Date()) {
  const [pesquisador] = await buscarPesquisadores({ usuarioId, incluirInativos: true });
  if (!pesquisador) return null;

  const hoje = chaveDia(agora, FUSO);
  const mes = hoje.slice(0, 7);
  const segunda = inicioSemana(hoje);
  const inicioBusca = limitesDia(segunda < `${mes}-01` ? segunda : `${mes}-01`, FUSO).inicio;
  const fimBusca = limitesDia(somarDias(hoje, 1), FUSO).inicio;

  const [dados, [doMes]] = await Promise.all([
    buscarDados([usuarioId], inicioBusca, fimBusca),
    resumosDoMes(mes, [pesquisador], { agora })
  ]);
  const registros = dados.registros[usuarioId] || [];
  const porDia = calc.minutosPorDia(registros, agora, FUSO);
  const abonosPorDia = {};
  for (const a of dados.abonos[usuarioId] || []) abonosPorDia[a.data] = (abonosPorDia[a.data] || 0) + a.minutos;

  let minutosSemana = 0;
  for (let i = 0; i < 7; i++) {
    const dia = somarDias(segunda, i);
    minutosSemana += (porDia[dia] || 0) + (abonosPorDia[dia] || 0);
  }
  const exigidoSemana = pesquisador.modalidade ? Math.round(pesquisador.modalidade.horas_semanais * 60) : 0;
  const aberto = registros.find(r => !r.saida) || await Registro.findOne({ where: { usuario_id: usuarioId, saida: null } });

  return {
    agora,
    hoje: {
      data: hoje,
      minutos: porDia[hoje] || 0,
      registros: registros.filter(r => chaveDia(r.entrada, FUSO) === hoje)
    },
    semana: {
      inicio: segunda, fim: somarDias(segunda, 6), minutos: minutosSemana, exigidos: exigidoSemana,
      faltantes: Math.max(0, exigidoSemana - minutosSemana), excedentes: Math.max(0, minutosSemana - exigidoSemana)
    },
    mes: doMes.resumo,
    atrasosNoMes: doMes.atrasos.length,
    registroAberto: aberto || null,
    agendaHoje: (dados.horarios[usuarioId] || []).filter(h => h.dia_semana === new Date(`${hoje}T12:00:00Z`).getUTCDay())
  };
}

module.exports = { buscarPesquisadores, buscarDados, resumosDoMes, painelDoPesquisador, fracaoDecorrida, FUSO };
