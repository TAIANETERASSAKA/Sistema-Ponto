const cron = require('node-cron');
const { Op } = require('sequelize');
const env = require('../config/env');
const { Fechamento, Registro } = require('../models');
const frequencia = require('../services/frequenciaService');
const calc = require('../services/calculoHoras');
const { notificar } = require('../services/notificacaoService');
const { fecharMes } = require('../services/fechamentoService');
const { obterConfiguracao } = require('../services/configuracaoService');
const { chaveDia, chaveMes, mesAnterior, partes, limitesDia, inicioSemana, somarDias, horaParaMinutos } = require('../utils/datas');

const FUSO = env.fusoHorario;

// Executa uma rotina sem deixar um erro derrubar o servidor
const seguro = (nome, rotina) => async () => {
  try {
    await rotina();
  } catch (erro) {
    console.error(`[rotina ${nome}]`, erro);
  }
};

// RF10 — lembrete de registro de entrada e de saída esquecida
async function enviarLembretes() {
  const config = await obterConfiguracao();
  if (!config.lembretes_ativos) return;

  const agora = new Date();
  const hoje = chaveDia(agora, FUSO);
  const p = partes(agora, FUSO);
  const minutoAtual = p.hora * 60 + p.minuto;
  const pesquisadores = await frequencia.buscarPesquisadores();
  const { inicio, fim } = limitesDia(hoje, FUSO);
  const dados = await frequencia.buscarDados(pesquisadores.map(x => x.id), inicio, fim);

  for (const pesquisador of pesquisadores) {
    const agendaHoje = (dados.horarios[pesquisador.id] || []).filter(h => h.dia_semana === p.diaSemana);
    if (!agendaHoje.length) continue;
    const registros = dados.registros[pesquisador.id] || [];
    const entradaPrevista = Math.min(...agendaHoje.map(h => horaParaMinutos(h.hora_entrada.slice(0, 5))));
    const saidaPrevista = Math.max(...agendaHoje.map(h => horaParaMinutos(h.hora_saida.slice(0, 5))));

    if (!registros.length && minutoAtual > entradaPrevista + config.tolerancia_atraso_minutos) {
      await notificar(pesquisador.id, {
        tipo: 'LEMBRETE_REGISTRO', titulo: 'Lembrete: registre sua entrada',
        mensagem: 'Sua agenda prevê expediente hoje e ainda não há registro de entrada. Se você já está no laboratório, registre o ponto.',
        link: '/', chave: `lembrete-entrada-${hoje}`
      });
    }
    const aberto = registros.find(r => !r.saida);
    if (aberto && minutoAtual > saidaPrevista + 60) {
      await notificar(pesquisador.id, {
        tipo: 'LEMBRETE_REGISTRO', titulo: 'Você esqueceu de registrar a saída?',
        mensagem: 'Sua entrada continua aberta, mas o horário previsto de saída já passou. Registre a saída ou solicite uma correção.',
        link: '/', chave: `lembrete-saida-${hoje}`
      });
    }
  }
}

// RF10 — alerta semanal de carga horária insuficiente (sexta-feira à tarde)
async function alertarCargaSemanal() {
  const agora = new Date();
  const segunda = inicioSemana(chaveDia(agora, FUSO));
  const pesquisadores = await frequencia.buscarPesquisadores();
  const dados = await frequencia.buscarDados(
    pesquisadores.map(x => x.id), limitesDia(segunda, FUSO).inicio, limitesDia(somarDias(segunda, 6), FUSO).fim
  );

  for (const pesquisador of pesquisadores) {
    if (!pesquisador.modalidade) continue;
    const realizados = (dados.registros[pesquisador.id] || []).reduce((s, r) => s + calc.minutosDoRegistro(r, agora), 0);
    const abonados = (dados.abonos[pesquisador.id] || []).reduce((s, a) => s + a.minutos, 0);
    const exigidos = Math.round(pesquisador.modalidade.horas_semanais * 60);
    const faltam = exigidos - realizados - abonados;
    if (faltam > 0) {
      await notificar(pesquisador.id, {
        tipo: 'CARGA_INSUFICIENTE', titulo: 'Carga horária da semana abaixo do mínimo',
        mensagem: `Nesta semana você registrou ${calc.formatarMinutos(realizados + abonados)} de ${calc.formatarMinutos(exigidos)}. Faltam ${calc.formatarMinutos(faltam)}.`,
        link: '/historico', chave: `carga-semana-${segunda}`
      });
    }
  }
}

// RN03 — fecha o mês anterior se ainda não foi fechado (também recupera se o servidor estava fora do ar)
async function fecharMesAnteriorSePreciso() {
  const mes = mesAnterior(chaveMes(new Date(), FUSO));
  if (await Fechamento.findOne({ where: { mes } })) return;
  // Só fecha meses em que houve atividade no sistema
  if (!(await Registro.findOne({ where: { entrada: { [Op.lt]: new Date() } } }))) return;
  await fecharMes(mes);
  console.log(`Fechamento automático de ${mes} gerado.`);
}

function iniciarAgendador() {
  if (!env.jobsAtivos) return;
  const opcoes = { timezone: FUSO };
  cron.schedule('*/10 6-23 * * *', seguro('lembretes', enviarLembretes), opcoes);
  cron.schedule('0 17 * * 5', seguro('carga semanal', alertarCargaSemanal), opcoes);
  cron.schedule('30 0 1 * *', seguro('fechamento', fecharMesAnteriorSePreciso), opcoes);
  seguro('fechamento', fecharMesAnteriorSePreciso)();
}

module.exports = { iniciarAgendador, enviarLembretes, alertarCargaSemanal, fecharMesAnteriorSePreciso };
