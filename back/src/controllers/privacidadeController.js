const { Usuario, Modalidade, Horario, Registro, Solicitacao, Notificacao } = require('../models');
const { auditar } = require('../services/auditoriaService');

// GET /api/privacidade/meus-dados — RNF07 (LGPD): direito de acesso do titular aos próprios dados
exports.meusDados = async (req, res) => {
  const id = req.usuario.id;
  const usuario = await Usuario.scope('completo').findByPk(id, { include: [{ model: Modalidade, as: 'modalidade' }] });
  const [horarios, registros, solicitacoes, notificacoes] = await Promise.all([
    Horario.findAll({ where: { usuario_id: id } }),
    Registro.findAll({ where: { usuario_id: id }, order: [['entrada', 'ASC']] }),
    Solicitacao.findAll({ where: { usuario_id: id }, order: [['created_at', 'ASC']] }),
    Notificacao.findAll({ where: { usuario_id: id }, order: [['created_at', 'ASC']] })
  ]);
  const cadastro = usuario.toJSON();
  delete cadastro.telefone_cripto;

  await auditar(req, { acao: 'EXPORTACAO_DADOS_PESSOAIS', entidade: 'usuario', entidadeId: id });
  res.setHeader('Content-Disposition', `attachment; filename="meus-dados-${usuario.numero_usp}.json"`);
  res.json({
    geradoEm: new Date(),
    cadastro: { ...cadastro, telefone: usuario.telefone },
    agendaSemanal: horarios,
    registrosDePonto: registros,
    solicitacoes,
    notificacoes
  });
};
