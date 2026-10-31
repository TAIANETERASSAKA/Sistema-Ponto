import { Link } from 'react-router-dom';
import api from '../../api';
import { useCarregar } from '../../utils/useCarregar';
import { BarraProgresso, Cartao, Carregando, ErroCarga, Indicador, Selo, Titulo, Vazio } from '../../components/ui';
import { hora, horas, nomeMes, percentual } from '../../utils/formato';

const COR_ALERTA = { alta: 'vermelho', media: 'amarelo', baixa: 'cinza' };
const ROTULO_ALERTA = {
  REGISTRO_ABERTO: 'Saída esquecida', AUSENTE_HOJE: 'Ausente', ATRASO: 'Atraso',
  SEM_AGENDA: 'Sem agenda', AGENDA_INSUFICIENTE: 'Agenda insuficiente'
};

export default function Painel() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/painel').then(r => r.data));
  if (carregando && !dados) return <Carregando />;
  if (erro) return <ErroCarga mensagem={erro} aoTentar={recarregar} />;

  const { indicadores: ind, ranking, baixaFrequencia, alertas, estatisticas: est } = dados;
  const maiorTaxa = Math.max(100, ...est.evolucao.map(e => e.taxaCumprimento || 0));

  return (
    <>
      <Titulo subtitulo={`${nomeMes(dados.mes)} · ${Math.round(dados.fracaoDecorrida * 100)}% do mês decorrido. A frequência considera o esperado até hoje.`}>
        Painel gerencial
      </Titulo>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicador rotulo="Presentes agora" valor={ind.presentesAgora} detalhe={`de ${ind.pesquisadoresAtivos} pesquisadores ativos`} />
        <Indicador rotulo="Presença hoje" valor={ind.taxaPresencaHoje === null ? '—' : percentual(ind.taxaPresencaHoje)}
          detalhe={`${ind.presentesHoje} presente(s), ${ind.comAgendaHoje} com expediente previsto`} />
        <Indicador rotulo="Em dia no mês" valor={`${est.emDiaAteHoje}/${ind.pesquisadoresAtivos}`} detalhe={`Média ${percentual(est.mediaPercentualEsperado)} do esperado`} />
        <Link to="/solicitacoes" className="block">
          <Indicador rotulo="Solicitações pendentes" valor={ind.solicitacoesPendentes} detalhe="Clique para avaliar"
            cor={ind.solicitacoesPendentes ? 'text-amber-600' : 'text-slate-900'} />
        </Link>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Cartao titulo={`Alertas (${alertas.length})`}>
          {alertas.length === 0 ? <Vazio titulo="Nenhuma irregularidade no momento." /> : (
            <ul className="max-h-80 space-y-2 overflow-y-auto">
              {alertas.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Selo cor={COR_ALERTA[a.severidade]}>{ROTULO_ALERTA[a.tipo]}</Selo>
                  <Link to={`/frequencia/${a.pesquisadorId}`} className="text-slate-700 hover:text-sky-700">{a.mensagem}</Link>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Baixa frequência">
          {baixaFrequencia.length === 0 ? <Vazio titulo="Ninguém abaixo do limite configurado." /> : (
            <ul className="space-y-3">
              {baixaFrequencia.map(c => (
                <li key={c.pesquisador.id}>
                  <div className="mb-1 flex justify-between text-sm">
                    <Link to={`/frequencia/${c.pesquisador.id}`} className="font-medium hover:text-sky-700">{c.pesquisador.nome}</Link>
                    <span className="text-red-600">{percentual(c.percentualEsperado)} do esperado</span>
                  </div>
                  <BarraProgresso valor={c.percentualEsperado} rotulo={c.pesquisador.nome} />
                  <p className="mt-1 text-xs text-slate-500">{horas(c.minutosConsiderados)} de {horas(c.minutosEsperadosAteHoje)} esperadas até hoje</p>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Ranking de frequência" className="lg:col-span-2">
          {ranking.length === 0 ? <Vazio titulo="Nenhum pesquisador ativo." /> : (
            <ol className="space-y-3">
              {ranking.map((c, i) => (
                <li key={c.pesquisador.id} className="flex items-center gap-3">
                  <span className="w-6 text-right text-sm font-bold text-slate-400">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex justify-between gap-2 text-sm">
                      <Link to={`/frequencia/${c.pesquisador.id}`} className="truncate font-medium hover:text-sky-700">{c.pesquisador.nome}</Link>
                      <span className="shrink-0 text-slate-600">{percentual(c.percentualEsperado)}</span>
                    </div>
                    <BarraProgresso valor={c.percentualEsperado} rotulo={c.pesquisador.nome} />
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Cartao>

        <div className="space-y-6">
          <Cartao titulo="Presentes agora">
            {dados.presentesAgora.length === 0 ? <p className="text-sm text-slate-500">Ninguém com entrada aberta.</p> : (
              <ul className="space-y-1 text-sm">
                {dados.presentesAgora.map(p => <li key={p.id} className="flex justify-between"><span>{p.nome}</span><span className="text-slate-500">desde {hora(p.entrada)}</span></li>)}
              </ul>
            )}
          </Cartao>
          <Cartao titulo="Evolução mensal">
            {est.evolucao.length === 0 ? <p className="text-sm text-slate-500">Aparece após o primeiro fechamento mensal.</p> : (
              <div className="flex h-36 items-end gap-2" role="img" aria-label="Taxa de cumprimento por mês">
                {est.evolucao.map(e => (
                  <div key={e.mes} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-xs font-semibold text-slate-600">{Math.round(e.taxaCumprimento || 0)}%</span>
                    <div className="w-full rounded-t bg-sky-600" style={{ height: `${((e.taxaCumprimento || 0) / maiorTaxa) * 100}px` }} title={`${e.totalCumpriram} de ${e.totalPesquisadores}`} />
                    <span className="text-xs text-slate-500">{e.mes.slice(5)}/{e.mes.slice(2, 4)}</span>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-xs text-slate-500">Taxa de cumprimento da carga horária nos meses fechados. Horas no mês atual: {horas(est.minutosRealizadosMes)}.</p>
          </Cartao>
        </div>
      </div>
    </>
  );
}
