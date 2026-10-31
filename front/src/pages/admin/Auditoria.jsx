import { useState } from 'react';
import api from '../../api';
import { useCarregar } from '../../utils/useCarregar';
import { Botao, Cartao, Carregando, ErroCarga, Modal, Tabela, Titulo, estiloEntrada } from '../../components/ui';
import { dataHora } from '../../utils/formato';

const rotuloAcao = (acao) => acao.toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());

export default function Auditoria() {
  const [filtros, setFiltros] = useState({ acao: '', de: '', ate: '', pagina: 1 });
  const [detalhe, setDetalhe] = useState(null);
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/auditoria', { params: filtros }).then(r => r.data), [JSON.stringify(filtros)]);

  const muda = (campo) => (e) => setFiltros(f => ({ ...f, [campo]: e.target.value, pagina: 1 }));
  return (
    <>
      <Titulo subtitulo="Histórico de acessos, alterações de registros, ajustes manuais, aprovações e demais operações.">Auditoria</Titulo>
      <Cartao>
        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <select aria-label="Ação" className={estiloEntrada} value={filtros.acao} onChange={muda('acao')}>
            <option value="">Todas as ações</option>
            {dados?.acoes.map(a => <option key={a} value={a}>{rotuloAcao(a)}</option>)}
          </select>
          <input type="date" aria-label="De" className={estiloEntrada} value={filtros.de} onChange={muda('de')} />
          <input type="date" aria-label="Até" className={estiloEntrada} value={filtros.ate} onChange={muda('ate')} />
        </div>
        {carregando && !dados ? <Carregando /> : erro ? <ErroCarga mensagem={erro} aoTentar={recarregar} /> : (
          <>
            <Tabela linhas={dados.registros} colunas={[
              { titulo: 'Data', render: r => <span className="whitespace-nowrap">{dataHora(r.created_at)}</span> },
              { titulo: 'Usuário', render: r => r.usuario ? `${r.usuario.nome} (${r.usuario.numero_usp})` : 'Sistema' },
              { titulo: 'Ação', render: r => rotuloAcao(r.acao) },
              { titulo: 'Objeto', render: r => r.entidade ? `${r.entidade}${r.entidade_id ? ` nº ${r.entidade_id}` : ''}` : '—' },
              { titulo: 'IP', render: r => <span className="text-xs text-slate-500">{r.ip || '—'}</span> },
              { titulo: '', classe: 'text-right', render: r => (r.dados_antes || r.dados_depois) && <Botao variante="fantasma" tamanho="sm" onClick={() => setDetalhe(r)}>Detalhes</Botao> }
            ]} />
            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <span>{dados.total} registro(s)</span>
              <div className="flex items-center gap-2">
                <Botao variante="secundario" tamanho="sm" disabled={dados.pagina <= 1} onClick={() => setFiltros(f => ({ ...f, pagina: f.pagina - 1 }))}>Anterior</Botao>
                <span>Página {dados.pagina} de {dados.paginas}</span>
                <Botao variante="secundario" tamanho="sm" disabled={dados.pagina >= dados.paginas} onClick={() => setFiltros(f => ({ ...f, pagina: f.pagina + 1 }))}>Próxima</Botao>
              </div>
            </div>
          </>
        )}
      </Cartao>
      <Modal aberto={Boolean(detalhe)} aoFechar={() => setDetalhe(null)} titulo={detalhe ? rotuloAcao(detalhe.acao) : ''} largura="max-w-3xl">
        {detalhe && (
          <div className="grid gap-4 md:grid-cols-2">
            {[['Antes', detalhe.dados_antes], ['Depois', detalhe.dados_depois]].map(([t, d]) => (
              <div key={t}>
                <p className="mb-1 text-sm font-semibold">{t}</p>
                <pre className="max-h-96 overflow-auto rounded-lg bg-slate-50 p-3 text-xs">{d ? JSON.stringify(d, null, 2) : '—'}</pre>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </>
  );
}
