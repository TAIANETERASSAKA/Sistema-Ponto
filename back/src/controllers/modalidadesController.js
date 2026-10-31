const { Modalidade, Usuario } = require('../models');
const { auditar } = require('../services/auditoriaService');
const { naoEncontrado, conflito } = require('../utils/erros');
const v = require('../utils/validacao');

const lerDados = (body) => ({
  nome: v.texto(body.nome, 'o nome da modalidade', { max: 80 }),
  horas_semanais: v.numero(body.horas_semanais, 'as horas semanais', { min: 0.5, max: 168 }),
  horas_mensais: v.numero(body.horas_mensais, 'as horas mensais', { min: 1, max: 744 }),
  regras: v.texto(body.regras, 'as regras', { obrigatorio: false, max: 2000 }),
  ativo: body.ativo === undefined ? true : v.booleano(body.ativo)
});

exports.listar = async (req, res) => {
  const modalidades = await Modalidade.findAll({ order: [['horas_semanais', 'DESC'], ['nome', 'ASC']] });
  res.json({ modalidades });
};

exports.criar = async (req, res) => {
  const modalidade = await Modalidade.create(lerDados(req.body));
  await auditar(req, { acao: 'MODALIDADE_CRIADA', entidade: 'modalidade', entidadeId: modalidade.id, depois: modalidade });
  res.status(201).json({ modalidade });
};

exports.atualizar = async (req, res) => {
  const modalidade = await Modalidade.findByPk(req.params.id);
  if (!modalidade) throw naoEncontrado('Modalidade');
  const antes = modalidade.toJSON();
  await modalidade.update(lerDados(req.body));
  await auditar(req, { acao: 'MODALIDADE_ALTERADA', entidade: 'modalidade', entidadeId: modalidade.id, antes, depois: modalidade });
  res.json({ modalidade });
};

exports.excluir = async (req, res) => {
  const modalidade = await Modalidade.findByPk(req.params.id);
  if (!modalidade) throw naoEncontrado('Modalidade');
  const emUso = await Usuario.count({ where: { modalidade_id: modalidade.id } });
  if (emUso > 0) {
    throw conflito(`Esta modalidade está vinculada a ${emUso} pesquisador(es). Desative-a em vez de excluir.`);
  }
  await modalidade.destroy();
  await auditar(req, { acao: 'MODALIDADE_EXCLUIDA', entidade: 'modalidade', entidadeId: modalidade.id, antes: modalidade });
  res.json({ sucesso: true });
};
