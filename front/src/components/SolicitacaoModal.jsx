import { useEffect, useState } from 'react';
import api, { mensagemErro } from '../api';
import { useAviso } from '../contexto/Aviso';
import { Botao, Campo, Modal, estiloEntrada } from './ui';
import { TIPOS_SOLICITACAO, dataBr, deInputDataHora, hojeChave, hora, paraInputDataHora } from '../utils/formato';

/**
 * Formulário de justificativa/ajuste (RF09).
 * inicial: { tipo, registro?, data?, id? (edição), entrada_proposta?, saida_proposta?, motivo? }
 */
export default function SolicitacaoModal({ aberto, aoFechar, inicial, aoSalvar }) {
  const avisar = useAviso();
  const [form, setForm] = useState({});
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    setForm({
      tipo: inicial?.tipo || 'INCLUSAO_HORAS',
      data: inicial?.data || '',
      entrada: paraInputDataHora(inicial?.entrada_proposta || inicial?.registro?.entrada),
      saida: paraInputDataHora(inicial?.saida_proposta || inicial?.registro?.saida),
      motivo: inicial?.motivo || ''
    });
  }, [aberto, inicial]);

  const muda = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.value }));
  const editando = Boolean(inicial?.id);
  const registro = inicial?.registro;

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const corpo = {
      tipo: form.tipo,
      motivo: form.motivo,
      data: form.data,
      registro_id: registro?.id || inicial?.registro_id,
      entrada_proposta: deInputDataHora(form.entrada),
      saida_proposta: deInputDataHora(form.saida)
    };
    try {
      if (editando) await api.put(`/solicitacoes/${inicial.id}`, corpo);
      else await api.post('/solicitacoes', corpo);
      avisar(editando ? 'Solicitação reenviada para avaliação.' : 'Solicitação enviada para a coordenação.');
      aoSalvar?.();
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const ehJustificativa = form.tipo === 'JUSTIFICATIVA_AUSENCIA';
  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={editando ? 'Corrigir solicitação' : 'Nova solicitação'}
      rodape={<>
        <Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao>
        <Botao type="submit" form="form-solicitacao" carregando={salvando}>{editando ? 'Reenviar' : 'Enviar'}</Botao>
      </>}>
      <form id="form-solicitacao" onSubmit={salvar} className="space-y-4">
        {inicial?.resposta && inicial?.status === 'REVISAO' && (
          <div className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900"><strong>Pedido da coordenação:</strong> {inicial.resposta}</div>
        )}
        <Campo rotulo="Tipo">
          {id => (
            <select id={id} className={estiloEntrada} value={form.tipo || ''} onChange={muda('tipo')} disabled={Boolean(registro) || editando}>
              {Object.entries(TIPOS_SOLICITACAO)
                .filter(([chave]) => chave !== 'CORRECAO_REGISTRO' || registro || inicial?.registro_id)
                .map(([chave, rotulo]) => <option key={chave} value={chave}>{rotulo}</option>)}
            </select>
          )}
        </Campo>

        {registro && (
          <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
            Registro atual: {dataBr(registro.entrada?.slice(0, 10))}, {hora(registro.entrada)} – {registro.saida ? hora(registro.saida) : 'em aberto'}
          </p>
        )}

        {ehJustificativa ? (
          <Campo rotulo="Dia da ausência" ajuda="As horas previstas na sua agenda para esse dia serão abonadas se a justificativa for aprovada.">
            {id => <input id={id} type="date" required max={hojeChave()} className={estiloEntrada} value={form.data || ''} onChange={muda('data')} />}
          </Campo>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo={registro ? 'Entrada correta' : 'Entrada'}>
              {id => <input id={id} type="datetime-local" required className={estiloEntrada} value={form.entrada || ''} onChange={muda('entrada')} />}
            </Campo>
            <Campo rotulo={registro ? 'Saída correta' : 'Saída'}>
              {id => <input id={id} type="datetime-local" required className={estiloEntrada} value={form.saida || ''} onChange={muda('saida')} />}
            </Campo>
          </div>
        )}

        <Campo rotulo="Motivo" ajuda="Explique o que aconteceu (mínimo de 10 caracteres).">
          {id => <textarea id={id} required minLength={10} rows={3} className={estiloEntrada} value={form.motivo || ''} onChange={muda('motivo')} />}
        </Campo>
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{erro}</p>}
      </form>
    </Modal>
  );
}
