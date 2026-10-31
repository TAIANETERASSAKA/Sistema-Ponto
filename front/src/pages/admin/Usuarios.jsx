import { useEffect, useState } from 'react';
import api, { mensagemErro } from '../../api';
import { useAviso } from '../../contexto/Aviso';
import { useCarregar } from '../../utils/useCarregar';
import { Botao, Campo, Cartao, Carregando, ErroCarga, Modal, Selo, Tabela, Titulo, estiloEntrada } from '../../components/ui';
import { PERFIS, dataBr, hojeChave } from '../../utils/formato';

const VAZIO = { nome: '', email: '', telefone: '', numero_usp: '', perfil: 'PESQUISADOR', data_ingresso: '', modalidade_id: '', orientador_id: '', ativo: true };

// RF01 — cadastro de pesquisadores e demais usuários
function FormUsuario({ aberto, aoFechar, usuarioId, modalidades, orientadores, aoSalvar }) {
  const avisar = useAviso();
  const [form, setForm] = useState(VAZIO);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!aberto) return;
    setErro(null);
    if (!usuarioId) return setForm(VAZIO);
    setCarregando(true);
    api.get(`/usuarios/${usuarioId}`)
      .then(({ data }) => setForm({ ...VAZIO, ...data.usuario, telefone: data.usuario.telefone || '', data_ingresso: data.usuario.data_ingresso || '', modalidade_id: data.usuario.modalidade_id || '', orientador_id: data.usuario.orientador_id || '' }))
      .catch(e => setErro(mensagemErro(e)))
      .finally(() => setCarregando(false));
  }, [aberto, usuarioId]);

  const muda = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const ehPesquisador = form.perfil === 'PESQUISADOR';

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    setErro(null);
    const corpo = { ...form, modalidade_id: form.modalidade_id || null, orientador_id: form.orientador_id || null, data_ingresso: form.data_ingresso || null };
    try {
      if (usuarioId) await api.put(`/usuarios/${usuarioId}`, corpo);
      else await api.post('/usuarios', corpo);
      avisar(usuarioId ? 'Cadastro atualizado.' : 'Usuário cadastrado. Ele já pode entrar com a Senha Única USP.');
      aoSalvar();
      aoFechar();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} largura="max-w-2xl" titulo={usuarioId ? 'Editar cadastro' : 'Novo cadastro'}
      rodape={<><Botao variante="secundario" onClick={aoFechar}>Cancelar</Botao><Botao type="submit" form="form-usuario" carregando={salvando} disabled={carregando}>Salvar</Botao></>}>
      {carregando ? <Carregando /> : (
        <form id="form-usuario" onSubmit={salvar} className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Nome completo" className="sm:col-span-2">{id => <input id={id} required className={estiloEntrada} value={form.nome} onChange={muda('nome')} />}</Campo>
          <Campo rotulo="Número USP">{id => <input id={id} required inputMode="numeric" pattern="\d{3,12}" className={estiloEntrada} value={form.numero_usp} onChange={muda('numero_usp')} />}</Campo>
          <Campo rotulo="Perfil">
            {id => <select id={id} className={estiloEntrada} value={form.perfil} onChange={muda('perfil')}>
              {Object.entries(PERFIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>}
          </Campo>
          <Campo rotulo="E-mail">{id => <input id={id} type="email" required className={estiloEntrada} value={form.email} onChange={muda('email')} />}</Campo>
          <Campo rotulo="Telefone" ajuda="Armazenado criptografado.">{id => <input id={id} type="tel" className={estiloEntrada} value={form.telefone} onChange={muda('telefone')} />}</Campo>
          <Campo rotulo={`Modalidade acadêmica${ehPesquisador ? '' : ' (opcional)'}`}>
            {id => <select id={id} required={ehPesquisador} className={estiloEntrada} value={form.modalidade_id} onChange={muda('modalidade_id')}>
              <option value="">Selecione</option>
              {modalidades.filter(m => m.ativo || m.id === Number(form.modalidade_id)).map(m => <option key={m.id} value={m.id}>{m.nome} ({m.horas_semanais}h semanais)</option>)}
            </select>}
          </Campo>
          <Campo rotulo={`Data de ingresso${ehPesquisador ? '' : ' (opcional)'}`}>{id => <input id={id} type="date" required={ehPesquisador} max={hojeChave()} className={estiloEntrada} value={form.data_ingresso} onChange={muda('data_ingresso')} />}</Campo>
          <Campo rotulo="Orientador / supervisor" className="sm:col-span-2">
            {id => <select id={id} className={estiloEntrada} value={form.orientador_id} onChange={muda('orientador_id')}>
              <option value="">Nenhum</option>
              {orientadores.filter(o => o.id !== usuarioId).map(o => <option key={o.id} value={o.id}>{o.nome}</option>)}
            </select>}
          </Campo>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={form.ativo} onChange={muda('ativo')} className="h-4 w-4 rounded border-slate-300" />
            Ativo (pode acessar o sistema e registrar ponto)
          </label>
          {!ehPesquisador && form.modalidade_id && (
            <p className="text-xs text-slate-500 sm:col-span-2">Com modalidade definida, este usuário também poderá registrar o próprio ponto.</p>
          )}
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 sm:col-span-2" role="alert">{erro}</p>}
        </form>
      )}
    </Modal>
  );
}

export default function Usuarios() {
  const [filtros, setFiltros] = useState({ busca: '', perfil: '', ativo: 'true' });
  const [editando, setEditando] = useState(undefined); // undefined = fechado, null = novo
  const { dados, carregando, erro, recarregar } = useCarregar(() => Promise.all([
    api.get('/usuarios', { params: filtros }), api.get('/modalidades'), api.get('/usuarios', { params: { ativo: 'true' } })
  ]).then(([u, m, todos]) => ({
    usuarios: u.data.usuarios,
    modalidades: m.data.modalidades,
    orientadores: todos.data.usuarios.filter(x => x.perfil !== 'PESQUISADOR')
  })), [JSON.stringify(filtros)]);

  const muda = (campo) => (e) => setFiltros(f => ({ ...f, [campo]: e.target.value }));
  return (
    <>
      <Titulo subtitulo="Somente pessoas cadastradas aqui conseguem entrar com a Senha Única USP."
        acao={<Botao onClick={() => setEditando(null)}>Novo cadastro</Botao>}>
        Pesquisadores e usuários
      </Titulo>
      <Cartao>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <input type="search" placeholder="Buscar por nome ou Nº USP" aria-label="Buscar" className={estiloEntrada} value={filtros.busca} onChange={muda('busca')} />
          <select aria-label="Perfil" className={estiloEntrada} value={filtros.perfil} onChange={muda('perfil')}>
            <option value="">Todos os perfis</option>
            {Object.entries(PERFIS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select aria-label="Situação" className={estiloEntrada} value={filtros.ativo} onChange={muda('ativo')}>
            <option value="true">Ativos</option><option value="false">Inativos</option><option value="">Todos</option>
          </select>
        </div>
        {carregando && !dados ? <Carregando /> : erro ? <ErroCarga mensagem={erro} aoTentar={recarregar} /> : (
          <Tabela linhas={dados.usuarios} colunas={[
            { titulo: 'Nome', render: u => <><span className="font-medium">{u.nome}</span><span className="block text-xs text-slate-500">{u.email}</span></> },
            { titulo: 'Nº USP', campo: 'numero_usp' },
            { titulo: 'Perfil', render: u => <Selo cor={u.perfil === 'PESQUISADOR' ? 'cinza' : 'azul'}>{PERFIS[u.perfil]}</Selo> },
            { titulo: 'Modalidade', render: u => u.modalidade?.nome || '—' },
            { titulo: 'Orientador', render: u => u.orientador?.nome || '—' },
            { titulo: 'Ingresso', render: u => dataBr(u.data_ingresso) },
            { titulo: 'Situação', render: u => u.ativo ? <Selo cor="verde">Ativo</Selo> : <Selo cor="vermelho">Inativo</Selo> },
            { titulo: '', classe: 'text-right', render: u => <Botao variante="fantasma" tamanho="sm" onClick={() => setEditando(u.id)}>Editar</Botao> }
          ]} />
        )}
      </Cartao>
      {dados && (
        <FormUsuario aberto={editando !== undefined} usuarioId={editando} modalidades={dados.modalidades} orientadores={dados.orientadores}
          aoFechar={() => setEditando(undefined)} aoSalvar={recarregar} />
      )}
    </>
  );
}
