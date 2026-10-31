// Formatação de horas e datas (sempre no fuso de São Paulo)
const FUSO = 'America/Sao_Paulo';

export function horas(minutos) {
  if (minutos === null || minutos === undefined) return '—';
  const sinal = minutos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

export const hora = (data) => data
  ? new Date(data).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO })
  : '—';

export const dataHora = (data) => data
  ? new Date(data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: FUSO })
  : '—';

// 'AAAA-MM-DD' -> 'DD/MM/AAAA'
export const dataBr = (dia) => dia ? String(dia).slice(0, 10).split('-').reverse().join('/') : '—';

export const diaSemanaCurto = (dia) => new Date(`${dia}T12:00:00Z`).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '');

export const nomeMes = (mes) => {
  const [a, m] = mes.split('-').map(Number);
  const texto = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

// Chaves de data no fuso do laboratório
export const hojeChave = () => new Date().toLocaleDateString('en-CA', { timeZone: FUSO });
export const mesAtual = () => hojeChave().slice(0, 7);

export function somarMes(mes, delta) {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

// Valor para <input type="datetime-local"> a partir de uma data, no fuso de São Paulo
export function paraInputDataHora(data) {
  if (!data) return '';
  return new Date(data).toLocaleString('sv-SE', { timeZone: FUSO }).slice(0, 16).replace(' ', 'T');
}

// Converte o valor de <input type="datetime-local"> (horário de São Paulo) para ISO
export const deInputDataHora = (valor) => valor ? `${valor}:00-03:00` : null;

export const percentual = (v) => v === null || v === undefined ? '—' : `${Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;

export const DIAS_SEMANA = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
export const TURNOS = { MANHA: 'Manhã', TARDE: 'Tarde', NOITE: 'Noite', INTEGRAL: 'Integral' };
export const PERFIS = { ADMIN: 'Administrador', COORDENADOR: 'Coordenador', PESQUISADOR: 'Pesquisador' };
export const TIPOS_SOLICITACAO = {
  JUSTIFICATIVA_AUSENCIA: 'Justificativa de ausência',
  CORRECAO_REGISTRO: 'Correção de registro',
  INCLUSAO_HORAS: 'Inclusão de horas esquecidas'
};
export const STATUS_SOLICITACAO = {
  PENDENTE: { rotulo: 'Pendente', cor: 'amarelo' },
  APROVADA: { rotulo: 'Aprovada', cor: 'verde' },
  REJEITADA: { rotulo: 'Rejeitada', cor: 'vermelho' },
  REVISAO: { rotulo: 'Revisão solicitada', cor: 'azul' }
};
export const ORIGENS = { WEB: 'Navegador', MOBILE: 'Celular', MANUAL: 'Manual', AJUSTE: 'Ajuste' };
