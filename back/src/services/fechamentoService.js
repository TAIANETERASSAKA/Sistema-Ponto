const { Op } = require('sequelize');
const { sequelize, Fechamento, FechamentoItem, Usuario } = require('../models');
const frequencia = require('./frequenciaService');
const { notificar } = require('./notificacaoService');
const { auditar } = require('./auditoriaService');
const { formatarMinutos } = require('./calculoHoras');
const { chaveMes } = require('../utils/datas');
const { invalido } = require('../utils/erros');

const nomeMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

/**
 * RN03 — fechamento mensal: consolida os registros, gera o relatório e identifica pendências.
 * Pode ser reprocessado (ex: após aprovar uma justificativa atrasada); os avisos só são enviados na primeira vez.
 */
async function fecharMes(mes, { geradoPorId = null, req = null } = {}) {
  if (mes >= chaveMes(new Date(), frequencia.FUSO)) {
    throw invalido('Só é possível fechar meses que já terminaram.');
  }

  const pesquisadores = await frequencia.buscarPesquisadores();
  const resumos = await frequencia.resumosDoMes(mes, pesquisadores);
  const exigiveis = resumos.filter(r => r.resumo.minutosExigidos > 0);

  const { fechamento, primeiraVez } = await sequelize.transaction(async (transaction) => {
    const existente = await Fechamento.findOne({ where: { mes }, transaction, lock: transaction.LOCK.UPDATE });
    const dados = {
      mes,
      gerado_por_id: geradoPorId,
      total_pesquisadores: exigiveis.length,
      total_cumpriram: exigiveis.filter(r => r.resumo.cumpriu).length
    };
    const registro = existente ? await existente.update(dados, { transaction }) : await Fechamento.create(dados, { transaction });
    await FechamentoItem.destroy({ where: { fechamento_id: registro.id }, transaction });
    await FechamentoItem.bulkCreate(exigiveis.map(({ pesquisador, resumo, atrasos }) => ({
      fechamento_id: registro.id,
      usuario_id: pesquisador.id,
      modalidade_nome: pesquisador.modalidade?.nome || null,
      minutos_exigidos: resumo.minutosExigidos,
      minutos_realizados: resumo.minutosRealizados,
      minutos_abonados: resumo.minutosAbonados,
      saldo_minutos: resumo.saldoMinutos,
      saldo_banco_minutos: resumo.saldoBancoMinutos,
      percentual: resumo.percentual,
      cumpriu: resumo.cumpriu,
      dias_trabalhados: resumo.diasTrabalhados,
      atrasos: atrasos.length
    })), { transaction });
    await auditar(req, {
      acao: existente ? 'FECHAMENTO_REPROCESSADO' : 'FECHAMENTO_GERADO', entidade: 'fechamento', entidadeId: registro.id,
      depois: dados, usuarioId: geradoPorId
    }, transaction);
    return { fechamento: registro, primeiraVez: !existente };
  });

  if (primeiraVez) await enviarAvisosDeFechamento(mes, exigiveis);
  return fechamento;
}

// RF10 — encerramento mensal e alerta de carga horária insuficiente
async function enviarAvisosDeFechamento(mes, resumos) {
  const rotulo = nomeMes(mes);
  for (const { pesquisador, resumo } of resumos) {
    const mensagem = resumo.cumpriu
      ? `O mês de ${rotulo} foi encerrado. Você cumpriu ${resumo.percentual}% da carga horária (${formatarMinutos(resumo.minutosConsiderados)} de ${formatarMinutos(resumo.minutosExigidos)}).`
      : `O mês de ${rotulo} foi encerrado com carga horária insuficiente: ${formatarMinutos(resumo.minutosConsiderados)} de ${formatarMinutos(resumo.minutosExigidos)} (${resumo.percentual}%). Faltaram ${formatarMinutos(resumo.minutosFaltantes)}.`;
    await notificar(pesquisador.id, {
      tipo: resumo.cumpriu ? 'ENCERRAMENTO_MENSAL' : 'CARGA_INSUFICIENTE',
      titulo: resumo.cumpriu ? `Encerramento de ${rotulo}` : `Carga horária insuficiente em ${rotulo}`,
      mensagem, link: '/historico', chave: `fechamento-${mes}`
    });
  }

  const pendentes = resumos.filter(r => !r.resumo.cumpriu);
  const gestores = await Usuario.findAll({ where: { perfil: { [Op.in]: ['ADMIN', 'COORDENADOR'] }, ativo: true } });
  for (const gestor of gestores) {
    await notificar(gestor.id, {
      tipo: 'ENCERRAMENTO_MENSAL',
      titulo: `Fechamento de ${rotulo} disponível`,
      mensagem: `${resumos.length - pendentes.length} de ${resumos.length} pesquisadores cumpriram a carga horária.` +
        (pendentes.length ? ` Pendências: ${pendentes.map(p => p.pesquisador.nome).join(', ')}.` : ''),
      link: `/relatorios?mes=${mes}`, chave: `fechamento-${mes}`
    });
  }
}

module.exports = { fecharMes, nomeMes };
