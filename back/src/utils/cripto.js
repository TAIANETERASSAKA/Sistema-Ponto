const crypto = require('crypto');
const env = require('../config/env');

// RNF01 — criptografia de dados pessoais sensíveis (AES-256-GCM)
if (!env.chaveCriptografia) {
  console.warn('[aviso] DATA_ENCRYPTION_KEY não definida: usando chave de desenvolvimento.');
}
const CHAVE = crypto.createHash('sha256').update(env.chaveCriptografia || 'chave-desenvolvimento').digest();

function criptografar(texto) {
  if (texto === null || texto === undefined || texto === '') return null;
  const iv = crypto.randomBytes(12);
  const cifra = crypto.createCipheriv('aes-256-gcm', CHAVE, iv);
  const dados = Buffer.concat([cifra.update(String(texto), 'utf8'), cifra.final()]);
  return [iv, cifra.getAuthTag(), dados].map(b => b.toString('base64')).join('.');
}

function descriptografar(valor) {
  if (!valor) return null;
  try {
    const [iv, tag, dados] = valor.split('.').map(p => Buffer.from(p, 'base64'));
    const decifra = crypto.createDecipheriv('aes-256-gcm', CHAVE, iv);
    decifra.setAuthTag(tag);
    return Buffer.concat([decifra.update(dados), decifra.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { criptografar, descriptografar };
