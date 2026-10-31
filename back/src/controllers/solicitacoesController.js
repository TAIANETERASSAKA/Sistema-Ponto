const { Op } = require('sequelize');
const { sequelize, Solicitacao, Registro, Usuario, Horario, TIPOS_SOLICITACAO } = require('../models');
const { auditar } = require('../services/auditoriaService');
const { notificar } = require('../services/notificacaoService');
const calc = require('../services/calculoHoras');
const { salvarRegistroManual } = require('./registrosController');
const { chaveDia, limitesDia, diaDaSemana } = require('../utils/datas');
const { FUSO } = require('../services/frequenciaService');
const { invalido, naoEncontrado, proibido, conflito } = require('../utils/erros');
const v = require('../utils/validacao');

const ROTULOS = {
  JUSTIFICATIVA_AUSENCIA: 'Justificativa de ausência',
  CORRECAO_REGISTRO: 'Correção de registro',
  INCLUSAO_HORAS: 'Inclusão de horas esquecidas'
};
const INCLUDES = [
  { model: Usuario, as: 'usuario', attributes: ['id', 'nome', 'numero_usp'] },
  { model: Usuario, as: 'avaliadoPor', attributes: ['id', 'nome'] },
  { model: Registro, as: 'registro' }
];

// Valida os dados da solicitação de acordo com o tipo (RF09)
async function lerDados(body, usuarioId, solicitacaoId = null) {
  const tipo = body.tipo;
  if (!TIPOS_SOLICITACAO.includes(tipo)) throw invalido('Tipo de solicitação inválido.');
  const motivo = v.texto(body.motivo, 'o motivo', { max: 2000 });
  if (motivo.length < 10) throw invalido('Descreva o motivo com pelo menos 10 caracteres.');
  const hoje = chaveDia(new Date(), FUSO);

  if (tipo === 'JUSTIFICATIVA_AUSENCIA') {
    const data = v.dia(body.data, 'a data da ausência');
    if (data > hoje) throw invalido('Não é possível justificar uma ausência futura.');
    const where = { usuario_id: usuarioId, tipo, data, status: { [Op.in]: ['PENDENTE', 'APROVADA', 'REVISAO'] } };
    if (solicitacaoId) where.id = { [Op.ne]: solicitacaoId };
    if (await Solicitacao.findOne({ where })) throw conflito('Já existe uma justificativa para este dia.');
    return { tipo, motivo, data, registro_id: null, entrada_proposta: null, saida_proposta: null };
  }

  let registro = null;
  if (tipo === 'CORRECAO_REGISTRO') {
    registro = await Registro.findByPk(v.id(body.registro_id, 'o registro a corrigir'));
    if (!registro || registro.usuario_id !== usuarioId) throw invalido('Registro não encontrado.');
  }

  // Mesmas regras do registro manual (RN02), olhando só os registros próximos
  await salvarRegistroManual({ usuarioId, entrada: body.entrada_proposta, saida: body.saida_proposta, registro });

  return {
    tipo, motivo,
    data: chaveDia(body.entrada_proposta, FUSO),
    registro_id: registro?.id || null,
    entrada_proposta: new Date(body.entrada_proposta),
    saida_proposta: new Date(body.saida_proposta)
  };
}

// Avisa a gestão que há uma solicitação pendente
async function avisarGestao(solicitacao, nomePesquisador) {
  const gestores = await Usuario.findAll({ where: { perfil: { [Op.in]: ['ADMIN', 'COORDENADOR'] }, ativo: true } });
  await Promise.all(gestores.map(g => notificar(g.id, {
    tipo: 'SOLICITACAO_PENDENTE',
    titulo: 'Nova solicitação para avaliar',
    mensagem: `${nomePesquisador} enviou: ${ROTULOS[solicitacao.tipo]} (${solicitacao.data.split('-').reverse().join('/')}).`,
    link: '/solicitacoes'
  }, { email: false })));
}

// GET /api/solicitacoes/minhas
exports.minhas = async (req, res) => {
  const solicitacoes = await Solicitacao.findAll({ where: { usuario_id: req.usuario.id }, include: INCLUDES, order: [['created_at', 'DESC']] });
  res.json({ solicitacoes });
};

// GET /api/solicitacoes?status= (gestão)
exports.listar = async (req, res) => {
  const where = {};
  if (req.query.status) where.status = req.query.status;
  if (req.query.usuario_id) where.usuario_id = req.query.usuario_id;
  const solicitacoes = await Solicitacao.findAll({ where, include: INCLUDES, order: [['created_at', 'DESC']], limit: 500 });
  res.json({ solicitacoes });
};

// POST /api/solicitacoes
exports.criar = async (req, res) => {
  const solicitacao = await Solicitacao.create({ usuario_id: req.usuario.id, ...(await lerDados(req.body, req.usuario.id)) });
  await auditar(req, { acao: 'SOLICITACAO_CRIADA', entidade: 'solicitacao', entidadeId: solicitacao.id, depois: solicitacao });
  await avisarGestao(solicitacao, req.usuario.nome);
  res.status(201).json({ solicitacao });
};

// PUT /api/solicitacoes/:id — o pesquisador corrige uma solicitação pendente ou devolvida para revisão
exports.editar = async (req, res) => {
  const solicitacao = await Solicitacao.findByPk(req.params.id);
  if (!solicitacao || solicitacao.usuario_id !== req.usuario.id) throw naoEncontrado('Solicitação');
  if (!['PENDENTE', 'REVISAO'].includes(solicitacao.status)) throw invalido('Esta solicitação já foi avaliada.');

  const antes = solicitacao.toJSON();
  await solicitacao.update({ ...(await lerDados(req.body, req.usuario.id, solicitacao.id)), status: 'PENDENTE' });
  await auditar(req, { acao: 'SOLICITACAO_EDITADA', entidade: 'solicitacao', entidadeId: solicitacao.id, antes, depois: solicitacao });
  if (antes.status === 'REVISAO') await avisarGestao(solicitacao, req.usuario.nome);
  res.json({ solicitacao });
};

// DELETE /api/solicitacoes/:id — o pesquisador cancela uma solicitação ainda não avaliada
exports.cancelar = async (req, res) => {
  const solicitacao = await Solicitacao.findByPk(req.params.id);
  if (!solicitacao || solicitacao.usuario_id !== req.usuario.id) throw naoEncontrado('Solicitação');
  if (!['PENDENTE', 'REVISAO'].includes(solicitacao.status)) throw invalido('Esta solicitação já foi avaliada.');
  await solicitacao.destroy();
  await auditar(req, { acao: 'SOLICITACAO_CANCELADA', entidade: 'solicitacao', entidadeId: solicitacao.id, antes: solicitacao });
  res.json({ sucesso: true });
};

// Aplica o efeito de uma solicitação aprovada
async function aplicarAprovacao(req, solicitacao, transaction) {
  if (solicitacao.tipo === 'JUSTIFICATIVA_AUSENCIA') {
    // Abona as horas planejadas do dia que não foram trabalhadas
    const horarios = await Horario.findAll({ where: { usuario_id: solicitacao.usuario_id }, transaction });
    const planejado = calc.minutosPlanejadosNoDia(horarios, diaDaSemana(solicitacao.data));
    const { inicio, fim } = limitesDia(solicitacao.data, FUSO);
    const registros = await Registro.findAll({
      where: { usuario_id: solicitacao.usuario_id, entrada: { [Op.gte]: inicio, [Op.lt]: fim } }, transaction
    });
    const trabalhado = registros.reduce((s, r) => s + calc.minutosDoRegistro(r), 0);
    return { minutos_abonados: Math.max(0, planejado - trabalhado) };
  }

  const registroAlvo = solicitacao.registro_id
    ? await Registro.findByPk(solicitacao.registro_id, { transaction, lock: transaction.LOCK.UPDATE })
    : null;
  if (solicitacao.tipo === 'CORRECAO_REGISTRO' && !registroAlvo) {
    throw invalido('O registro desta correção não existe mais.');
  }
  const horario = await salvarRegistroManual({
    usuarioId: solicitacao.usuario_id, entrada: solicitacao.entrada_proposta, saida: solicitacao.saida_proposta,
    registro: registroAlvo, transaction
  });
  const observacao = `${ROTULOS[solicitacao.tipo]} aprovada (solicitação nº ${solicitacao.id}).`;

  if (registroAlvo) {
    const antes = registroAlvo.toJSON();
    await registroAlvo.update({
      ...horario, origem: 'AJUSTE', observacao: [registroAlvo.observacao, observacao].filter(Boolean).join('\n')
    }, { transaction });
    await auditar(req, { acao: 'REGISTRO_AJUSTADO', entidade: 'registro', entidadeId: registroAlvo.id, antes, depois: registroAlvo }, transaction);
    return {};
  }
  const novo = await Registro.create({
    usuario_id: solicitacao.usuario_id, ...horario, origem: 'AJUSTE', observacao, criado_por_id: req.usuario.id
  }, { transaction });
  await auditar(req, { acao: 'REGISTRO_INCLUIDO', entidade: 'registro', entidadeId: novo.id, depois: novo }, transaction);
  return { registro_id: novo.id };
}

// POST /api/solicitacoes/:id/avaliar — aprovar, rejeitar ou pedir revisão (RF09)
exports.avaliar = async (req, res) => {
  const decisao = req.body.decisao;
  if (!['APROVADA', 'REJEITADA', 'REVISAO'].includes(decisao)) throw invalido('Decisão inválida.');
  const resposta = v.texto(req.body.resposta, 'a resposta ao pesquisador', { obrigatorio: decisao !== 'APROVADA', max: 2000 });

  const solicitacao = await sequelize.transaction(async (transaction) => {
    const s = await Solicitacao.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!s) throw naoEncontrado('Solicitação');
    if (s.status !== 'PENDENTE') throw conflito('Esta solicitação não está pendente de avaliação.');
    if (s.usuario_id === req.usuario.id) throw proibido('Você não pode avaliar a própria solicitação.');

    const antes = s.toJSON();
    const efeitos = decisao === 'APROVADA' ? await aplicarAprovacao(req, s, transaction) : {};
    await s.update({ ...efeitos, status: decisao, resposta, avaliado_por_id: req.usuario.id, avaliado_em: new Date() }, { transaction });
    await auditar(req, { acao: 'SOLICITACAO_AVALIADA', entidade: 'solicitacao', entidadeId: s.id, antes, depois: s }, transaction);
    return s;
  });

  // RF10 — aviso de aprovação ou rejeição
  const textos = {
    APROVADA: ['Solicitação aprovada', 'foi aprovada'],
    REJEITADA: ['Solicitação rejeitada', 'foi rejeitada'],
    REVISAO: ['Solicitação devolvida para revisão', 'precisa de revisão']
  };
  const [titulo, verbo] = textos[decisao];
  await notificar(solicitacao.usuario_id, {
    tipo: `SOLICITACAO_${decisao}`,
    titulo,
    mensagem: `Sua solicitação "${ROTULOS[solicitacao.tipo]}" de ${solicitacao.data.split('-').reverse().join('/')} ${verbo}.` +
      (resposta ? ` Resposta: ${resposta}` : ''),
    link: '/minhas-solicitacoes'
  });

  res.json({ solicitacao: await Solicitacao.findByPk(solicitacao.id, { include: INCLUDES }) });
};
