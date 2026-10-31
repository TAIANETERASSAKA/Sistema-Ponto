import { useNavigate } from 'react-router-dom';
import api from '../api';
import { useCarregar } from '../utils/useCarregar';
import { Botao, Carregando, ErroCarga, Titulo, Vazio } from '../components/ui';
import { dataHora } from '../utils/formato';

export default function Notificacoes() {
  const navegar = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/notificacoes').then(r => r.data));

  const avisarMenu = () => window.dispatchEvent(new Event('notificacoes-lidas'));
  const marcarTodas = async () => {
    await api.post('/notificacoes/lidas');
    await recarregar();
    avisarMenu();
  };
  const abrir = async (n) => {
    if (!n.lida) {
      await api.post(`/notificacoes/${n.id}/lida`);
      avisarMenu();
    }
    if (n.link) navegar(n.link);
    else recarregar();
  };

  return (
    <>
      <Titulo acao={dados?.naoLidas > 0 && <Botao variante="secundario" onClick={marcarTodas}>Marcar todas como lidas</Botao>}>
        Notificações
      </Titulo>
      {carregando && !dados ? <Carregando /> : erro ? <ErroCarga mensagem={erro} aoTentar={recarregar} /> : dados.notificacoes.length === 0 ? (
        <Vazio titulo="Nenhuma notificação por enquanto." />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {dados.notificacoes.map(n => (
            <li key={n.id}>
              <button type="button" onClick={() => abrir(n)} className={`flex w-full gap-3 px-5 py-4 text-left hover:bg-slate-50 ${n.lida ? '' : 'bg-sky-50/50'}`}>
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.lida ? 'bg-transparent' : 'bg-sky-600'}`} aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className={`block ${n.lida ? 'text-slate-700' : 'font-semibold text-slate-900'}`}>{n.titulo}</span>
                  <span className="mt-0.5 block text-sm text-slate-600">{n.mensagem}</span>
                  <span className="mt-1 block text-xs text-slate-400">{dataHora(n.created_at)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
