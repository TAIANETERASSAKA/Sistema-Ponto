import { useEffect, useState } from 'react';
import api, { mensagemErro } from '../../api';
import { useAviso } from '../../contexto/Aviso';
import { useCarregar } from '../../utils/useCarregar';
import { Botao, Campo, Cartao, Carregando, ErroCarga, Modal, Selo, Tabela, Titulo, estiloEntrada } from '../../components/ui';

const VAZIO = { nome: '', horas_semanais: '', horas_mensais: '', regras: '', ativo: true };

export default function Modalidades() {
  const avisar = useAviso();
  const [editando, setEditando] = useState(undefined);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);
  const { dados, carregando, erro: erroCarga, recarregar } = useCarregar(() => api.get('/modalidades').then(r => r.data.modalidades));

  useEffect(() => {
    if (editando === undefined) return;
    setErro(null);
    setForm(editando ? { ...VAZIO, ...editando, regras: editando.regras || '' } : VAZIO);
  }, [editando]);

  const muda = (campo) => (e) => {
    const valor = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm(f => {
      const novo = { ...f, [campo]: valor };
      // Sugere a carga mensal (4 semanas) enquanto o campo não foi editado
      if (campo === 'horas_semanais' && (!f.horas_mensais || Number(f.horas_mensais) === Number(f.horas_semanais) * 4)) {
        novo.horas_mensais = valor ? String(Number(valor) * 4) : '';
      }
      return novo;
    });
  };

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    try {
      if (editando) await api.put(`/modalidades/${editando.id}`, form);
      else await api.post('/modalidades', form);
      avisar('Modalidade salva.');
      setEditando(undefined);
      recarregar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (m) => {
    if (!window.confirm(`Excluir a modalidade "${m.nome}"?`)) return;
    try {
      await api.delete(`/modalidades/${m.id}`);
      avisar('Modalidade excluída.');
      recarregar();
    } catch (e) {
      avisar(mensagemErro(e), 'erro');
    }
  };

  return (
    <>
      <Titulo subtitulo="Carga horária mínima exigida de cada modalidade acadêmica."
        acao={<Botao onClick={() => setEditando(null)}>Nova modalidade</Botao>}>
        Modalidades
      </Titulo>
      <Cartao>
        {carregando && !dados ? <Carregando /> : erroCarga ? <ErroCarga mensagem={erroCarga} aoTentar={recarregar} /> : (
          <Tabela linhas={dados} colunas={[
            { titulo: 'Modalidade', render: m => <span className="font-medium">{m.nome}</span> },
            { titulo: 'Horas semanais', render: m => `${m.horas_semanais}h` },
            { titulo: 'Horas mensais', render: m => `${m.horas_mensais}h` },
            { titulo: 'Regras específicas', classe: 'max-w-sm', render: m => <span className="line-clamp-2 text-xs text-slate-500">{m.regras || '—'}</span> },
            { titulo: 'Situação', render: m => m.ativo ? <Selo cor="verde">Ativa</Selo> : <Selo>Inativa</Selo> },
            { titulo: '', classe: 'text-right whitespace-nowrap', render: m => <>
              <Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(m)}>Editar</Botao>
              <Botao variante="fantasma" tamanho="sm" className="text-red-600 hover:bg-red-50" onClick={() => excluir(m)}>Excluir</Botao>
            </> }
          ]} />
        )}
      </Cartao>

      <Modal aberto={editando !== undefined} aoFechar={() => setEditando(undefined)} titulo={editando ? 'Editar modalidade' : 'Nova modalidade'}
        rodape={<><Botao variante="secundario" onClick={() => setEditando(undefined)}>Cancelar</Botao><Botao type="submit" form="form-modalidade" carregando={salvando}>Salvar</Botao></>}>
        <form id="form-modalidade" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome" className="sm:col-span-2">{id => <input id={id} required className={estiloEntrada} value={form.nome} onChange={muda('nome')} />}</Campo>
          <Campo rotulo="Horas semanais mínimas">{id => <input id={id} type="number" required min="0.5" max="168" step="0.5" className={estiloEntrada} value={form.horas_semanais} onChange={muda('horas_semanais')} />}</Campo>
          <Campo rotulo="Horas mensais mínimas">{id => <input id={id} type="number" required min="1" max="744" step="0.5" className={estiloEntrada} value={form.horas_mensais} onChange={muda('horas_mensais')} />}</Campo>
          <Campo rotulo="Regras específicas (opcional)" className="sm:col-span-2">{id => <textarea id={id} rows={3} className={estiloEntrada} value={form.regras} onChange={muda('regras')} />}</Campo>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.ativo} onChange={muda('ativo')} className="h-4 w-4 rounded border-slate-300" /> Ativa (disponível para novos cadastros)
          </label>
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2" role="alert">{erro}</p>}
        </form>
      </Modal>
    </>
  );
}
