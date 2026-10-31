const { Configuracao } = require('../models');

async function obterConfiguracao() {
  return Configuracao.findByPk(1);
}

module.exports = { obterConfiguracao };
