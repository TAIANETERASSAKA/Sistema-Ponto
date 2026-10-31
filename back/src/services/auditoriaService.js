const { Auditoria } = require('../models');

// Remove campos que não devem ir para o histórico
const limpar = (dados) => {
  if (!dados) return null;
  const obj = typeof dados.toJSON === 'function' ? dados.toJSON() : { ...dados };
  delete obj.telefone_cripto;
  delete obj.telefone;
  return obj;
};

// RF12 — registra uma operação no histórico de auditoria
async function auditar(req, { acao, entidade = null, entidadeId = null, antes = null, depois = null, usuarioId }, transaction) {
  await Auditoria.create({
    usuario_id: usuarioId !== undefined ? usuarioId : req?.session?.usuario?.id || null,
    acao,
    entidade,
    entidade_id: entidadeId,
    dados_antes: limpar(antes),
    dados_depois: limpar(depois),
    ip: req?.ip || null,
    user_agent: req?.get?.('user-agent')?.slice(0, 300) || null
  }, { transaction });
}

module.exports = { auditar };
