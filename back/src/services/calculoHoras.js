// Regras de cálculo de horas (RF04, RF06, RN02, RN04, RN05).
// Funções puras: não acessam o banco, o que permite testá-las isoladamente.
const {
  FUSO_PADRAO, chaveDia, partes, diasNoMes, somarDias, inicioSemana, horaParaMinutos
} = require('../utils/datas');

const MINUTO = 60 * 1000;
const DURACAO_MAXIMA_REGISTRO = 24 * 60; // minutos
const TURNOS = ['MANHA', 'TARDE', 'NOITE', 'INTEGRAL'];

const minutosEntre = (inicio, fim) => Math.max(0, Math.floor((new Date(fim) - new Date(inicio)) / MINUTO));

// Duração de um registro; o registro em aberto conta até "agora" (acompanhamento em tempo real)
function minutosDoRegistro(registro, agora = new Date()) {
  return minutosEntre(registro.entrada, registro.saida || agora);
}

// Minutos trabalhados por dia. O registro pertence ao dia da entrada.
function minutosPorDia(registros, agora = new Date(), fuso = FUSO_PADRAO) {
  const dias = {};
  for (const registro of registros) {
    const dia = chaveDia(registro.entrada, fuso);
    dias[dia] = (dias[dia] || 0) + minutosDoRegistro(registro, agora);
  }
  return dias;
}

// Carga exigida no mês, proporcional quando o pesquisador ingressou no meio do mês
function minutosExigidosNoMes(modalidade, mes, dataIngresso) {
  if (!modalidade) return 0;
  const [ano, m] = mes.split('-').map(Number);
  const totalDias = diasNoMes(ano, m);
  const total = Math.round(Number(modalidade.horas_mensais) * 60);

  if (!dataIngresso) return total;
  const ingresso = String(dataIngresso).slice(0, 10);
  const inicioMes = `${mes}-01`;
  const fimMes = `${mes}-${String(totalDias).padStart(2, '0')}`;

  if (ingresso > fimMes) return 0;
  if (ingresso <= inicioMes) return total;
  const diasAtivos = totalDias - Number(ingresso.slice(8, 10)) + 1;
  return Math.round(total * diasAtivos / totalDias);
}

// Percentual de cumprimento (100% quando não há carga exigida)
function percentual(considerados, exigidos) {
  if (exigidos <= 0) return 100;
  return Math.round((considerados / exigidos) * 10000) / 100;
}

// Atrasos (RN04): primeira entrada do dia depois do horário planejado + tolerância
function calcularAtrasos(registros, horarios, toleranciaMinutos, fuso = FUSO_PADRAO) {
  const primeiraEntradaPorDia = {};
  for (const r of registros) {
    const dia = chaveDia(r.entrada, fuso);
    if (!primeiraEntradaPorDia[dia] || new Date(r.entrada) < new Date(primeiraEntradaPorDia[dia])) {
      primeiraEntradaPorDia[dia] = r.entrada;
    }
  }

  const planejadoPorDiaSemana = {};
  for (const h of horarios) {
    const inicio = horaParaMinutos(String(h.hora_entrada).slice(0, 5));
    const atual = planejadoPorDiaSemana[h.dia_semana];
    if (atual === undefined || inicio < atual) planejadoPorDiaSemana[h.dia_semana] = inicio;
  }

  const atrasos = [];
  for (const [dia, entrada] of Object.entries(primeiraEntradaPorDia)) {
    const p = partes(entrada, fuso);
    const planejado = planejadoPorDiaSemana[p.diaSemana];
    if (planejado === undefined) continue;
    const real = p.hora * 60 + p.minuto;
    if (real > planejado + toleranciaMinutos) {
      atrasos.push({ data: dia, minutosAtraso: real - planejado });
    }
  }
  return atrasos.sort((a, b) => a.data.localeCompare(b.data));
}

// Resumo de frequência do mês (RF06 / RF07)
function resumoMensal({
  registros, abonos = [], modalidade, mes, dataIngresso, agora = new Date(), fuso = FUSO_PADRAO,
  bancoHorasAtivo = false, saldoBancoAnterior = 0
}) {
  const doMes = registros.filter(r => chaveDia(r.entrada, fuso).startsWith(mes));
  const porDia = minutosPorDia(doMes, agora, fuso);

  const abonadosPorDia = {};
  for (const a of abonos) {
    if (String(a.data).startsWith(mes)) abonadosPorDia[a.data] = (abonadosPorDia[a.data] || 0) + (a.minutos || 0);
  }

  const minutosRealizados = Object.values(porDia).reduce((s, v) => s + v, 0);
  const minutosAbonados = Object.values(abonadosPorDia).reduce((s, v) => s + v, 0);
  const minutosConsiderados = minutosRealizados + minutosAbonados;
  const minutosExigidos = minutosExigidosNoMes(modalidade, mes, dataIngresso);
  const saldoMinutos = minutosConsiderados - minutosExigidos;

  // Semanas (segunda a domingo) que tocam o mês
  const exigidoSemanal = modalidade ? Math.round(Number(modalidade.horas_semanais) * 60) : 0;
  const semanas = {};
  for (const dia of new Set([...Object.keys(porDia), ...Object.keys(abonadosPorDia)])) {
    const inicio = inicioSemana(dia);
    semanas[inicio] = semanas[inicio] || { inicio, fim: somarDias(inicio, 6), minutos: 0, abonados: 0 };
    semanas[inicio].minutos += porDia[dia] || 0;
    semanas[inicio].abonados += abonadosPorDia[dia] || 0;
  }

  return {
    mes,
    minutosExigidos,
    minutosRealizados,
    minutosAbonados,
    minutosConsiderados,
    minutosFaltantes: Math.max(0, -saldoMinutos),
    minutosExcedentes: Math.max(0, saldoMinutos),
    saldoMinutos,
    // RN05: com banco de horas, o saldo do mês se acumula ao saldo anterior
    saldoBancoMinutos: bancoHorasAtivo ? saldoBancoAnterior + saldoMinutos : 0,
    percentual: percentual(minutosConsiderados, minutosExigidos),
    cumpriu: minutosConsiderados >= minutosExigidos,
    diasTrabalhados: Object.values(porDia).filter(m => m > 0).length,
    porDia: Object.keys({ ...porDia, ...abonadosPorDia }).sort().map(data => ({
      data, minutos: porDia[data] || 0, abonados: abonadosPorDia[data] || 0
    })),
    semanas: Object.values(semanas).sort((a, b) => a.inicio.localeCompare(b.inicio)).map(s => {
      const total = s.minutos + s.abonados;
      return {
        ...s,
        exigidos: exigidoSemanal,
        faltantes: Math.max(0, exigidoSemanal - total),
        excedentes: Math.max(0, total - exigidoSemanal)
      };
    })
  };
}

// Valida a agenda semanal planejada (RF04 e RN02)
function validarAgenda(itens, modalidade) {
  const erros = [];
  if (!Array.isArray(itens)) return { erros: ['A agenda deve ser uma lista de horários.'], minutosSemanais: 0 };

  const porDia = {};
  let minutosSemanais = 0;

  itens.forEach((item, i) => {
    const pos = `Horário ${i + 1}`;
    const dia = Number(item.dia_semana);
    const entrada = horaParaMinutos(item.hora_entrada);
    const saida = horaParaMinutos(item.hora_saida);
    const intervalo = Number(item.intervalo_minutos || 0);

    if (!Number.isInteger(dia) || dia < 0 || dia > 6) return erros.push(`${pos}: dia da semana inválido.`);
    if (entrada === null || saida === null) return erros.push(`${pos}: informe entrada e saída no formato HH:MM.`);
    if (saida <= entrada) return erros.push(`${pos}: a saída deve ser depois da entrada.`);
    if (!Number.isInteger(intervalo) || intervalo < 0) return erros.push(`${pos}: intervalo inválido.`);
    if (intervalo >= saida - entrada) return erros.push(`${pos}: o intervalo deve ser menor que a jornada.`);
    if (!TURNOS.includes(item.turno)) return erros.push(`${pos}: turno inválido.`);

    // RN02: horários sobrepostos no mesmo dia
    for (const outro of porDia[dia] || []) {
      if (entrada < outro.saida && saida > outro.entrada) {
        erros.push(`${pos}: sobrepõe outro horário no mesmo dia.`);
        return;
      }
    }
    porDia[dia] = [...(porDia[dia] || []), { entrada, saida }];
    minutosSemanais += saida - entrada - intervalo;
  });

  // RF04 / RN02: a jornada planejada deve atender ao mínimo da modalidade
  if (erros.length === 0 && modalidade) {
    const minimo = Math.round(Number(modalidade.horas_semanais) * 60);
    if (minutosSemanais < minimo) {
      erros.push(`A jornada planejada (${formatarMinutos(minutosSemanais)}) está abaixo do mínimo de ` +
        `${formatarMinutos(minimo)} semanais exigido para ${modalidade.nome}.`);
    }
  }
  return { erros, minutosSemanais };
}

// Valida um registro informado manualmente (RN02: sem registro futuro, duplicado ou sobreposto)
function validarRegistroManual({ entrada, saida, agora = new Date(), outros = [] }) {
  const ini = new Date(entrada);
  const fim = new Date(saida);
  if (isNaN(ini) || isNaN(fim)) return 'Informe data e hora de entrada e saída válidas.';
  if (fim <= ini) return 'A saída deve ser depois da entrada.';
  if (fim > agora) return 'Não é permitido registrar horários futuros.';
  if (minutosEntre(ini, fim) > DURACAO_MAXIMA_REGISTRO) return 'Um registro não pode passar de 24 horas.';

  for (const outro of outros) {
    const oIni = new Date(outro.entrada);
    const oFim = new Date(outro.saida || agora);
    if (ini < oFim && fim > oIni) return 'O horário informado se sobrepõe a outro registro existente.';
  }
  return null;
}

// Minutos planejados para um dia da semana (usado para abonar ausências justificadas)
function minutosPlanejadosNoDia(horarios, diaSemana) {
  return horarios
    .filter(h => Number(h.dia_semana) === diaSemana)
    .reduce((s, h) => s + horaParaMinutos(String(h.hora_saida).slice(0, 5)) -
      horaParaMinutos(String(h.hora_entrada).slice(0, 5)) - h.intervalo_minutos, 0);
}

function formatarMinutos(minutos) {
  const sinal = minutos < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minutos));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sinal}${h}h${m ? String(m).padStart(2, '0') : ''}`;
}

module.exports = {
  minutosEntre, minutosDoRegistro, minutosPorDia, minutosExigidosNoMes, percentual, calcularAtrasos,
  resumoMensal, validarAgenda, validarRegistroManual, minutosPlanejadosNoDia, formatarMinutos,
  DURACAO_MAXIMA_REGISTRO
};
