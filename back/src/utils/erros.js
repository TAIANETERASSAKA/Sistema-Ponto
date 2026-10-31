// Erro com código HTTP e mensagem amigável para o usuário
class ErroApp extends Error {
  constructor(status, mensagem, codigo = 'erro') {
    super(mensagem);
    this.status = status;
    this.codigo = codigo;
  }
}

const naoEncontrado = (o = 'Registro') => new ErroApp(404, `${o} não encontrado.`, 'nao_encontrado');
const invalido = (mensagem) => new ErroApp(400, mensagem, 'dados_invalidos');
const conflito = (mensagem) => new ErroApp(409, mensagem, 'conflito');
const proibido = (mensagem = 'Você não tem permissão para esta ação.') => new ErroApp(403, mensagem, 'acesso_negado');

module.exports = { ErroApp, naoEncontrado, invalido, conflito, proibido };
