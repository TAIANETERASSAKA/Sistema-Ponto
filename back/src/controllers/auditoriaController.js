const { Op } = require('sequelize');
const { Auditoria, Usuario } = require('../models');
const { limitesDia } = require('../utils/datas');
const { FUSO } = require('../services/frequenciaService');
const v = require('../utils/validacao');

// GET /api/auditoria?acao=&usuario_id=&de=&ate=&pagina= (RF12)
exports.listar = async (req, res) => {
  const pagina = req.query.pagina ? v.numero(req.query.pagina, 'a página', { min: 1, inteiro: true }) : 1;
  const porPagina = 50;
  const where = {};
  if (req.query.acao) where.acao = req.query.acao;
  if (req.query.usuario_id) where.usuario_id = req.query.usuario_id;
  if (req.query.de || req.query.ate) {
    where.created_at = {};
    if (req.query.de) where.created_at[Op.gte] = limitesDia(v.dia(req.query.de), FUSO).inicio;
    if (req.query.ate) where.created_at[Op.lt] = limitesDia(v.dia(req.query.ate), FUSO).fim;
  }

  const { rows, count } = await Auditoria.findAndCountAll({
    where,
    include: [{ model: Usuario, as: 'usuario', attributes: ['id', 'nome', 'numero_usp'] }],
    order: [['created_at', 'DESC']],
    limit: porPagina,
    offset: (pagina - 1) * porPagina
  });
  const acoes = await Auditoria.findAll({ attributes: ['acao'], group: ['acao'], order: [['acao', 'ASC']], raw: true });
  res.json({ registros: rows, total: count, pagina, paginas: Math.max(1, Math.ceil(count / porPagina)), acoes: acoes.map(a => a.acao) });
};
