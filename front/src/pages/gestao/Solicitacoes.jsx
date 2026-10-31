import { useState } from 'react';
import api, { mensagemErro } from '../../api';
import { useAviso } from '../../contexto/Aviso';
import { useCarregar } from '../../utils/useCarregar';
import { DetalheSolicitacao } from '../MinhasSolicitacoes';
import { Botao, Campo, Cartao, Carregando, ErroCarga, Modal, Selo, Titulo, Vazio, estiloEntrada } from '../../components/ui';
import { STATUS_SOLICITACAO, TIPOS_SOLICITACAO, dataHora } from '../../utils/formato';

const FILTROS = [['PENDENTE', 'Pendentes'], ['REVISAO', 'Em revisão'], ['APROVADA', 'Aprovadas'], ['REJEITADA', 'Rejeitadas'], ['', 'Todas']];
const DECISOES = {
  APROVADA: { titulo: 'Aprovar solicitação', botao: 'Aprovar', variante: 'sucesso', obrigatoria: false },
  REVISAO: { titulo: 'Pedir revisão ao pesquisador', botao: 'Pedir revisão', variante: 'primario', obrigatoria: true },
  REJEITADA: { titulo: 'Rejeitar solicitação', botao: 'Rejeitar', variante: 'perigo', obrigatoria: true }
};

export default function Solicitacoes() {
  const avisar = useAviso();
  const [status, setStatus] = useState('PENDENTE');
  const [avaliando, setAvaliando] = useState(null); // { solicitacao, decisao }
  const [resposta, setResposta] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);
  const { dados, carregando, erro: erroCarga, recarregar } = useCarregar(
    () => api.get('/solicitacoes', { params: status ? { status } : {} }).then(r => r.data.solicitacoes), [status]);

  const abrir = (solicitacao, decisao) => { setAvaliando({ solicitacao, decisao }); setResposta(''); setErro(null); };

  const confirmar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/solicitacoes/${avaliando.solicitacao.id}/avaliar`, { decisao: avaliando.decisao, resposta });
      avisar('Avaliação registrada e pesquisador notificado.');
      setAvaliando(null);
      recarregar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setEnviando(false);
    }
  };

  const config = avaliando && DECISOES[avaliando.decisao];
  return (
    <>
      <Titulo subtitulo="Ao aprovar, a correção, a inclusão ou o abono de horas é aplicado automaticamente.">Avaliar solicitações</Titulo>
      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {FILTROS.map(([valor, rotulo]) => (
          <button key={rotulo} type="button" role="tab" aria-selected={status === valor} onClick={() => setStatus(valor)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${status === valor ? 'bg-sky-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {rotulo}
          </button>
        ))}
      </div>

      {carregando && !dados ? <Carregando /> : erroCarga ? <ErroCarga mensagem={erroCarga} aoTentar={recarregar} /> : dados.length === 0 ? (
        <Vazio titulo={status === 'PENDENTE' ? 'Nenhuma solicitação aguardando avaliação.' : 'Nenhuma solicitação encontrada.'} />
      ) : (
        <div className="space-y-3">
          {dados.map(s => (
            <Cartao key={s.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{s.usuario?.nome}</h2>
                    <span className="text-sm text-slate-500">{TIPOS_SOLICITACAO[s.tipo]}</span>
                    <Selo cor={STATUS_SOLICITACAO[s.status].cor}>{STATUS_SOLICITACAO[s.status].rotulo}</Selo>
                  </div>
                  <p className="text-sm text-slate-600"><DetalheSolicitacao s={s} /></p>
                  <p className="mt-2 text-sm text-slate-800">“{s.motivo}”</p>
                  {s.resposta && <p className="mt-2 text-sm text-slate-600"><strong>Resposta ({s.avaliadoPor?.nome}):</strong> {s.resposta}</p>}
                  <p className="mt-2 text-xs text-slate-400">Enviada em {dataHora(s.created_at)}</p>
                </div>
                {s.status === 'PENDENTE' && (
                  <div className="flex flex-wrap gap-2">
                    <Botao variante="sucesso" tamanho="sm" onClick={() => abrir(s, 'APROVADA')}>Aprovar</Botao>
                    <Botao variante="secundario" tamanho="sm" onClick={() => abrir(s, 'REVISAO')}>Pedir revisão</Botao>
                    <Botao variante="fantasma" tamanho="sm" className="text-red-600 hover:bg-red-50" onClick={() => abrir(s, 'REJEITADA')}>Rejeitar</Botao>
                  </div>
                )}
              </div>
            </Cartao>
          ))}
        </div>
      )}

      <Modal aberto={Boolean(avaliando)} aoFechar={() => setAvaliando(null)} titulo={config?.titulo}
        rodape={<><Botao variante="secundario" onClick={() => setAvaliando(null)}>Cancelar</Botao>
          <Botao type="submit" form="form-avaliacao" variante={config?.variante} carregando={enviando}>{config?.botao}</Botao></>}>
        {avaliando && (
          <form id="form-avaliacao" onSubmit={confirmar} className="space-y-4">
            <p className="text-sm text-slate-600">
              {avaliando.solicitacao.usuario?.nome} — {TIPOS_SOLICITACAO[avaliando.solicitacao.tipo]}: <DetalheSolicitacao s={avaliando.solicitacao} />
            </p>
            <Campo rotulo={config.obrigatoria ? 'Resposta ao pesquisador' : 'Comentário (opcional)'}
              ajuda={avaliando.decisao === 'REVISAO' ? 'Explique o que precisa ser corrigido.' : undefined}>
              {id => <textarea id={id} rows={3} required={config.obrigatoria} className={estiloEntrada} value={resposta} onChange={e => setResposta(e.target.value)} />}
            </Campo>
            {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{erro}</p>}
          </form>
        )}
      </Modal>
    </>
  );
}
