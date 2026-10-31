import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import api, { mensagemErro } from '../../api';
import { useAuth } from '../../contexto/Auth';
import { useAviso } from '../../contexto/Aviso';
import { useCarregar } from '../../utils/useCarregar';
import { ResumoDoMes, colunasRegistros, comDia } from '../Historico';
import { Botao, Campo, Cartao, Carregando, ErroCarga, Modal, SeletorMes, Tabela, Titulo, estiloEntrada } from '../../components/ui';
import { DIAS_SEMANA, TURNOS, deInputDataHora, horas, mesAtual, paraInputDataHora } from '../../utils/formato';

// Registro manual autorizado ou ajuste de registro pelo administrador (RF05 / RF12)
function ModalRegistro({ aberto, aoFechar, usuarioId, registro, aoSalvar }) {
  const avisar = useAviso();
  const [form, setForm] = useState({});
  const [erro, setErro] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    setForm({ entrada: paraInputDataHora(registro?.entrada), saida: paraInputDataHora(registro?.saida), texto: '' });
    setErro(null);
  }, [aberto, registro]);

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const horario = { entrada: deInputDataHora(form.entrada), saida: deInputDataHora(form.saida) };
    try {
      if (registro) await api.put(`/registros/${registro.id}`, { ...horario, motivo: form.texto });
      else await api.post('/registros/manual', { ...horario, usuario_id: usuarioId, observacao: form.texto });
      avisar(registro ? 'Registro ajustado.' : 'Registro manual incluído.');
      aoSalvar();
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo={registro ? 'Ajustar registro' : 'Registro manual autorizado'}
      rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao type="submit" form="form-registro" carregando={salvando}>Salvar</Botao></>}>
      <form id="form-registro" onSubmit={salvar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Entrada">{id => <input id={id} type="datetime-local" required className={estiloEntrada} value={form.entrada || ''} onChange={e => setForm({ ...form, entrada: e.target.value })} />}</Campo>
          <Campo rotulo="Saída">{id => <input id={id} type="datetime-local" required className={estiloEntrada} value={form.saida || ''} onChange={e => setForm({ ...form, saida: e.target.value })} />}</Campo>
        </div>
        <Campo rotulo={registro ? 'Motivo do ajuste' : 'Motivo do registro manual'} ajuda="Fica registrado no histórico de auditoria.">
          {id => <textarea id={id} required rows={3} className={estiloEntrada} value={form.texto || ''} onChange={e => setForm({ ...form, texto: e.target.value })} />}
        </Campo>
        {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{erro}</p>}
      </form>
    </Modal>
  );
}

export default function FrequenciaPesquisador() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const mes = params.get('mes') || mesAtual();
  const { ehAdmin } = useAuth();
  const avisar = useAviso();
  const [modal, setModal] = useState(null);

  const { dados, carregando, erro, recarregar } = useCarregar(() => Promise.all([
    api.get(`/registros/usuario/${id}`, { params: { mes } }),
    api.get(`/horarios/usuario/${id}`)
  ]).then(([r, h]) => ({ ...r.data, agenda: h.data })), [id, mes]);

  const excluir = async (registro) => {
    const motivo = window.prompt('Informe o motivo da exclusão deste registro:');
    if (!motivo) return;
    try {
      await api.delete(`/registros/${registro.id}`, { data: { motivo } });
      avisar('Registro excluído.');
      recarregar();
    } catch (e) {
      avisar(mensagemErro(e), 'erro');
    }
  };

  if (carregando && !dados) return <Carregando />;
  if (erro) return <ErroCarga mensagem={erro} aoTentar={recarregar} />;
  const { pesquisador, agenda } = dados;

  return (
    <>
      <Link to="/frequencia" className="mb-2 inline-block text-sm text-sky-700 hover:underline">← Frequência da equipe</Link>
      <Titulo subtitulo={`${pesquisador.numero_usp} · ${pesquisador.modalidade?.nome || 'Sem modalidade'}${pesquisador.orientador ? ` · Orientador(a): ${pesquisador.orientador.nome}` : ''}`}
        acao={<SeletorMes mes={mes} aoMudar={m => setParams({ mes: m })} maximo={mesAtual()} />}>
        {pesquisador.nome}
      </Titulo>

      <ResumoDoMes resumo={dados.resumo} atrasos={dados.atrasos} />

      <div className="grid gap-6 lg:grid-cols-3">
        <Cartao titulo="Registros do mês" className="lg:col-span-2"
          acao={ehAdmin && <Botao tamanho="sm" variante="secundario" onClick={() => setModal({ registro: null })}>Registro manual</Botao>}>
          <Tabela linhas={comDia(dados.registros)} vazio="Nenhum registro neste mês."
            colunas={colunasRegistros(ehAdmin ? (r => (
              <div className="flex justify-end gap-1">
                <Botao variante="fantasma" tamanho="sm" onClick={() => setModal({ registro: r })}>Ajustar</Botao>
                <Botao variante="fantasma" tamanho="sm" className="text-red-600 hover:bg-red-50" onClick={() => excluir(r)}>Excluir</Botao>
              </div>
            )) : null)} />
        </Cartao>
        <Cartao titulo="Agenda semanal">
          <p className="mb-3 text-sm text-slate-600">{horas(agenda.minutosSemanais)} planejadas · mínimo {horas(agenda.minimoSemanal)}</p>
          {agenda.horarios.length === 0 ? <p className="text-sm text-slate-500">Agenda não definida.</p> : (
            <ul className="space-y-1 text-sm">
              {agenda.horarios.map(h => (
                <li key={h.id} className="flex justify-between">
                  <span>{DIAS_SEMANA[h.dia_semana]}</span>
                  <span className="text-slate-600">{h.hora_entrada.slice(0, 5)}–{h.hora_saida.slice(0, 5)} · {TURNOS[h.turno]}</span>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </div>

      <ModalRegistro aberto={Boolean(modal)} registro={modal?.registro} usuarioId={Number(id)} aoFechar={() => setModal(null)} aoSalvar={recarregar} />
    </>
  );
}
