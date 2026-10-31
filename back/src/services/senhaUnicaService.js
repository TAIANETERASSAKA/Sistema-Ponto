const crypto = require('crypto');

// Cliente da Senha Única USP (OAuth 1.0a, assinatura HMAC-SHA1)
// Fluxo: request_token -> authorize (site da USP) -> access_token -> usuariousp

const env = require('../config/env');

const BASE_URL = env.senhaUnica.dev
    ? 'https://dev.uspdigital.usp.br/wsusuario/oauth'
    : 'https://uspdigital.usp.br/wsusuario/oauth';

const CONSUMER_KEY = env.senhaUnica.key;
const CONSUMER_SECRET = env.senhaUnica.secret;
const CALLBACK_ID = env.senhaUnica.callbackId;

// Codificação exigida pelo OAuth 1.0a (RFC 3986)
const encode = (valor) => encodeURIComponent(valor)
    .replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

// Monta o cabeçalho Authorization assinado
const montarAutorizacao = (url, tokenSecret = '', extras = {}) => {
    const params = {
        oauth_consumer_key: CONSUMER_KEY,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_version: '1.0',
        ...extras
    };

    const paramsOrdenados = Object.keys(params).sort()
        .map(chave => `${encode(chave)}=${encode(params[chave])}`)
        .join('&');

    const baseAssinatura = ['POST', encode(url), encode(paramsOrdenados)].join('&');
    const chaveAssinatura = `${encode(CONSUMER_SECRET)}&${encode(tokenSecret)}`;

    params.oauth_signature = crypto.createHmac('sha1', chaveAssinatura)
        .update(baseAssinatura)
        .digest('base64');

    return 'OAuth ' + Object.keys(params)
        .map(chave => `${encode(chave)}="${encode(params[chave])}"`)
        .join(', ');
};

// Faz um POST assinado e devolve o corpo da resposta como texto
const postAssinado = async (url, tokenSecret, extras) => {
    const resposta = await fetch(url, {
        method: 'POST',
        headers: { Authorization: montarAutorizacao(url, tokenSecret, extras) }
    });
    const corpo = await resposta.text();

    if (!resposta.ok) {
        throw new Error(`Senha Única respondeu ${resposta.status} em ${url}: ${corpo}`);
    }
    return corpo;
};

// Verifica se as variáveis de ambiente foram preenchidas
exports.estaConfigurado = () => Boolean(CONSUMER_KEY && CONSUMER_SECRET && CALLBACK_ID);

// Passo 1: pede um token temporário e devolve a URL de login da USP
exports.iniciarLogin = async (callbackUrl) => {
    const corpo = await postAssinado(`${BASE_URL}/request_token`, '', { oauth_callback: callbackUrl });
    const dados = new URLSearchParams(corpo);

    const token = dados.get('oauth_token');
    const tokenSecret = dados.get('oauth_token_secret');

    return {
        token,
        tokenSecret,
        urlLogin: `${BASE_URL}/authorize?oauth_token=${encode(token)}&callback_id=${encode(CALLBACK_ID)}`
    };
};

// Passos 2 e 3: troca o token temporário pelo definitivo e busca os dados do usuário
exports.finalizarLogin = async (token, tokenSecret, verifier) => {
    const corpoAcesso = await postAssinado(`${BASE_URL}/access_token`, tokenSecret, {
        oauth_token: token,
        oauth_verifier: verifier
    });
    const acesso = new URLSearchParams(corpoAcesso);

    const corpoUsuario = await postAssinado(`${BASE_URL}/usuariousp`, acesso.get('oauth_token_secret'), {
        oauth_token: acesso.get('oauth_token')
    });

    return JSON.parse(corpoUsuario);
};
