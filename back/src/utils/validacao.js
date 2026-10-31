const { invalido } = require('./erros');
const { validarChaveDia, validarChaveMes } = require('./datas');

// Pequenos validadores reutilizados pelos controllers
const texto = (valor, nome, { obrigatorio = true, max = 255 } = {}) => {
  const v = typeof valor === 'string' ? valor.trim() : '';
  if (!v) {
    if (obrigatorio) throw invalido(`Informe ${nome}.`);
    return null;
  }
  if (v.length > max) throw invalido(`${nome[0].toUpperCase() + nome.slice(1)} deve ter no máximo ${max} caracteres.`);
  return v;
};

const numero = (valor, nome, { min = -Infinity, max = Infinity, inteiro = false } = {}) => {
  const n = Number(valor);
  if (valor === '' || valor === null || valor === undefined || Number.isNaN(n)) throw invalido(`Informe ${nome}.`);
  if (inteiro && !Number.isInteger(n)) throw invalido(`${nome} deve ser um número inteiro.`);
  if (n < min || n > max) throw invalido(`${nome} deve estar entre ${min} e ${max}.`);
  return n;
};

const booleano = (valor) => valor === true || valor === 'true';

const email = (valor) => {
  const v = texto(valor, 'o e-mail', { max: 150 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw invalido('Informe um e-mail válido.');
  return v.toLowerCase();
};

const dia = (valor, nome = 'a data') => {
  if (!validarChaveDia(valor)) throw invalido(`Informe ${nome} no formato AAAA-MM-DD.`);
  return valor;
};

const mes = (valor) => {
  if (!validarChaveMes(valor)) throw invalido('Informe o mês no formato AAAA-MM.');
  return valor;
};

const id = (valor, nome = 'o identificador') => numero(valor, nome, { min: 1, inteiro: true });

module.exports = { texto, numero, booleano, email, dia, mes, id };
