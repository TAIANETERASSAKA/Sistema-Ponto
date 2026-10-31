const { Usuario } = require('../models');
const { proibido, ErroApp } = require('../utils/erros');

const sessaoExpirada = () => new ErroApp(401, 'Sua sessão expirou. Faça login novamente.', 'nao_autenticado');

// Exige usuário logado e ainda ativo. O perfil é relido do banco a cada requisição,
// para que uma desativação ou mudança de perfil valha imediatamente.
async function exigirLogin(req, res, next) {
  const id = req.session?.usuario?.id;
  if (!id) return next(sessaoExpirada());

  const usuario = await Usuario.findByPk(id, { attributes: ['id', 'nome', 'perfil', 'ativo', 'numero_usp', 'modalidade_id'] });
  if (!usuario || !usuario.ativo) {
    req.session.destroy(() => {});
    return next(sessaoExpirada());
  }
  req.usuario = usuario;
  next();
}

// Exige um dos perfis informados (RNF01 — controle de permissões por perfil)
const exigirPerfil = (...perfis) => (req, res, next) => {
  exigirLogin(req, res, (erro) => {
    if (erro) return next(erro);
    if (!perfis.includes(req.usuario.perfil)) return next(proibido());
    next();
  });
};

const GESTAO = ['ADMIN', 'COORDENADOR'];

module.exports = { exigirLogin, exigirPerfil, GESTAO };
