const { obterConfiguracao } = require('../services/configuracaoService');
const { auditar } = require('../services/auditoriaService');
const v = require('../utils/validacao');

exports.obter = async (req, res) => {
  res.json({ configuracao: await obterConfiguracao() });
};

// RN04 (tolerância), RN05 (banco de horas), RF10 (lembretes e e-mails), RF08 (frequência baixa)
exports.atualizar = async (req, res) => {
  const configuracao = await obterConfiguracao();
  const antes = configuracao.toJSON();
  await configuracao.update({
    tolerancia_atraso_minutos: v.numero(req.body.tolerancia_atraso_minutos, 'a tolerância de atraso', { min: 0, max: 240, inteiro: true }),
    banco_horas_ativo: v.booleano(req.body.banco_horas_ativo),
    lembretes_ativos: v.booleano(req.body.lembretes_ativos),
    emails_ativos: v.booleano(req.body.emails_ativos),
    percentual_frequencia_baixa: v.numero(req.body.percentual_frequencia_baixa, 'o percentual de frequência baixa', { min: 1, max: 100, inteiro: true })
  });
  await auditar(req, { acao: 'CONFIGURACAO_ALTERADA', entidade: 'configuracao', entidadeId: 1, antes, depois: configuracao });
  res.json({ configuracao });
};
