import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../contexto/Auth';
import { PERFIS } from '../utils/formato';

const icone = (d) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split('|').map(p => <path key={p} d={p} />)}
  </svg>
);
const ICONES = {
  ponto: icone('M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z|M12 6v6l4 2'),
  historico: icone('M3 3v18h18|M7 15l4-4 3 3 5-6'),
  agenda: icone('M8 2v4|M16 2v4|M3 10h18|M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z'),
  solicitacao: icone('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M9 15l2 2 4-4'),
  painel: icone('M3 3h7v9H3z|M14 3h7v5h-7z|M14 12h7v9h-7z|M3 16h7v5H3z'),
  equipe: icone('M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M23 21v-2a4 4 0 0 0-3-3.87|M16 3.13a4 4 0 0 1 0 7.75'),
  relatorio: icone('M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z|M14 2v6h6|M8 13h8|M8 17h5'),
  usuarios: icone('M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2|M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z|M19 8v6|M22 11h-6'),
  modalidade: icone('M22 10 12 5 2 10l10 5 10-5z|M6 12v5c3 3 9 3 12 0v-5'),
  config: icone('M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'),
  auditoria: icone('M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z|M9 12l2 2 4-4'),
  sino: icone('M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9|M13.73 21a2 2 0 0 1-3.46 0'),
  privacidade: icone('M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z|M7 11V7a5 5 0 0 1 10 0v4')
};

function ItemMenu({ para, icone: ic, children, contador }) {
  return (
    <NavLink to={para} end={para === '/'}
      className={({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-sky-50 text-sky-800' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`}>
      {ICONES[ic]}
      <span className="flex-1">{children}</span>
      {contador > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{contador > 99 ? '99+' : contador}</span>}
    </NavLink>
  );
}

function Grupo({ titulo, children }) {
  return (
    <div className="space-y-1">
      <p className="px-3 pt-4 pb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{titulo}</p>
      {children}
    </div>
  );
}

export default function Layout() {
  const { usuario, sair, ehGestao, ehAdmin, registraPonto } = useAuth();
  const [menuAberto, setMenuAberto] = useState(false);
  const [naoLidas, setNaoLidas] = useState(0);
  const local = useLocation();

  useEffect(() => setMenuAberto(false), [local.pathname]);

  // Atualiza o contador de notificações a cada minuto
  useEffect(() => {
    const buscar = () => api.get('/notificacoes').then(r => setNaoLidas(r.data.naoLidas)).catch(() => {});
    buscar();
    const intervalo = setInterval(buscar, 60000);
    window.addEventListener('notificacoes-lidas', buscar);
    return () => { clearInterval(intervalo); window.removeEventListener('notificacoes-lidas', buscar); };
  }, []);

  const menu = (
    <nav className="flex h-full flex-col px-3 py-4" aria-label="Menu principal">
      <div className="flex items-center gap-2 px-3 pb-2">
        <span className="text-sky-700">{ICONES.ponto}</span>
        <span className="font-bold text-slate-900">Controle de Frequência</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {registraPonto && (
          <Grupo titulo="Minha frequência">
            <ItemMenu para="/" icone="ponto">Registrar ponto</ItemMenu>
            <ItemMenu para="/historico" icone="historico">Histórico</ItemMenu>
            <ItemMenu para="/agenda" icone="agenda">Minha agenda</ItemMenu>
            <ItemMenu para="/minhas-solicitacoes" icone="solicitacao">Minhas solicitações</ItemMenu>
          </Grupo>
        )}
        {ehGestao && (
          <Grupo titulo="Acompanhamento">
            <ItemMenu para="/painel" icone="painel">Painel gerencial</ItemMenu>
            <ItemMenu para="/frequencia" icone="equipe">Frequência da equipe</ItemMenu>
            <ItemMenu para="/solicitacoes" icone="solicitacao">Avaliar solicitações</ItemMenu>
            <ItemMenu para="/relatorios" icone="relatorio">Relatórios</ItemMenu>
          </Grupo>
        )}
        {ehAdmin && (
          <Grupo titulo="Administração">
            <ItemMenu para="/usuarios" icone="usuarios">Pesquisadores e usuários</ItemMenu>
            <ItemMenu para="/modalidades" icone="modalidade">Modalidades</ItemMenu>
            <ItemMenu para="/configuracoes" icone="config">Configurações</ItemMenu>
            <ItemMenu para="/auditoria" icone="auditoria">Auditoria</ItemMenu>
          </Grupo>
        )}
        <Grupo titulo="Conta">
          <ItemMenu para="/notificacoes" icone="sino" contador={naoLidas}>Notificações</ItemMenu>
          <ItemMenu para="/privacidade" icone="privacidade">Privacidade e dados</ItemMenu>
        </Grupo>
      </div>
      <div className="mt-4 border-t border-slate-200 px-3 pt-4">
        <p className="truncate text-sm font-semibold text-slate-800">{usuario.nome}</p>
        <p className="text-xs text-slate-500">{PERFIS[usuario.perfil]}{usuario.modalidade ? ` · ${usuario.modalidade.nome}` : ''}</p>
        <button type="button" onClick={sair} className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
          Sair
        </button>
      </div>
    </nav>
  );

  return (
    <div className="min-h-screen lg:flex">
      <aside className="hidden w-64 shrink-0 border-r border-slate-200 bg-white lg:fixed lg:inset-y-0 lg:block">{menu}</aside>

      {/* Barra superior e menu em gaveta no celular */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setMenuAberto(true)} className="rounded p-1 text-slate-600" aria-label="Abrir menu">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 12h18M3 6h18M3 18h18" /></svg>
        </button>
        <span className="font-bold text-slate-900">Controle de Frequência</span>
        <NavLink to="/notificacoes" className="relative rounded p-1 text-slate-600" aria-label={`Notificações (${naoLidas} não lidas)`}>
          {ICONES.sino}
          {naoLidas > 0 && <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-red-500" />}
        </NavLink>
      </header>
      {menuAberto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setMenuAberto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">{menu}</aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:ml-64 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl"><Outlet /></div>
      </main>
    </div>
  );
}
