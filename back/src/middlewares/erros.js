const { ErroApp } = require('../utils/erros');

// Converte qualquer erro em uma resposta JSON padronizada
// eslint-disable-next-line no-unused-vars
function tratarErros(err, req, res, next) {
  if (err instanceof ErroApp) {
    return res.status(err.status).json({ error: err.codigo, message: err.message });
  }
  if (err.name === 'SequelizeUniqueConstraintError') {
    const campo = Object.keys(err.fields || {})[0];
    const mensagens = {
      numero_usp: 'Este Número USP já está cadastrado.',
      nome: 'Já existe um cadastro com este nome.',
      usuario_id: 'Você já tem um registro de ponto em aberto.'
    };
    return res.status(409).json({ error: 'conflito', message: mensagens[campo] || 'Registro duplicado.' });
  }
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({ error: 'dados_invalidos', message: err.errors.map(e => e.message).join(' ') });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'muito_grande', message: 'Os dados enviados são grandes demais.' });
  }

  console.error(err);
  res.status(500).json({ error: 'erro_interno', message: 'Erro interno no servidor. Tente novamente.' });
}

module.exports = { tratarErros };
