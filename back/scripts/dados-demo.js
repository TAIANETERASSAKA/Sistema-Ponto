// Popula o banco com dados fictícios para demonstração.
// Uso: docker compose exec back node scripts/dados-demo.js
// Só roda fora de produção e em um banco sem pesquisadores.
const env = require('../src/config/env');
const { sequelize, Usuario, Modalidade, Horario, Registro, Solicitacao } = require('../src/models');
const { fecharMes } = require('../src/services/fechamentoService');
const { localParaUtc, chaveDia, chaveMes, mesAnterior, diasNoMes, diaDaSemana } = require('../src/utils/datas');

// Gerador pseudoaleatório com semente fixa (os dados saem iguais a cada execução)
let semente = 42;
const aleatorio = () => (semente = (semente * 16807) % 2147483647) / 2147483647;
const entre = (min, max) => Math.round(min + aleatorio() * (max - min));

const PESQUISADORES = [
  { nome: 'Beatriz Almeida', numero_usp: '2000001', modalidade: 'Doutorado', presenca: 0.97, atraso: 5 },
  { nome: 'Rafael Nogueira', numero_usp: '2000002', modalidade: 'Mestrado', presenca: 0.93, atraso: 12 },
  { nome: 'Juliana Costa', numero_usp: '2000003', modalidade: 'Pós-doutorado', presenca: 0.95, atraso: 4 },
  { nome: 'Lucas Ferreira', numero_usp: '2000004', modalidade: 'Iniciação científica', presenca: 0.72, atraso: 25 },
  { nome: 'Mariana Souza', numero_usp: '2000005', modalidade: 'Estágio', presenca: 0.88, atraso: 8 },
  { nome: 'Thiago Ribeiro', numero_usp: '2000006', modalidade: 'Mestrado', presenca: 0.5, atraso: 30 }
];

// Agenda de segunda a sexta que atende à carga semanal da modalidade
function agendaPara(horasSemanais) {
  const porDia = horasSemanais / 5;
  const integral = porDia > 6;
  const entrada = integral ? 8 * 60 : 9 * 60;
  const intervalo = integral ? 60 : 0;
  const saida = entrada + Math.round(porDia * 60) + intervalo;
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  return [1, 2, 3, 4, 5].map(dia => ({
    dia_semana: dia, hora_entrada: hhmm(entrada), hora_saida: hhmm(saida), intervalo_minutos: intervalo,
    turno: integral ? 'INTEGRAL' : 'MANHA'
  }));
}

async function gerarRegistros(usuario, perfil, agenda, mes, ateDia) {
  const [ano, m] = mes.split('-').map(Number);
  const registros = [];
  for (let dia = 1; dia <= Math.min(ateDia, diasNoMes(ano, m)); dia++) {
    const chave = `${mes}-${String(dia).padStart(2, '0')}`;
    const previsto = agenda.find(h => h.dia_semana === diaDaSemana(chave));
    if (!previsto || aleatorio() > perfil.presenca) continue;

    const [he, me] = previsto.hora_entrada.split(':').map(Number);
    const [hs, ms] = previsto.hora_saida.split(':').map(Number);
    const entrada = he * 60 + me + entre(-10, perfil.atraso);
    const saida = hs * 60 + ms + entre(-25, 20);
    const instante = (min) => localParaUtc(ano, m, dia, Math.floor(min / 60), min % 60);

    if (previsto.intervalo_minutos) {
      const almoco = 12 * 60 + entre(0, 20);
      registros.push({ entrada: instante(entrada), saida: instante(almoco) });
      registros.push({ entrada: instante(almoco + previsto.intervalo_minutos), saida: instante(saida) });
    } else {
      registros.push({ entrada: instante(entrada), saida: instante(saida) });
    }
  }
  await Registro.bulkCreate(registros.map(r => ({
    ...r, usuario_id: usuario.id, origem: aleatorio() < 0.3 ? 'MOBILE' : 'WEB', criado_por_id: usuario.id
  })));
}

async function main() {
  if (env.emProducao) throw new Error('Dados de demonstração não podem ser gerados em produção.');
  if (await Usuario.count({ where: { perfil: 'PESQUISADOR' } })) {
    console.log('O banco já tem pesquisadores; nada foi alterado.');
    return;
  }

  const modalidades = Object.fromEntries((await Modalidade.findAll()).map(m => [m.nome, m]));
  const [admin] = await Usuario.findOrCreate({
    where: { numero_usp: '1000001' },
    defaults: { nome: 'Administrador Demo', email: 'admin.demo@usp.br', perfil: 'ADMIN' }
  });
  const coordenadora = await Usuario.create({
    nome: 'Profa. Helena Martins', email: 'helena.demo@usp.br', numero_usp: '1000002', perfil: 'COORDENADOR'
  });

  const agora = new Date();
  const mesAtual = chaveMes(agora);
  const mesPassado = mesAnterior(mesAtual);
  const hoje = Number(chaveDia(agora).slice(8, 10));

  for (const perfil of PESQUISADORES) {
    const modalidade = modalidades[perfil.modalidade];
    const usuario = await Usuario.create({
      nome: perfil.nome, email: `${perfil.nome.split(' ')[0].toLowerCase()}.demo@usp.br`, numero_usp: perfil.numero_usp,
      telefone: `(16) 9${entre(1000, 9999)}-${entre(1000, 9999)}`, perfil: 'PESQUISADOR',
      modalidade_id: modalidade.id, orientador_id: coordenadora.id, data_ingresso: `${mesAnterior(mesPassado)}-01`
    });
    const agenda = agendaPara(modalidade.horas_semanais);
    await Horario.bulkCreate(agenda.map(h => ({ ...h, usuario_id: usuario.id })));
    await gerarRegistros(usuario, perfil, agenda, mesPassado, 31);
    await gerarRegistros(usuario, perfil, agenda, mesAtual, hoje - 1);
  }

  // Alguém com o ponto aberto agora e algumas solicitações para avaliar
  const [beatriz, rafael, lucas] = await Promise.all(['2000001', '2000002', '2000004'].map(n => Usuario.findOne({ where: { numero_usp: n } })));
  await Registro.create({ usuario_id: beatriz.id, entrada: new Date(agora.getTime() - 95 * 60000), origem: 'WEB', criado_por_id: beatriz.id });
  const ontem = chaveDia(new Date(agora.getTime() - 86400000));
  const [a, m, d] = ontem.split('-').map(Number);
  await Solicitacao.bulkCreate([
    { usuario_id: rafael.id, tipo: 'INCLUSAO_HORAS', data: ontem, entrada_proposta: localParaUtc(a, m, d, 14, 0), saida_proposta: localParaUtc(a, m, d, 17, 30), motivo: 'Fiquei no laboratório à tarde rodando experimentos e esqueci de registrar.' },
    { usuario_id: lucas.id, tipo: 'JUSTIFICATIVA_AUSENCIA', data: ontem, motivo: 'Consulta médica, apresento o atestado na secretaria.' }
  ]);

  await fecharMes(mesPassado, { geradoPorId: admin.id });
  console.log(`Dados de demonstração criados: ${PESQUISADORES.length} pesquisadores, registros de ${mesPassado} e ${mesAtual}, fechamento de ${mesPassado}.`);
}

main()
  .catch((erro) => { console.error(erro.message); process.exitCode = 1; })
  .finally(() => sequelize.close());
