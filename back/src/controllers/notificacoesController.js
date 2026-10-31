const { Notificacao } = require('../models');

// GET /api/notificacoes
exports.listar = async (req, res) => {
  const [notificacoes, naoLidas] = await Promise.all([
    Notificacao.findAll({ where: { usuario_id: req.usuario.id }, order: [['created_at', 'DESC']], limit: 100 }),
    Notificacao.count({ where: { usuario_id: req.usuario.id, lida: false } })
  ]);
  res.json({ notificacoes, naoLidas });
};

// POST /api/notificacoes/:id/lida
exports.marcarLida = async (req, res) => {
  await Notificacao.update({ lida: true }, { where: { id: req.params.id, usuario_id: req.usuario.id } });
  res.json({ sucesso: true });
};

// POST /api/notificacoes/lidas
exports.marcarTodas = async (req, res) => {
  await Notificacao.update({ lida: true }, { where: { usuario_id: req.usuario.id, lida: false } });
  res.json({ sucesso: true });
};
