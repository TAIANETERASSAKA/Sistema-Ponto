const { test } = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../src/services/calculoHoras');
const datas = require('../src/utils/datas');

// Horários em São Paulo (UTC-3) escritos explicitamente
const sp = (iso) => new Date(`${iso}-03:00`);
const mestrado = { nome: 'Mestrado', horas_semanais: 20, horas_mensais: 80 };

test('chaveDia usa o fuso do laboratório, não o UTC', () => {
  // 23h30 em São Paulo já é dia seguinte em UTC
  assert.equal(datas.chaveDia(sp('2026-10-05T23:30:00')), '2026-10-05');
  assert.equal(datas.chaveMes(sp('2026-10-31T22:00:00')), '2026-10');
});

test('limitesMes converte meia-noite local para UTC', () => {
  const { inicio, fim } = datas.limitesMes('2026-10');
  assert.equal(inicio.toISOString(), '2026-10-01T03:00:00.000Z');
  assert.equal(fim.toISOString(), '2026-11-01T03:00:00.000Z');
});

test('inicioSemana retorna a segunda-feira (domingo pertence à semana anterior)', () => {
  assert.equal(datas.inicioSemana('2026-10-07'), '2026-10-05'); // quarta
  assert.equal(datas.inicioSemana('2026-10-11'), '2026-10-05'); // domingo
  assert.equal(datas.inicioSemana('2026-10-05'), '2026-10-05'); // segunda
});

test('minutosPorDia soma vários registros no mesmo dia e conta o aberto até agora', () => {
  const registros = [
    { entrada: sp('2026-10-05T08:00:00'), saida: sp('2026-10-05T12:00:00') },
    { entrada: sp('2026-10-05T13:00:00'), saida: sp('2026-10-05T17:30:00') },
    { entrada: sp('2026-10-06T09:00:00'), saida: null }
  ];
  const agora = sp('2026-10-06T10:15:00');
  assert.deepEqual(calc.minutosPorDia(registros, agora), { '2026-10-05': 510, '2026-10-06': 75 });
});

test('carga exigida é proporcional ao ingresso no meio do mês', () => {
  assert.equal(calc.minutosExigidosNoMes(mestrado, '2026-10', null), 80 * 60);
  assert.equal(calc.minutosExigidosNoMes(mestrado, '2026-10', '2026-09-01'), 80 * 60);
  assert.equal(calc.minutosExigidosNoMes(mestrado, '2026-10', '2026-11-03'), 0);
  // Ingresso no dia 17: 15 de 31 dias
  assert.equal(calc.minutosExigidosNoMes(mestrado, '2026-10', '2026-10-17'), Math.round(4800 * 15 / 31));
});

test('resumoMensal calcula realizadas, abonadas, faltantes, excedentes e percentual', () => {
  const registros = [
    { entrada: sp('2026-10-05T08:00:00'), saida: sp('2026-10-05T12:00:00') }, // 4h
    { entrada: sp('2026-10-06T08:00:00'), saida: sp('2026-10-06T14:00:00') }, // 6h
    { entrada: sp('2026-09-30T08:00:00'), saida: sp('2026-09-30T12:00:00') }  // outro mês: ignorado
  ];
  const r = calc.resumoMensal({
    registros, abonos: [{ data: '2026-10-07', minutos: 120 }], modalidade: mestrado, mes: '2026-10'
  });
  assert.equal(r.minutosRealizados, 600);
  assert.equal(r.minutosAbonados, 120);
  assert.equal(r.minutosExigidos, 4800);
  assert.equal(r.minutosFaltantes, 4080);
  assert.equal(r.minutosExcedentes, 0);
  assert.equal(r.percentual, 15);
  assert.equal(r.cumpriu, false);
  assert.equal(r.diasTrabalhados, 2);
  assert.equal(r.semanas.length, 1);
  assert.equal(r.semanas[0].minutos, 600);
  assert.equal(r.semanas[0].faltantes, 1200 - 720);
});

test('resumoMensal identifica cumprimento e banco de horas acumulado (RN05)', () => {
  const registros = [];
  for (let dia = 1; dia <= 21; dia++) { // 21 dias x 4h = 84h
    const d = String(dia).padStart(2, '0');
    registros.push({ entrada: sp(`2026-10-${d}T08:00:00`), saida: sp(`2026-10-${d}T12:00:00`) });
  }
  const r = calc.resumoMensal({
    registros, modalidade: mestrado, mes: '2026-10', bancoHorasAtivo: true, saldoBancoAnterior: -60
  });
  assert.equal(r.cumpriu, true);
  assert.equal(r.minutosExcedentes, 240);
  assert.equal(r.saldoBancoMinutos, 180);
  assert.equal(r.percentual, 105);
});

test('calcularAtrasos respeita a tolerância (RN04)', () => {
  const horarios = [{ dia_semana: 1, hora_entrada: '08:00:00', hora_saida: '12:00:00', intervalo_minutos: 0 }];
  const registros = [
    { entrada: sp('2026-10-05T08:09:00') }, // segunda, dentro da tolerância de 10 min
    { entrada: sp('2026-10-12T08:25:00') }, // segunda, 25 min de atraso
    { entrada: sp('2026-10-13T10:00:00') }  // terça, sem horário planejado
  ];
  assert.deepEqual(calc.calcularAtrasos(registros, horarios, 10), [{ data: '2026-10-12', minutosAtraso: 25 }]);
});

test('validarAgenda aceita jornada válida e soma descontando intervalos', () => {
  const agenda = [1, 2, 3, 4, 5].map(dia => ({
    dia_semana: dia, hora_entrada: '08:00', hora_saida: '13:00', intervalo_minutos: 60, turno: 'MANHA'
  }));
  const { erros, minutosSemanais } = calc.validarAgenda(agenda, mestrado);
  assert.deepEqual(erros, []);
  assert.equal(minutosSemanais, 5 * 240);
});

test('validarAgenda recusa sobreposição e jornada abaixo do mínimo (RN02)', () => {
  const sobreposta = calc.validarAgenda([
    { dia_semana: 1, hora_entrada: '08:00', hora_saida: '12:00', turno: 'MANHA' },
    { dia_semana: 1, hora_entrada: '11:00', hora_saida: '15:00', turno: 'TARDE' }
  ], null);
  assert.match(sobreposta.erros[0], /sobrepõe/);

  const curta = calc.validarAgenda([
    { dia_semana: 1, hora_entrada: '08:00', hora_saida: '12:00', turno: 'MANHA' }
  ], mestrado);
  assert.match(curta.erros[0], /abaixo do mínimo de 20h/);

  const invalida = calc.validarAgenda([
    { dia_semana: 1, hora_entrada: '14:00', hora_saida: '12:00', turno: 'TARDE' }
  ], null);
  assert.match(invalida.erros[0], /saída deve ser depois/);
});

test('validarRegistroManual bloqueia futuro, sobreposição e duração excessiva (RN02)', () => {
  const agora = sp('2026-10-10T12:00:00');
  const outros = [{ entrada: sp('2026-10-09T08:00:00'), saida: sp('2026-10-09T12:00:00') }];

  assert.equal(calc.validarRegistroManual({
    entrada: sp('2026-10-09T13:00:00'), saida: sp('2026-10-09T17:00:00'), agora, outros
  }), null);
  assert.match(calc.validarRegistroManual({
    entrada: sp('2026-10-10T11:00:00'), saida: sp('2026-10-10T13:00:00'), agora, outros
  }), /futuros/);
  assert.match(calc.validarRegistroManual({
    entrada: sp('2026-10-09T11:00:00'), saida: sp('2026-10-09T14:00:00'), agora, outros
  }), /sobrepõe/);
  assert.match(calc.validarRegistroManual({
    entrada: sp('2026-10-07T08:00:00'), saida: sp('2026-10-08T09:00:00'), agora, outros
  }), /24 horas/);
});

test('formatarMinutos', () => {
  assert.equal(calc.formatarMinutos(510), '8h30');
  assert.equal(calc.formatarMinutos(480), '8h');
  assert.equal(calc.formatarMinutos(-75), '-1h15');
});
