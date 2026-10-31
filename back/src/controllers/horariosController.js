const { sequelize, Horario, Usuario, Modalidade } = require('../models');
const { auditar } = require('../services/auditoriaService');
const calc = require('../services/calculoHoras');
const { invalido, naoEncontrado } = require('../utils/erros');
const v = require('../utils/validacao');

const ORDEM = [['dia_semana', 'ASC'], ['hora_entrada', 'ASC']];

async function agendaDe(usuarioId) {
  const usuario = await Usuario.findByPk(usuarioId, { include: [{ model: Modalidade, as: 'modalidade' }] });
  if (!usuario) throw naoEncontrado('Pesquisador');
  const horarios = await Horario.findAll({ where: { usuario_id: usuarioId }, order: ORDEM });
  const { minutosSemanais } = calc.validarAgenda(horarios.map(h => ({
    ...h.toJSON(), hora_entrada: h.hora_entrada.slice(0, 5), hora_saida: h.hora_saida.slice(0, 5)
  })), null);
  return {
    horarios,
    minutosSemanais,
    minimoSemanal: usuario.modalidade ? Math.round(usuario.modalidade.horas_semanais * 60) : 0,
    modalidade: usuario.modalidade
  };
}

// GET /api/horarios/minha
exports.minhaAgenda = async (req, res) => res.json(await agendaDe(req.usuario.id));

// GET /api/horarios/usuario/:id (gestão)
exports.agendaDoUsuario = async (req, res) => res.json(await agendaDe(v.id(req.params.id)));

// PUT /api/horarios/minha — substitui a agenda semanal inteira (RF04)
exports.salvarMinhaAgenda = async (req, res) => {
  const usuario = await Usuario.findByPk(req.usuario.id, { include: [{ model: Modalidade, as: 'modalidade' }] });
  if (!usuario.modalidade) throw invalido('Seu cadastro não possui modalidade acadêmica. Procure a administração.');

  const itens = req.body.horarios;
  const { erros } = calc.validarAgenda(itens, usuario.modalidade);
  if (erros.length > 0) throw invalido(erros.join(' '));

  await sequelize.transaction(async (transaction) => {
    const antes = await Horario.findAll({ where: { usuario_id: usuario.id }, transaction });
    await Horario.destroy({ where: { usuario_id: usuario.id }, transaction });
    await Horario.bulkCreate(itens.map(i => ({
      usuario_id: usuario.id,
      dia_semana: Number(i.dia_semana),
      hora_entrada: i.hora_entrada,
      hora_saida: i.hora_saida,
      intervalo_minutos: Number(i.intervalo_minutos || 0),
      turno: i.turno
    })), { transaction });
    await auditar(req, {
      acao: 'AGENDA_ALTERADA', entidade: 'usuario', entidadeId: usuario.id,
      antes: { horarios: antes.map(h => h.toJSON()) }, depois: { horarios: itens }
    }, transaction);
  });
  res.json(await agendaDe(usuario.id));
};
