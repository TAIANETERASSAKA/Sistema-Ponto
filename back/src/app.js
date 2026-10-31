const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');
const PgSession = require('connect-pg-simple')(session);
const env = require('./config/env');
const db = require('./config/database')[process.env.NODE_ENV || 'development'];
const { sequelize } = require('./models');
const rotas = require('./routes');
const { tratarErros } = require('./middlewares/erros');

const app = express();

if (env.cookieSeguro) app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      // O formulário de login simulado redireciona para o front, que está em outra origem
      formAction: ["'self'", env.frontendUrl]
    }
  }
}));
app.use(cors({ origin: env.frontendUrl, credentials: true, exposedHeaders: ['Content-Disposition'] }));
app.use(express.json({ limit: '1mb' }));

// Sessões salvas no Postgres: sobrevivem a reinícios e permitem várias instâncias
app.use(session({
  name: 'ponto.sid',
  store: new PgSession({
    conObject: { host: db.host, port: db.port, user: db.username, password: db.password, database: db.database },
    tableName: 'sessoes',
    createTableIfMissing: true
  }),
  secret: env.sessionSecret || 'segredo-de-desenvolvimento',
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: env.cookieSeguro,
    sameSite: 'lax', // necessário para o retorno da Senha Única USP
    maxAge: 8 * 60 * 60 * 1000 // 8 horas sem uso
  }
}));

// Verificação de saúde usada pelo Docker (RNF02)
app.get('/api/saude', async (req, res) => {
  try {
    await sequelize.authenticate();
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'indisponivel' });
  }
});

app.use('/api', rotas);
app.use('/api', (req, res) => res.status(404).json({ error: 'nao_encontrado', message: 'Rota não encontrada.' }));
app.use(tratarErros);

module.exports = app;
