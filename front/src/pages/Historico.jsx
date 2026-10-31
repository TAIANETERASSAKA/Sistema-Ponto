import { useState } from 'react';
import api from '../api';
import { useCarregar } from '../utils/useCarregar';
import SolicitacaoModal from '../components/SolicitacaoModal';
import { BarraProgresso, Botao, Cartao, Carregando, ErroCarga, Indicador, SeletorMes, Selo, Tabela, Titulo } from '../components/ui';
import { ORIGENS, dataBr, diaSemanaCurto, hora, horas, mesAtual, percentual } from '../utils/formato';

// Conteúdo do histórico mensal, reaproveitado pela gestão (FrequenciaPesquisador)
export function ResumoDoMes({ resumo, atrasos }) {
  return (
    <>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Realizadas" valor={horas(resumo.minutosRealizados)} detalhe={`${resumo.diasTrabalhados} dia(s) trabalhado(s)`} />
        <Indicador rotulo="Exigidas no mês" valor={horas(resumo.minutosExigidos)} detalhe={resumo.minutosAbonados ? `${horas(resumo.minutosAbonados)} abonadas` : 'Nenhuma hora abonada'} />
        <Indicador rotulo={resumo.minutosFaltantes ? 'Faltantes' : 'Excedentes'} valor={horas(resumo.minutosFaltantes || resumo.minutosExcedentes)}
          cor={resumo.minutosFaltantes ? 'text-red-600' : 'text-emerald-600'} />
        <Indicador rotulo="Cumprimento" valor={percentual(resumo.percentual)} detalhe={atrasos?.length ? `${atrasos.length} atraso(s)` : 'Sem atrasos'}
          cor={resumo.cumpriu ? 'text-emerald-600' : 'text-slate-900'} />
      </div>
      <div className="mb-6"><BarraProgresso valor={resumo.percentual} rotulo="Cumprimento do mês" /></div>
      {resumo.saldoBancoMinutos !== 0 && (
        <p className="-mt-3 mb-6 text-sm text-slate-600">Saldo no banco de horas: <strong>{horas(resumo.saldoBancoMinutos)}</strong></p>
      )}
      {resumo.semanas.length > 0 && (
        <Cartao titulo="Semanas" className="mb-6">
          <Tabela chave="inicio" linhas={resumo.semanas} colunas={[
            { titulo: 'Semana', render: s => `${dataBr(s.inicio)} a ${dataBr(s.fim)}` },
            { titulo: 'Realizadas', render: s => horas(s.minutos) },
            { titulo: 'Abonadas', render: s => horas(s.abonados) },
            { titulo: 'Exigidas', render: s => horas(s.exigidos) },
            { titulo: 'Situação', render: s => s.faltantes ? <Selo cor="vermelho">Faltam {horas(s.faltantes)}</Selo> : <Selo cor="verde">Cumprida</Selo> }
          ]} />
        </Cartao>
      )}
    </>
  );
}

export function colunasRegistros(acoes) {
  return [
    { titulo: 'Dia', render: r => <span className="whitespace-nowrap">{diaSemanaCurto(r.dia)} {dataBr(r.dia)}</span> },
    { titulo: 'Entrada', render: r => hora(r.entrada) },
    { titulo: 'Saída', render: r => r.saida ? hora(r.saida) : <Selo cor="amarelo">Em aberto</Selo> },
    { titulo: 'Duração', render: r => r.saida ? horas(Math.round((new Date(r.saida) - new Date(r.entrada)) / 60000)) : '—' },
    { titulo: 'Origem', render: r => <Selo cor={['MANUAL', 'AJUSTE'].includes(r.origem) ? 'azul' : 'cinza'}>{ORIGENS[r.origem]}</Selo> },
    { titulo: 'Observação', classe: 'max-w-xs', render: r => <span className="line-clamp-2 text-xs text-slate-500" title={r.observacao}>{r.observacao || ''}</span> },
    ...(acoes ? [{ titulo: '', classe: 'text-right', render: acoes }] : [])
  ];
}

export const comDia = (registros) => registros.map(r => ({
  ...r, dia: new Date(r.entrada).toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}));

export default function Historico() {
  const [mes, setMes] = useState(mesAtual());
  const [modal, setModal] = useState(null);
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/registros/meus', { params: { mes } }).then(r => r.data), [mes]);

  return (
    <>
      <Titulo subtitulo="Seus registros, horas acumuladas e cumprimento da carga horária."
        acao={<SeletorMes mes={mes} aoMudar={setMes} maximo={mesAtual()} />}>
        Histórico
      </Titulo>

      {carregando && !dados ? <Carregando /> : erro ? <ErroCarga mensagem={erro} aoTentar={recarregar} /> : (
        <>
          <ResumoDoMes resumo={dados.resumo} atrasos={dados.atrasos} />
          <Cartao titulo="Registros do mês" acao={
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" tamanho="sm" onClick={() => setModal({ tipo: 'JUSTIFICATIVA_AUSENCIA' })}>Justificar ausência</Botao>
              <Botao variante="secundario" tamanho="sm" onClick={() => setModal({ tipo: 'INCLUSAO_HORAS' })}>Incluir horas esquecidas</Botao>
            </div>
          }>
            <Tabela linhas={comDia(dados.registros)} vazio="Nenhum registro neste mês."
              colunas={colunasRegistros(r => (
                <Botao variante="fantasma" tamanho="sm" onClick={() => setModal({ tipo: 'CORRECAO_REGISTRO', registro: r })}>Solicitar correção</Botao>
              ))} />
          </Cartao>
        </>
      )}

      <SolicitacaoModal aberto={Boolean(modal)} inicial={modal} aoFechar={() => setModal(null)} aoSalvar={recarregar} />
    </>
  );
}
