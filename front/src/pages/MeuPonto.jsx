import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api, { mensagemErro } from '../api';
import { useAviso } from '../contexto/Aviso';
import { useCarregar } from '../utils/useCarregar';
import { BarraProgresso, Botao, Cartao, Carregando, ErroCarga, Selo, Titulo } from '../components/ui';
import { dataBr, hora, horas, percentual, ORIGENS } from '../utils/formato';

const primeiraMaiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);

function Relogio() {
  const [agora, setAgora] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-center">
      <p className="text-5xl font-bold tabular-nums text-slate-900 sm:text-6xl" aria-live="off">
        {agora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
      </p>
      <p className="mt-2 text-slate-500">
        {primeiraMaiuscula(agora.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'America/Sao_Paulo' }))}
      </p>
    </div>
  );
}

// Tempo decorrido desde a entrada, atualizado a cada minuto
function TempoDecorrido({ desde }) {
  const [, forcar] = useState(0);
  useEffect(() => {
    const t = setInterval(() => forcar(n => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  return <>{horas(Math.floor((Date.now() - new Date(desde)) / 60000))}</>;
}

function Resumo({ titulo, feitos, exigidos, children }) {
  const pct = exigidos > 0 ? (feitos / exigidos) * 100 : 100;
  return (
    <Cartao titulo={titulo}>
      <p className="text-3xl font-bold text-slate-900">{horas(feitos)}</p>
      {exigidos > 0 && <p className="mb-3 text-sm text-slate-500">de {horas(exigidos)} exigidas</p>}
      {exigidos > 0 && <BarraProgresso valor={pct} rotulo={`${titulo}: ${Math.round(pct)}%`} />}
      <div className="mt-3 space-y-1 text-sm text-slate-600">{children}</div>
    </Cartao>
  );
}

export default function MeuPonto() {
  const avisar = useAviso();
  const [enviando, setEnviando] = useState(false);
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/registros/painel').then(r => r.data));

  // Atualiza os números a cada minuto (acompanhamento em tempo real)
  useEffect(() => {
    const t = setInterval(recarregar, 60000);
    return () => clearInterval(t);
  }, [recarregar]);

  const registrar = async () => {
    const tipo = dados.registroAberto ? 'saida' : 'entrada';
    setEnviando(true);
    try {
      const { data } = await api.post(`/registros/${tipo}`);
      avisar(tipo === 'entrada' ? `Entrada registrada às ${hora(data.registro.entrada)}.` : `Saída registrada às ${hora(data.registro.saida)}.`);
      await recarregar();
    } catch (e) {
      avisar(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  };

  if (carregando && !dados) return <Carregando />;
  if (erro && !dados) return <ErroCarga mensagem={erro} aoTentar={recarregar} />;

  const { hoje, semana, mes, registroAberto, agendaHoje } = dados;
  return (
    <>
      <Titulo>Registrar ponto</Titulo>

      <Cartao className="mb-6">
        <div className="flex flex-col items-center gap-6 py-4">
          <Relogio />
          {registroAberto ? (
            <p className="flex items-center gap-2 text-sm text-emerald-700">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" aria-hidden />
              Em expediente desde {hora(registroAberto.entrada)} (<TempoDecorrido desde={registroAberto.entrada} />)
            </p>
          ) : (
            <p className="text-sm text-slate-500">Você não está com entrada aberta.</p>
          )}
          <Botao tamanho="lg" variante={registroAberto ? 'perigo' : 'sucesso'} carregando={enviando} onClick={registrar} className="w-full max-w-xs py-4 text-lg">
            {registroAberto ? 'Registrar saída' : 'Registrar entrada'}
          </Botao>
          {agendaHoje.length > 0 ? (
            <p className="text-sm text-slate-500">
              Previsto para hoje: {agendaHoje.map(h => `${h.hora_entrada.slice(0, 5)}–${h.hora_saida.slice(0, 5)}`).join(', ')}
            </p>
          ) : (
            <p className="text-sm text-slate-500">Nenhum expediente previsto para hoje na sua agenda.</p>
          )}
        </div>
      </Cartao>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Resumo titulo="Hoje" feitos={hoje.minutos} exigidos={0}>
          {hoje.registros.length === 0 && <p>Nenhum registro hoje.</p>}
          {hoje.registros.map(r => (
            <p key={r.id} className="flex justify-between">
              <span>{hora(r.entrada)} – {r.saida ? hora(r.saida) : 'em aberto'}</span>
              <span className="text-slate-400">{ORIGENS[r.origem]}</span>
            </p>
          ))}
        </Resumo>
        <Resumo titulo="Esta semana" feitos={semana.minutos} exigidos={semana.exigidos}>
          <p>{dataBr(semana.inicio)} a {dataBr(semana.fim)}</p>
          {semana.faltantes > 0 ? <p>Faltam <strong>{horas(semana.faltantes)}</strong></p> : <p className="text-emerald-700">Meta semanal cumprida{semana.excedentes > 0 && ` (+${horas(semana.excedentes)})`}</p>}
        </Resumo>
        <Resumo titulo="Este mês" feitos={mes.minutosConsiderados} exigidos={mes.minutosExigidos}>
          <p>Cumprimento: <strong>{percentual(mes.percentual)}</strong></p>
          {mes.minutosAbonados > 0 && <p>Inclui {horas(mes.minutosAbonados)} abonadas</p>}
          {mes.minutosFaltantes > 0 ? <p>Faltam <strong>{horas(mes.minutosFaltantes)}</strong></p> : <p className="text-emerald-700">Carga mensal cumprida</p>}
          {dados.atrasosNoMes > 0 && <p><Selo cor="amarelo">{dados.atrasosNoMes} atraso(s) no mês</Selo></p>}
        </Resumo>
      </div>

      <p className="text-sm text-slate-500">
        Esqueceu de registrar ou registrou errado? <Link to="/historico" className="font-medium text-sky-700 hover:underline">Abra o histórico</Link> para solicitar um ajuste.
      </p>
    </>
  );
}
