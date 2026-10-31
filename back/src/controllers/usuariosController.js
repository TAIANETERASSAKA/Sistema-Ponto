const { Op } = require('sequelize');
const { Usuario, Modalidade, PERFIS } = require('../models');
const { auditar } = require('../services/auditoriaService');
const { naoEncontrado, invalido } = require('../utils/erros');
const { chaveDia } = require('../utils/datas');
const v = require('../utils/validacao');

const INCLUDES = [
  { model: Modalidade, as: 'modalidade', attributes: ['id', 'nome', 'horas_semanais', 'horas_mensais'] },
  { model: Usuario, as: 'orientador', attributes: ['id', 'nome'] }
];

// RF01 — valida os dados do cadastro de pesquisador/usuário
async function lerDados(body) {
  const perfil = body.perfil || 'PESQUISADOR';
  if (!PERFIS.includes(perfil)) throw invalido('Perfil inválido.');

  const numero_usp = v.texto(String(body.numero_usp ?? ''), 'o Número USP', { max: 20 });
  if (!/^\d{3,12}$/.test(numero_usp)) throw invalido('O Número USP deve conter apenas dígitos.');

  const dados = {
    nome: v.texto(body.nome, 'o nome completo', { max: 150 }),
    email: v.email(body.email),
    telefone: v.texto(body.telefone, 'o telefone', { obrigatorio: false, max: 20 }),
    numero_usp,
    perfil,
    data_ingresso: body.data_ingresso ? v.dia(body.data_ingresso, 'a data de ingresso') : null,
    modalidade_id: body.modalidade_id ? v.id(body.modalidade_id, 'a modalidade') : null,
    orientador_id: body.orientador_id ? v.id(body.orientador_id, 'o orientador') : null,
    ativo: body.ativo === undefined ? true : v.booleano(body.ativo)
  };

  if (dados.data_ingresso && dados.data_ingresso > chaveDia(new Date())) {
    throw invalido('A data de ingresso não pode ser futura.');
  }
  if (perfil === 'PESQUISADOR') {
    if (!dados.modalidade_id) throw invalido('Selecione a modalidade acadêmica do pesquisador.');
    if (!dados.data_ingresso) throw invalido('Informe a data de ingresso do pesquisador.');
  }
  if (dados.modalidade_id && !(await Modalidade.findByPk(dados.modalidade_id))) throw invalido('Modalidade não encontrada.');
  if (dados.orientador_id) {
    const orientador = await Usuario.findByPk(dados.orientador_id);
    if (!orientador || orientador.perfil === 'PESQUISADOR') {
      throw invalido('O orientador/supervisor deve ser um coordenador ou administrador.');
    }
  }
  return dados;
}

exports.listar = async (req, res) => {
  const where = {};
  if (req.query.perfil) where.perfil = req.query.perfil;
  if (req.query.ativo !== undefined && req.query.ativo !== '') where.ativo = req.query.ativo === 'true';
  if (req.query.modalidade_id) where.modalidade_id = req.query.modalidade_id;
  if (req.query.busca) {
    where[Op.or] = [
      { nome: { [Op.iLike]: `%${req.query.busca}%` } },
      { numero_usp: { [Op.iLike]: `%${req.query.busca}%` } }
    ];
  }
  const usuarios = await Usuario.findAll({ where, include: INCLUDES, order: [['nome', 'ASC']] });
  res.json({ usuarios });
};

// Telefone (dado sensível) só aparece no detalhe, para a gestão
exports.detalhar = async (req, res) => {
  const usuario = await Usuario.scope('completo').findByPk(req.params.id, { include: INCLUDES });
  if (!usuario) throw naoEncontrado('Usuário');
  const json = usuario.toJSON();
  delete json.telefone_cripto;
  res.json({ usuario: { ...json, telefone: usuario.telefone } });
};

exports.criar = async (req, res) => {
  const usuario = await Usuario.create(await lerDados(req.body));
  await auditar(req, { acao: 'USUARIO_CRIADO', entidade: 'usuario', entidadeId: usuario.id, depois: usuario });
  res.status(201).json({ usuario });
};

exports.atualizar = async (req, res) => {
  const usuario = await Usuario.scope('completo').findByPk(req.params.id);
  if (!usuario) throw naoEncontrado('Usuário');
  const dados = await lerDados(req.body);

  // Evita que o administrador perca o próprio acesso por engano
  if (usuario.id === req.usuario.id && (!dados.ativo || dados.perfil !== 'ADMIN')) {
    throw invalido('Você não pode desativar nem alterar o perfil da sua própria conta.');
  }
  if (dados.orientador_id === usuario.id) throw invalido('Um usuário não pode ser orientador de si mesmo.');

  const antes = usuario.toJSON();
  await usuario.update(dados);
  await auditar(req, { acao: 'USUARIO_ALTERADO', entidade: 'usuario', entidadeId: usuario.id, antes, depois: usuario });
  res.json({ usuario });
};
