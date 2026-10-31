import { useEffect, useId, useRef } from 'react';

const VARIANTES = {
  primario: 'bg-sky-700 text-white hover:bg-sky-800 disabled:bg-sky-300',
  secundario: 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 disabled:text-slate-400',
  perigo: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  sucesso: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300',
  fantasma: 'text-sky-700 hover:bg-sky-50 disabled:text-slate-400'
};

export function Botao({ variante = 'primario', tamanho = 'md', carregando, className = '', children, ...props }) {
  const tamanhos = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' };
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || carregando}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed ${VARIANTES[variante]} ${tamanhos[tamanho]} ${className}`}
    >
      {carregando && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />}
      {children}
    </button>
  );
}

export function Cartao({ titulo, acao, className = '', children }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>
      {(titulo || acao) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          {titulo && <h2 className="font-semibold text-slate-800">{titulo}</h2>}
          {acao}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const CORES = {
  cinza: 'bg-slate-100 text-slate-700',
  verde: 'bg-emerald-100 text-emerald-800',
  vermelho: 'bg-red-100 text-red-800',
  amarelo: 'bg-amber-100 text-amber-800',
  azul: 'bg-sky-100 text-sky-800'
};

export function Selo({ cor = 'cinza', children }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${CORES[cor]}`}>{children}</span>;
}

// Indicador numérico usado nos painéis
export function Indicador({ rotulo, valor, detalhe, cor = 'text-slate-900' }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-sm text-slate-500">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-xs text-slate-500">{detalhe}</p>}
    </div>
  );
}

export function BarraProgresso({ valor, rotulo }) {
  const limitado = Math.max(0, Math.min(100, valor || 0));
  const cor = valor >= 100 ? 'bg-emerald-500' : valor >= 75 ? 'bg-sky-600' : valor >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div role="progressbar" aria-valuenow={Math.round(limitado)} aria-valuemin={0} aria-valuemax={100} aria-label={rotulo}
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full transition-all ${cor}`} style={{ width: `${limitado}%` }} />
    </div>
  );
}

export function Campo({ rotulo, ajuda, erro, children, className = '' }) {
  const id = useId();
  const filho = typeof children === 'function' ? children(id) : children;
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</label>
      {filho}
      {ajuda && !erro && <p className="mt-1 text-xs text-slate-500">{ajuda}</p>}
      {erro && <p className="mt-1 text-xs text-red-600">{erro}</p>}
    </div>
  );
}

const estiloBaseEntrada = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-200 focus:outline-none disabled:bg-slate-100';
export const estiloEntrada = `w-full ${estiloBaseEntrada}`;
export const estiloEntradaCompacta = `w-auto ${estiloBaseEntrada}`;

export function Modal({ aberto, aoFechar, titulo, children, rodape, largura = 'max-w-lg' }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!aberto) return;
    const tecla = (e) => e.key === 'Escape' && aoFechar();
    document.addEventListener('keydown', tecla);
    ref.current?.querySelector('input, select, textarea, button')?.focus();
    return () => document.removeEventListener('keydown', tecla);
  }, [aberto, aoFechar]);

  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4" onMouseDown={aoFechar}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={titulo}
        className={`flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-xl sm:rounded-2xl ${largura}`}
        onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-semibold">{titulo}</h2>
          <button type="button" onClick={aoFechar} className="rounded p-1 text-slate-400 hover:text-slate-600" aria-label="Fechar">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-3">{rodape}</footer>}
      </div>
    </div>
  );
}

export function Carregando({ texto = 'Carregando...' }) {
  return (
    <div className="flex items-center justify-center gap-3 py-12 text-slate-500" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-sky-600 border-t-transparent" aria-hidden />
      {texto}
    </div>
  );
}

export function Vazio({ titulo, children }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center">
      <p className="font-medium text-slate-700">{titulo}</p>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  );
}

export function ErroCarga({ mensagem, aoTentar }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-6 text-center text-sm text-red-700" role="alert">
      <p>{mensagem}</p>
      {aoTentar && <Botao variante="secundario" tamanho="sm" className="mt-3" onClick={aoTentar}>Tentar novamente</Botao>}
    </div>
  );
}

// Tabela responsiva: rola na horizontal em telas pequenas
export function Tabela({ colunas, linhas, chave = 'id', vazio = 'Nenhum registro encontrado.' }) {
  if (!linhas.length) return <Vazio titulo={vazio} />;
  return (
    <div className="-mx-5 overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
            {colunas.map(c => <th key={c.titulo} className={`px-5 py-2 font-semibold ${c.classe || ''}`}>{c.titulo}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {linhas.map((linha, i) => (
            <tr key={linha[chave] ?? i} className="hover:bg-slate-50">
              {colunas.map(c => <td key={c.titulo} className={`px-5 py-2.5 ${c.classe || ''}`}>{c.render ? c.render(linha) : linha[c.campo]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Titulo({ children, subtitulo, acao }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{children}</h1>
        {subtitulo && <p className="mt-1 text-sm text-slate-500">{subtitulo}</p>}
      </div>
      {acao}
    </div>
  );
}

// Navegação entre meses: ‹ Outubro de 2026 ›
export function SeletorMes({ mes, aoMudar, maximo }) {
  const [a, m] = mes.split('-').map(Number);
  const mudar = (delta) => {
    const d = new Date(Date.UTC(a, m - 1 + delta, 1));
    aoMudar(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  };
  const texto = new Date(Date.UTC(a, m - 1, 15)).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const rotulo = texto.charAt(0).toUpperCase() + texto.slice(1);
  return (
    <div className="inline-flex items-center rounded-lg border border-slate-300 bg-white">
      <button type="button" onClick={() => mudar(-1)} className="px-3 py-2 text-slate-600 hover:bg-slate-50" aria-label="Mês anterior">‹</button>
      <span className="min-w-36 px-2 text-center text-sm font-medium">{rotulo}</span>
      <button type="button" onClick={() => mudar(1)} disabled={maximo && mes >= maximo}
        className="px-3 py-2 text-slate-600 hover:bg-slate-50 disabled:text-slate-300" aria-label="Próximo mês">›</button>
    </div>
  );
}
