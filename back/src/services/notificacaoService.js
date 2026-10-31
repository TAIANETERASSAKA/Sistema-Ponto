const nodemailer = require('nodemailer');
const env = require('../config/env');
const { Notificacao, Usuario } = require('../models');
const { obterConfiguracao } = require('./configuracaoService');

const transporte = env.smtp.host
  ? nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.porta,
      secure: env.smtp.porta === 465,
      auth: env.smtp.usuario ? { user: env.smtp.usuario, pass: env.smtp.senha } : undefined
    })
  : null;

const escaparHtml = (t = '') => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Envia e-mail sem nunca lançar erro (falha no e-mail não pode interromper a operação)
async function enviarEmail(para, titulo, mensagem) {
  if (!transporte || !para) return false;
  try {
    await transporte.sendMail({
      from: `"Controle de Frequência" <${env.smtp.remetente}>`,
      to: para,
      subject: titulo,
      text: `${mensagem}\n\nAcesse: ${env.frontendUrl}`,
      html: `<p>${escaparHtml(mensagem)}</p><p><a href="${env.frontendUrl}">Acessar o sistema</a></p>`
    });
    return true;
  } catch (erro) {
    console.error(`Erro ao enviar e-mail para ${para}:`, erro.message);
    return false;
  }
}

/**
 * RF10 — cria uma notificação no sistema interno e, se configurado, envia por e-mail.
 * A "chave" evita duplicar o mesmo aviso (ex: lembrete do mesmo dia). Retorna false se já existia.
 */
async function notificar(usuarioId, { tipo, titulo, mensagem, link = null, chave = null }, { email = true } = {}) {
  const [notificacao, criada] = chave
    ? await Notificacao.findOrCreate({
        where: { usuario_id: usuarioId, chave },
        defaults: { tipo, titulo, mensagem, link }
      })
    : [await Notificacao.create({ usuario_id: usuarioId, tipo, titulo, mensagem, link }), true];

  if (!criada) return false;

  if (email) {
    const config = await obterConfiguracao();
    if (config?.emails_ativos) {
      const usuario = await Usuario.findByPk(usuarioId);
      enviarEmail(usuario?.email, titulo, mensagem);
    }
  }
  return notificacao;
}

module.exports = { notificar, enviarEmail };
