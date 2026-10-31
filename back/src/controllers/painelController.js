const { Registro, Solicitacao, Fechamento, Usuario } = require('../models');
const frequencia = require('../services/frequenciaService');
const calc = require('../services/calculoHoras');
const { obterConfiguracao } = require('../services/configuracaoService');
const { chaveDia, limitesDia, partes, horaParaMinutos } = require('../utils/datas');

const DOZE_HORAS = 12 * 60;

// GET /api/painel — painel gerencial (RF08)
exports.painel = async (req, res) => {
  const agora = new Date();
  const FUSO = frequencia.FUSO;
  const hoje = chaveDia(agora, FUSO);
  const mes = hoje.slice(0, 7);
  const config = await obterConfiguracao();

  const pesquisadores = await frequencia.buscarPesquisadores();
  const ids = pesquisadores.map(p => p.id);
  const { inicio, fim } = limitesDia(hoje, FUSO);

  const [resumos, dadosHoje, abertos, pendentes, fechamentos] = await Promise.all([
    frequencia.resumosDoMes(mes, pesquisadores, { agora }),
    frequencia.buscarDados(ids, inicio, fim),
    Registro.findAll({ where: { saida: null, usuario_id: ids }, include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nome'] }] }),
    Solicitacao.count({ where: { status: 'PENDENTE' } }),
    Fechamento.findAll({ order: [['mes', 'DESC']], limit: 6 })
  ]);

  const fracao = frequencia.fracaoDecorrida(mes, agora);
  const p = partes(agora, FUSO);
  const minutoAtual = p.hora * 60 + p.minuto;

  const alertas = [];
  let comAgendaHoje = 0;
  let presentesHoje = 0;

  for (const { pesquisador } of resumos) {
    const registrosHoje = dadosHoje.registros[pesquisador.id] || [];
    const horarios = dadosHoje.horarios[pesquisador.id] || [];
    const agendaHoje = horarios.filter(h => h.dia_semana === p.diaSemana);
    if (registrosHoje.length) presentesHoje++;

    if (agendaHoje.length) {
      comAgendaHoje++;
      const primeiraEntrada = Math.min(...agendaHoje.map(h => horaParaMinutos(h.hora_entrada.slice(0, 5))));
      if (!registrosHoje.length && minutoAtual > primeiraEntrada + config.tolerancia_atraso_minutos) {
        alertas.push({ tipo: 'AUSENTE_HOJE', severidade: 'media', pesquisadorId: pesquisador.id,
          mensagem: `${pesquisador.nome} ainda não registrou entrada hoje (previsto ${agendaHoje[0].hora_entrada.slice(0, 5)}).` });
      }
    }

    for (const atraso of calc.calcularAtrasos(registrosHoje, horarios, config.tolerancia_atraso_minutos, FUSO)) {
      alertas.push({ tipo: 'ATRASO', severidade: 'baixa', pesquisadorId: pesquisador.id,
        mensagem: `${pesquisador.nome} entrou com ${atraso.minutosAtraso} min de atraso hoje.` });
    }

    if (pesquisador.semAgenda) {
      alertas.push({ tipo: 'SEM_AGENDA', severidade: 'baixa', pesquisadorId: pesquisador.id,
        mensagem: `${pesquisador.nome} ainda não definiu a agenda semanal.` });
    } else if (pesquisador.modalidade) {
      const { minutosSemanais } = calc.validarAgenda(horarios.map(h => ({
        ...h, hora_entrada: h.hora_entrada.slice(0, 5), hora_saida: h.hora_saida.slice(0, 5)
      })), null);
      const minimo = Math.round(pesquisador.modalidade.horas_semanais * 60);
      if (minutosSemanais < minimo) {
        alertas.push({ tipo: 'AGENDA_INSUFICIENTE', severidade: 'media', pesquisadorId: pesquisador.id,
          mensagem: `A agenda de ${pesquisador.nome} (${calc.formatarMinutos(minutosSemanais)}) está abaixo do mínimo de ${calc.formatarMinutos(minimo)}.` });
      }
    }
  }

  for (const registro of abertos) {
    const minutos = calc.minutosEntre(registro.entrada, agora);
    if (minutos > DOZE_HORAS) {
      alertas.push({ tipo: 'REGISTRO_ABERTO', severidade: 'alta', pesquisadorId: registro.usuario_id,
        mensagem: `${registro.usuario.nome} está com a entrada aberta há ${calc.formatarMinutos(minutos)} (possível saída esquecida).` });
    }
  }

  // Frequência proporcional ao que já passou do mês
  const comparativo = resumos.map(({ pesquisador, resumo, atrasos }) => {
    const esperado = Math.round(resumo.minutosExigidos * fracao);
    return {
      pesquisador,
      percentualMes: resumo.percentual,
      minutosConsiderados: resumo.minutosConsiderados,
      minutosExigidos: resumo.minutosExigidos,
      minutosEsperadosAteHoje: esperado,
      percentualEsperado: esperado > 0 ? calc.percentual(resumo.minutosConsiderados, esperado) : 100,
      atrasos: atrasos.length
    };
  });

  const ranking = [...comparativo].sort((a, b) => b.percentualEsperado - a.percentualEsperado);
  const baixaFrequencia = comparativo
    .filter(c => c.minutosEsperadosAteHoje > 0 && c.percentualEsperado < config.percentual_frequencia_baixa)
    .sort((a, b) => a.percentualEsperado - b.percentualEsperado);

  const ordemSeveridade = { alta: 0, media: 1, baixa: 2 };
  alertas.sort((a, b) => ordemSeveridade[a.severidade] - ordemSeveridade[b.severidade]);

  const totalMinutosMes = resumos.reduce((s, r) => s + r.resumo.minutosRealizados, 0);
  res.json({
    data: hoje,
    mes,
    fracaoDecorrida: fracao,
    indicadores: {
      pesquisadoresAtivos: pesquisadores.length,
      presentesAgora: abertos.length,
      presentesHoje,
      comAgendaHoje,
      taxaPresencaHoje: comAgendaHoje ? calc.percentual(Math.min(presentesHoje, comAgendaHoje), comAgendaHoje) : null,
      solicitacoesPendentes: pendentes
    },
    ranking,
    baixaFrequencia,
    alertas,
    estatisticas: {
      minutosRealizadosMes: totalMinutosMes,
      mediaPercentualEsperado: comparativo.length
        ? Math.round(comparativo.reduce((s, c) => s + Math.min(c.percentualEsperado, 150), 0) / comparativo.length * 10) / 10
        : null,
      emDiaAteHoje: comparativo.filter(c => c.percentualEsperado >= 100).length,
      evolucao: fechamentos.reverse().map(f => ({
        mes: f.mes,
        totalPesquisadores: f.total_pesquisadores,
        totalCumpriram: f.total_cumpriram,
        taxaCumprimento: f.total_pesquisadores ? calc.percentual(f.total_cumpriram, f.total_pesquisadores) : null
      }))
    },
    presentesAgora: abertos.map(r => ({ id: r.usuario_id, nome: r.usuario.nome, entrada: r.entrada }))
  });
};
