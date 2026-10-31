require('dotenv').config({ quiet: true });

// Centraliza as variáveis de ambiente usadas pela aplicação
const lista = (valor, padrao = '') => (valor || padrao).split(',').map(v => v.trim()).filter(Boolean);

const env = {
  emProducao: process.env.NODE_ENV === 'production',
  porta: Number(process.env.PORT || 7080),
  fusoHorario: process.env.TZ_APP || 'America/Sao_Paulo',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:8090',
  backendUrl: process.env.BACKEND_URL || 'http://localhost:7080',
  sessionSecret: process.env.SESSION_SECRET,
  cookieSeguro: process.env.COOKIE_SECURE === 'true',
  chaveCriptografia: process.env.DATA_ENCRYPTION_KEY,
  jobsAtivos: process.env.JOBS_ATIVOS !== 'false',

  senhaUnica: {
    key: process.env.SENHAUNICA_KEY,
    secret: process.env.SENHAUNICA_SECRET,
    callbackId: process.env.SENHAUNICA_CALLBACK_ID,
    dev: process.env.SENHAUNICA_DEV === 'true',
    admins: lista(process.env.SENHAUNICA_ADMINS),
    fake: process.env.SENHAUNICA_FAKE === 'true' && process.env.NODE_ENV !== 'production'
  },

  smtp: {
    host: process.env.SMTP_HOST,
    porta: Number(process.env.SMTP_PORT || 587),
    usuario: process.env.SMTP_USER,
    senha: process.env.SMTP_PASS,
    remetente: process.env.SMTP_FROM || process.env.SMTP_USER
  }
};

if (env.emProducao) {
  for (const [nome, valor] of [['SESSION_SECRET', env.sessionSecret], ['DATA_ENCRYPTION_KEY', env.chaveCriptografia]]) {
    if (!valor) throw new Error(`Defina ${nome} no .env antes de rodar em produção.`);
  }
}

module.exports = env;
