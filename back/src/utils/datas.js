// Funções de data sempre no fuso do laboratório (o servidor pode estar em UTC)
const FUSO_PADRAO = 'America/Sao_Paulo';

const formatadores = new Map();
function formatador(fuso) {
  if (!formatadores.has(fuso)) {
    formatadores.set(fuso, new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
    }));
  }
  return formatadores.get(fuso);
}

// Componentes da data no fuso informado
function partes(data, fuso = FUSO_PADRAO) {
  const p = Object.fromEntries(formatador(fuso).formatToParts(new Date(data)).map(x => [x.type, x.value]));
  const ano = Number(p.year), mes = Number(p.month), dia = Number(p.day);
  return {
    ano, mes, dia,
    hora: Number(p.hour), minuto: Number(p.minute), segundo: Number(p.second),
    diaSemana: new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay()
  };
}

const doisDigitos = (n) => String(n).padStart(2, '0');

// 'AAAA-MM-DD' do dia no fuso do laboratório
function chaveDia(data, fuso = FUSO_PADRAO) {
  const p = partes(data, fuso);
  return `${p.ano}-${doisDigitos(p.mes)}-${doisDigitos(p.dia)}`;
}

// 'AAAA-MM' do mês no fuso do laboratório
function chaveMes(data, fuso = FUSO_PADRAO) {
  return chaveDia(data, fuso).slice(0, 7);
}

// Diferença (ms) entre o horário local do fuso e o UTC naquele instante
function deslocamento(data, fuso) {
  const p = partes(data, fuso);
  const comoUtc = Date.UTC(p.ano, p.mes - 1, p.dia, p.hora, p.minuto, p.segundo);
  return comoUtc - Math.floor(new Date(data).getTime() / 1000) * 1000;
}

// Converte um horário local (no fuso) para o instante UTC correspondente
function localParaUtc(ano, mes, dia, hora = 0, minuto = 0, fuso = FUSO_PADRAO) {
  const palpite = Date.UTC(ano, mes - 1, dia, hora, minuto);
  let instante = palpite - deslocamento(palpite, fuso);
  // Segunda passada corrige casos de mudança de horário de verão
  instante = palpite - deslocamento(instante, fuso);
  return new Date(instante);
}

function diasNoMes(ano, mes) {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

function validarChaveMes(mes) {
  return typeof mes === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);
}

function validarChaveDia(dia) {
  if (typeof dia !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return false;
  const [a, m, d] = dia.split('-').map(Number);
  return m >= 1 && m <= 12 && d >= 1 && d <= diasNoMes(a, m);
}

// Início (inclusivo) e fim (exclusivo) do mês em UTC
function limitesMes(mes, fuso = FUSO_PADRAO) {
  const [ano, m] = mes.split('-').map(Number);
  const proximo = m === 12 ? [ano + 1, 1] : [ano, m + 1];
  return { inicio: localParaUtc(ano, m, 1, 0, 0, fuso), fim: localParaUtc(proximo[0], proximo[1], 1, 0, 0, fuso) };
}

// Início (inclusivo) e fim (exclusivo) do dia em UTC
function limitesDia(dia, fuso = FUSO_PADRAO) {
  const [a, m, d] = dia.split('-').map(Number);
  const amanha = somarDias(dia, 1).split('-').map(Number);
  return { inicio: localParaUtc(a, m, d, 0, 0, fuso), fim: localParaUtc(amanha[0], amanha[1], amanha[2], 0, 0, fuso) };
}

// Soma dias a uma chave 'AAAA-MM-DD'
function somarDias(dia, quantidade) {
  const [a, m, d] = dia.split('-').map(Number);
  const data = new Date(Date.UTC(a, m - 1, d + quantidade));
  return data.toISOString().slice(0, 10);
}

// Dia da semana (0 = domingo) de uma chave 'AAAA-MM-DD'
function diaDaSemana(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

// Segunda-feira da semana que contém o dia
function inicioSemana(dia) {
  const ds = diaDaSemana(dia);
  return somarDias(dia, ds === 0 ? -6 : 1 - ds);
}

// Mês anterior a 'AAAA-MM'
function mesAnterior(mes) {
  const [a, m] = mes.split('-').map(Number);
  return m === 1 ? `${a - 1}-12` : `${a}-${doisDigitos(m - 1)}`;
}

// 'HH:MM' ou 'HH:MM:SS' -> minutos desde a meia-noite
function horaParaMinutos(hora) {
  if (typeof hora !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(hora)) return null;
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}

module.exports = {
  FUSO_PADRAO, partes, chaveDia, chaveMes, localParaUtc, diasNoMes, limitesMes, limitesDia,
  somarDias, diaDaSemana, inicioSemana, mesAnterior, horaParaMinutos, validarChaveMes, validarChaveDia
};
