const env = require('../config/env');
const { Usuario, Modalidade } = require('../models');
const senhaUnica = require('../services/senhaUnicaService');
const { auditar } = require('../services/auditoriaService');

const CALLBACK_URL = `${env.backendUrl}/api/auth/senhaunica/callback`;

const redirecionarErro = (res, codigo) => res.redirect(`${env.frontendUrl}/login?erro=${codigo}`);

// Dados do usuário guardados na sessão e devolvidos ao front
const dadosSessao = (u) => ({ id: u.id, nome: u.nome, email: u.email, perfil: u.perfil, numero_usp: u.numero_usp });

// Só entra quem foi cadastrado pelo administrador (RF01) e está ativo,
// além dos administradores iniciais definidos em SENHAUNICA_ADMINS.
async function concluirLogin(req, res, dadosUsp) {
  const numero_usp = String(dadosUsp.loginUsuario);
  const ehAdminInicial = env.senhaUnica.admins.includes(numero_usp);
  let usuario = await Usuario.findOne({ where: { numero_usp } });

  if (!usuario && ehAdminInicial) {
    usuario = await Usuario.create({
      numero_usp, nome: dadosUsp.nomeUsuario, email: dadosUsp.emailPrincipalUsuario || `${numero_usp}@usp.br`, perfil: 'ADMIN'
    });
    await auditar(req, { acao: 'USUARIO_CRIADO', entidade: 'usuario', entidadeId: usuario.id, depois: usuario, usuarioId: usuario.id });
  }

  if (!usuario || !usuario.ativo) {
    await auditar(req, {
      acao: 'LOGIN_NEGADO', entidade: 'usuario', entidadeId: usuario?.id || null,
      depois: { numero_usp, motivo: usuario ? 'inativo' : 'nao_cadastrado' }, usuarioId: usuario?.id || null
    });
    return redirecionarErro(res, usuario ? 'inativo' : 'nao_cadastrado');
  }

  // Nome e e-mail oficiais vêm da USP
  await usuario.update({
    nome: dadosUsp.nomeUsuario || usuario.nome,
    email: dadosUsp.emailPrincipalUsuario || dadosUsp.emailUspUsuario || usuario.email,
    perfil: ehAdminInicial ? 'ADMIN' : usuario.perfil,
    ultimo_login_em: new Date()
  });
  await auditar(req, { acao: 'LOGIN', entidade: 'usuario', entidadeId: usuario.id, usuarioId: usuario.id });

  // Nova sessão a cada login, para evitar reaproveitamento de cookie
  req.session.regenerate((erro) => {
    if (erro) return redirecionarErro(res, 'falha_sessao');
    req.session.usuario = dadosSessao(usuario);
    req.session.save(() => res.redirect(`${env.frontendUrl}/auth/retorno`));
  });
}

// GET /api/auth/senhaunica — envia para a página de login da USP
exports.iniciarLogin = async (req, res) => {
  if (env.senhaUnica.fake) return res.redirect('/api/auth/fake');
  if (!senhaUnica.estaConfigurado()) return redirecionarErro(res, 'nao_configurado');

  try {
    const { token, tokenSecret, urlLogin } = await senhaUnica.iniciarLogin(CALLBACK_URL);
    req.session.senhaUnica = { token, tokenSecret };
    req.session.save(() => res.redirect(urlLogin));
  } catch (erro) {
    console.error('Erro ao iniciar login na Senha Única:', erro.message);
    redirecionarErro(res, 'falha_usp');
  }
};

// GET /api/auth/senhaunica/callback — retorno da USP
exports.callback = async (req, res) => {
  const { oauth_token, oauth_verifier } = req.query;
  const temporario = req.session.senhaUnica;

  if (!temporario || !oauth_verifier || temporario.token !== oauth_token) {
    return redirecionarErro(res, 'login_invalido');
  }

  try {
    const dadosUsp = await senhaUnica.finalizarLogin(temporario.token, temporario.tokenSecret, oauth_verifier);
    delete req.session.senhaUnica;
    await concluirLogin(req, res, dadosUsp);
  } catch (erro) {
    console.error('Erro no retorno da Senha Única:', erro.message);
    redirecionarErro(res, 'falha_usp');
  }
};

// GET /api/auth/fake — login simulado (somente desenvolvimento)
exports.formularioFake = (req, res) => {
  if (!env.senhaUnica.fake) return res.status(404).end();
  res.send(`<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Senha Única (simulada)</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 420px; margin: 60px auto; padding: 0 16px;">
  <h2>Senha Única USP — modo simulado</h2>
  <p style="color: #b45309;">Apenas para desenvolvimento. Nenhuma senha é verificada.</p>
  <form method="post" action="/api/auth/fake" style="display: grid; gap: 12px;">
    <label>Número USP <input name="numero_usp" required style="width: 100%"></label>
    <label>Nome <input name="nome" required style="width: 100%"></label>
    <label>E-mail <input name="email" type="email" required style="width: 100%"></label>
    <button type="submit">Entrar</button>
  </form>
</body></html>`);
};

// POST /api/auth/fake
exports.loginFake = async (req, res) => {
  if (!env.senhaUnica.fake) return res.status(404).end();
  await concluirLogin(req, res, {
    loginUsuario: req.body.numero_usp, nomeUsuario: req.body.nome, emailPrincipalUsuario: req.body.email
  });
};

// GET /api/auth/me — usuário logado, com modalidade
exports.usuarioLogado = async (req, res) => {
  const usuario = await Usuario.findByPk(req.usuario.id, {
    include: [{ model: Modalidade, as: 'modalidade' }, { model: Usuario, as: 'orientador', attributes: ['id', 'nome'] }]
  });
  res.json({ usuario });
};

// POST /api/auth/logout
exports.logout = async (req, res) => {
  const id = req.session?.usuario?.id;
  if (id) await auditar(req, { acao: 'LOGOUT', entidade: 'usuario', entidadeId: id });
  req.session.destroy(() => {
    res.clearCookie('ponto.sid');
    res.json({ sucesso: true });
  });
};
