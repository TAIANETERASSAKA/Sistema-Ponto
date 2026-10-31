const env = require('./config/env');
const app = require('./app');
const { sequelize } = require('./models');
const { iniciarAgendador } = require('./jobs/agendador');

async function iniciar() {
  await sequelize.authenticate();
  const servidor = app.listen(env.porta, () => {
    console.log(`API do controle de frequência rodando na porta ${env.porta}`);
    iniciarAgendador();
  });

  // Encerramento limpo (o Docker envia SIGTERM ao parar o container)
  const encerrar = () => servidor.close(() => sequelize.close().then(() => process.exit(0)));
  process.on('SIGTERM', encerrar);
  process.on('SIGINT', encerrar);
}

iniciar().catch((erro) => {
  console.error('Falha ao iniciar a API:', erro);
  process.exit(1);
});
