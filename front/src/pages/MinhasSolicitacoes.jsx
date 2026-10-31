import { useState } from 'react';
import api, { mensagemErro } from '../api';
import { useAviso } from '../contexto/Aviso';
import { useCarregar } from '../utils/useCarregar';
import SolicitacaoModal from '../components/SolicitacaoModal';
import { Botao, Cartao, Carregando, ErroCarga, Selo, Titulo, Vazio } from '../components/ui';
import { STATUS_SOLICITACAO, TIPOS_SOLICITACAO, dataBr, dataHora, hora } from '../utils/formato';

// Descrição do que foi pedido
export function DetalheSolicitacao({ s }) {
  if (s.tipo === 'JUSTIFICATIVA_AUSENCIA') {
    return <>Ausência em {dataBr(s.data)}{s.minutos_abonados ? ` · ${Math.floor(s.minutos_abonados / 60)}h${String(s.minutos_abonados % 60).padStart(2, '0')} abonadas` : ''}</>;
  }
  return (
    <>
      {dataBr(s.data)}: {hora(s.entrada_proposta)} – {hora(s.saida_proposta)}
      {s.registro && <span className="text-slate-400"> (antes: {hora(s.registro.entrada)} – {s.registro.saida ? hora(s.registro.saida) : 'em aberto'})</span>}
    </>
  );
}

export default function MinhasSolicitacoes() {
  const avisar = useAviso();
  const [modal, setModal] = useState(null);
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/solicitacoes/minhas').then(r => r.data.solicitacoes));

  const cancelar = async (s) => {
    if (!window.confirm('Cancelar esta solicitação?')) return;
    try {
      await api.delete(`/solicitacoes/${s.id}`);
      avisar('Solicitação cancelada.');
      recarregar();
    } catch (e) {
      avisar(mensagemErro(e), 'erro');
    }
  };

  return (
    <>
      <Titulo subtitulo="Justificativas de ausência, correções e inclusões de horas enviadas para a coordenação."
        acao={<Botao onClick={() => setModal({ tipo: 'INCLUSAO_HORAS' })}>Nova solicitação</Botao>}>
        Minhas solicitações
      </Titulo>

      {carregando && !dados ? <Carregando /> : erro ? <ErroCarga mensagem={erro} aoTentar={recarregar} /> : dados.length === 0 ? (
        <Vazio titulo="Você ainda não fez nenhuma solicitação.">Para corrigir um registro, use o botão “Solicitar correção” no histórico.</Vazio>
      ) : (
        <div className="space-y-3">
          {dados.map(s => {
            const status = STATUS_SOLICITACAO[s.status];
            return (
              <Cartao key={s.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold">{TIPOS_SOLICITACAO[s.tipo]}</h2>
                      <Selo cor={status.cor}>{status.rotulo}</Selo>
                    </div>
                    <p className="text-sm text-slate-600"><DetalheSolicitacao s={s} /></p>
                    <p className="mt-2 text-sm text-slate-700">{s.motivo}</p>
                    {s.resposta && (
                      <p className="mt-2 rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
                        <strong>{s.avaliadoPor?.nome || 'Coordenação'}:</strong> {s.resposta}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-400">Enviada em {dataHora(s.created_at)}{s.avaliado_em && ` · avaliada em ${dataHora(s.avaliado_em)}`}</p>
                  </div>
                  {['PENDENTE', 'REVISAO'].includes(s.status) && (
                    <div className="flex gap-2">
                      <Botao variante={s.status === 'REVISAO' ? 'primario' : 'secundario'} tamanho="sm" onClick={() => setModal(s)}>
                        {s.status === 'REVISAO' ? 'Corrigir e reenviar' : 'Editar'}
                      </Botao>
                      <Botao variante="fantasma" tamanho="sm" className="text-red-600 hover:bg-red-50" onClick={() => cancelar(s)}>Cancelar</Botao>
                    </div>
                  )}
                </div>
              </Cartao>
            );
          })}
        </div>
      )}
      <SolicitacaoModal aberto={Boolean(modal)} inicial={modal} aoFechar={() => setModal(null)} aoSalvar={recarregar} />
    </>
  );
}
