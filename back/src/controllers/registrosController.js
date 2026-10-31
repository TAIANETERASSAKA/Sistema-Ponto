const { Op } = require('sequelize');
const { sequelize, Registro, Usuario } = require('../models');
const { auditar } = require('../services/auditoriaService');
const frequencia = require('../services/frequenciaService');
const calc = require('../services/calculoHoras');
const { limitesMes, chaveMes } = require('../utils/datas');
const { invalido, naoEncontrado, conflito } = require('../utils/erros');
const v = require('../utils/validacao');

const UM_DIA = 24 * 60 * 60 * 1000;
const ehMobile = (ua = '') => /Mobi|Android|iPhone|iPad|iPod/i.test(ua);

// Registros vizinhos (±1 dia) para checar sobreposição (RN02)
async function registrosVizinhos(usuarioId, entrada, saida, ignorarId, transaction) {
  const where = {
    usuario_id: usuarioId,
    entrada: { [Op.lt]: new Date(new Date(saida).getTime() + UM_DIA) },
    [Op.or]: [{ saida: null }, { saida: { [Op.gt]: new Date(new Date(entrada).getTime() - UM_DIA) } }]
  };
  if (ignorarId) where.id = { [Op.ne]: ignorarId };
  return Registro.findAll({ where, transaction });
}

// Valida e grava um registro informado manualmente (usado por ajustes e solicitações aprovadas)
async function salvarRegistroManual({ usuarioId, entrada, saida, registro = null, transaction }) {
  const outros = await registrosVizinhos(usuarioId, entrada, saida, registro?.id, transaction);
  const erro = calc.validarRegistroManual({ entrada, saida, outros });
  if (erro) throw invalido(erro);
  return { entrada: new Date(entrada), saida: new Date(saida) };
}

const pesquisadorDoPonto = (usuario) => {
  if (!usuario.modalidade_id) {
    throw invalido('O registro de ponto é exclusivo de pesquisadores com modalidade cadastrada.');
  }
};

// GET /api/registros/painel — resumo do pesquisador logado (hoje, semana, mês)
exports.meuPainel = async (req, res) => {
  res.json(await frequencia.painelDoPesquisador(req.usuario.id));
};

// POST /api/registros/entrada (RF05)
exports.registrarEntrada = async (req, res) => {
  pesquisadorDoPonto(req.usuario);
  const aberto = await Registro.findOne({ where: { usuario_id: req.usuario.id, saida: null } });
  if (aberto) throw conflito('Você já registrou a entrada. Registre a saída antes de uma nova entrada.');

  const ua = req.get('user-agent') || '';
  // O horário vem do relógio do servidor, nunca do aparelho do usuário
  const registro = await Registro.create({
    usuario_id: req.usuario.id,
    entrada: new Date(),
    origem: ehMobile(ua) ? 'MOBILE' : 'WEB',
    ip: req.ip,
    user_agent: ua.slice(0, 300),
    criado_por_id: req.usuario.id
  });
  await auditar(req, { acao: 'PONTO_ENTRADA', entidade: 'registro', entidadeId: registro.id, depois: registro });
  res.status(201).json({ registro });
};

// POST /api/registros/saida (RF05)
exports.registrarSaida = async (req, res) => {
  const registro = await Registro.findOne({ where: { usuario_id: req.usuario.id, saida: null } });
  if (!registro) throw invalido('Não há entrada em aberto. Registre a entrada primeiro.');

  const agora = new Date();
  if (calc.minutosEntre(registro.entrada, agora) > calc.DURACAO_MAXIMA_REGISTRO) {
    throw invalido('Sua entrada está aberta há mais de 24 horas. Solicite uma correção de registro informando o horário real de saída.');
  }
  const antes = registro.toJSON();
  await registro.update({ saida: agora });
  await auditar(req, { acao: 'PONTO_SAIDA', entidade: 'registro', entidadeId: registro.id, antes, depois: registro });
  res.json({ registro });
};

// Lista de registros de um usuário no mês, com o resumo calculado
async function registrosDoMes(usuarioId, mes) {
  const { inicio, fim } = limitesMes(mes, frequencia.FUSO);
  const [pesquisador] = await frequencia.buscarPesquisadores({ usuarioId, incluirInativos: true });
  if (!pesquisador) throw naoEncontrado('Pesquisador');

  const [registros, [doMes]] = await Promise.all([
    Registro.findAll({
      where: { usuario_id: usuarioId, entrada: { [Op.gte]: inicio, [Op.lt]: fim } },
      include: [{ model: Usuario, as: 'criadoPor', attributes: ['id', 'nome'] }],
      order: [['entrada', 'ASC']]
    }),
    frequencia.resumosDoMes(mes, [pesquisador])
  ]);
  return { pesquisador: doMes.pesquisador, registros, resumo: doMes.resumo, atrasos: doMes.atrasos };
}

// GET /api/registros/meus?mes=AAAA-MM
exports.meusRegistros = async (req, res) => {
  const mes = req.query.mes ? v.mes(req.query.mes) : chaveMes(new Date(), frequencia.FUSO);
  res.json(await registrosDoMes(req.usuario.id, mes));
};

// GET /api/registros/usuario/:id?mes=AAAA-MM (gestão)
exports.registrosDoUsuario = async (req, res) => {
  const mes = req.query.mes ? v.mes(req.query.mes) : chaveMes(new Date(), frequencia.FUSO);
  res.json(await registrosDoMes(v.id(req.params.id), mes));
};

// POST /api/registros/manual — registro manual autorizado pelo administrador (RF05)
exports.criarManual = async (req, res) => {
  const usuarioId = v.id(req.body.usuario_id, 'o pesquisador');
  const observacao = v.texto(req.body.observacao, 'o motivo do registro manual', { max: 1000 });
  const usuario = await Usuario.findByPk(usuarioId);
  if (!usuario) throw naoEncontrado('Pesquisador');
  pesquisadorDoPonto(usuario);

  const registro = await sequelize.transaction(async (transaction) => {
    const horario = await salvarRegistroManual({ usuarioId, entrada: req.body.entrada, saida: req.body.saida, transaction });
    const novo = await Registro.create({
      usuario_id: usuarioId, ...horario, origem: 'MANUAL', observacao, criado_por_id: req.usuario.id, ip: req.ip
    }, { transaction });
    await auditar(req, { acao: 'REGISTRO_MANUAL', entidade: 'registro', entidadeId: novo.id, depois: novo }, transaction);
    return novo;
  });
  res.status(201).json({ registro });
};

// PUT /api/registros/:id — ajuste de registro pelo administrador (RF12: guarda antes e depois)
exports.ajustar = async (req, res) => {
  const motivo = v.texto(req.body.motivo, 'o motivo do ajuste', { max: 1000 });
  const registro = await sequelize.transaction(async (transaction) => {
    const existente = await Registro.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
    if (!existente) throw naoEncontrado('Registro');
    const antes = existente.toJSON();
    const horario = await salvarRegistroManual({
      usuarioId: existente.usuario_id, entrada: req.body.entrada, saida: req.body.saida, registro: existente, transaction
    });
    await existente.update({
      ...horario,
      origem: 'AJUSTE',
      observacao: [existente.observacao, `Ajuste: ${motivo}`].filter(Boolean).join('\n')
    }, { transaction });
    await auditar(req, { acao: 'REGISTRO_AJUSTADO', entidade: 'registro', entidadeId: existente.id, antes, depois: { ...existente.toJSON(), motivo } }, transaction);
    return existente;
  });
  res.json({ registro });
};

// DELETE /api/registros/:id — exclusão pelo administrador, com motivo obrigatório
exports.excluir = async (req, res) => {
  const motivo = v.texto(req.body?.motivo, 'o motivo da exclusão', { max: 1000 });
  const registro = await Registro.findByPk(req.params.id);
  if (!registro) throw naoEncontrado('Registro');
  await sequelize.transaction(async (transaction) => {
    await registro.destroy({ transaction });
    await auditar(req, { acao: 'REGISTRO_EXCLUIDO', entidade: 'registro', entidadeId: registro.id, antes: registro, depois: { motivo } }, transaction);
  });
  res.json({ sucesso: true });
};

exports.salvarRegistroManual = salvarRegistroManual;
