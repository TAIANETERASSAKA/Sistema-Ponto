import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api, { baixarArquivo, mensagemErro } from '../../api';
import { useAuth } from '../../contexto/Auth';
import { useAviso } from '../../contexto/Aviso';
import { useCarregar } from '../../utils/useCarregar';
import { Botao, Cartao, Carregando, ErroCarga, SeletorMes, Tabela, Titulo, estiloEntradaCompacta } from '../../components/ui';
import { dataHora, hojeChave, horas, mesAtual, nomeMes, percentual, somarMes } from '../../utils/formato';

const TIPOS = [
  { chave: 'mensal', rotulo: 'Mensal', url: '/relatorios/mensal' },
  { chave: 'dia', rotulo: 'Diário', url: '/relatorios/frequencia' },
  { chave: 'semana', rotulo: 'Semanal', url: '/relatorios/frequencia' },
  { chave: 'modalidades', rotulo: 'Por modalidade', url: '/relatorios/modalidades' },
  { chave: 'evolucao', rotulo: 'Evolução mensal', url: '/relatorios/evolucao' }
];

const formatar = (valor, tipo) => {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (tipo === 'horas') return horas(valor);
  if (tipo === 'percentual') return percentual(valor);
  if (tipo === 'booleano') return valor ? 'Sim' : 'Não';
  return valor;
};

// Fechamento mensal manual (RN03) — somente administrador
function Fechamentos() {
  const avisar = useAviso();
  const [mes, setMes] = useState(somarMes(mesAtual(), -1));
  const [enviando, setEnviando] = useState(false);
  const { dados, recarregar } = useCarregar(() => api.get('/relatorios/fechamentos').then(r => r.data.fechamentos));

  const fechar = async () => {
    const existe = dados?.some(f => f.mes === mes);
    if (existe && !window.confirm(`${nomeMes(mes)} já foi fechado. Reprocessar com os dados atuais?`)) return;
    setEnviando(true);
    try {
      await api.post('/relatorios/fechamentos', { mes });
      avisar(`Fechamento de ${nomeMes(mes)} ${existe ? 'reprocessado' : 'gerado'}.`);
      recarregar();
    } catch (e) {
      avisar(mensagemErro(e), 'erro');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Cartao titulo="Fechamentos mensais" className="mt-6">
      <p className="mb-4 text-sm text-slate-600">
        O sistema fecha automaticamente o mês anterior no dia 1º. Reprocesse um mês se aprovar justificativas ou ajustes depois do fechamento.
      </p>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SeletorMes mes={mes} aoMudar={setMes} maximo={somarMes(mesAtual(), -1)} />
        <Botao variante="secundario" carregando={enviando} onClick={fechar}>Fechar / reprocessar mês</Botao>
      </div>
      {dados && (
        <Tabela linhas={dados} vazio="Nenhum mês fechado ainda." colunas={[
          { titulo: 'Mês', render: f => nomeMes(f.mes) },
          { titulo: 'Cumpriram', render: f => `${f.total_cumpriram} de ${f.total_pesquisadores}` },
          { titulo: 'Gerado', render: f => `${dataHora(f.updated_at)} · ${f.gerado_por_id ? 'manual' : 'automático'}` }
        ]} />
      )}
    </Cartao>
  );
}

export default function Relatorios() {
  const { ehAdmin } = useAuth();
  const avisar = useAviso();
  const [params] = useSearchParams();
  const [tipo, setTipo] = useState('mensal');
  const [mes, setMes] = useState(params.get('mes') || mesAtual());
  const [data, setData] = useState(hojeChave());
  const [situacao, setSituacao] = useState('');
  const [baixando, setBaixando] = useState(null);

  const atual = TIPOS.find(t => t.chave === tipo);
  const filtros = (() => {
    if (tipo === 'mensal') return { mes, ...(situacao && { situacao }) };
    if (tipo === 'dia' || tipo === 'semana') return { periodo: tipo, data };
    if (tipo === 'modalidades') return { mes };
    return { meses: 12 };
  })();
  const chaveFiltros = JSON.stringify(filtros);

  const { dados, carregando, erro, recarregar } = useCarregar(
    () => api.get(atual.url, { params: filtros }).then(r => r.data), [tipo, chaveFiltros]);

  const exportar = async (formato) => {
    setBaixando(formato);
    try {
      await baixarArquivo(atual.url, { ...filtros, formato });
    } catch (e) {
      avisar(mensagemErro(e, 'Não foi possível gerar o arquivo.'), 'erro');
    } finally {
      setBaixando(null);
    }
  };

  return (
    <>
      <Titulo subtitulo="Relatórios operacionais e gerenciais, com exportação em PDF, Excel e CSV.">Relatórios</Titulo>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {TIPOS.map(t => (
          <button key={t.chave} type="button" role="tab" aria-selected={tipo === t.chave} onClick={() => setTipo(t.chave)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${tipo === t.chave ? 'bg-sky-700 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {t.rotulo}
          </button>
        ))}
      </div>

      <Cartao titulo={dados?.titulo || atual.rotulo} acao={
        <div className="flex flex-wrap gap-2">
          {['pdf', 'xlsx', 'csv'].map(f => (
            <Botao key={f} variante="secundario" tamanho="sm" carregando={baixando === f} disabled={!dados} onClick={() => exportar(f)}>
              {f === 'xlsx' ? 'Excel' : f.toUpperCase()}
            </Botao>
          ))}
        </div>
      }>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          {(tipo === 'mensal' || tipo === 'modalidades') && <SeletorMes mes={mes} aoMudar={setMes} maximo={mesAtual()} />}
          {(tipo === 'dia' || tipo === 'semana') && (
            <input type="date" aria-label="Data" max={hojeChave()} className={estiloEntradaCompacta} value={data} onChange={e => e.target.value && setData(e.target.value)} />
          )}
          {tipo === 'mensal' && (
            <select aria-label="Situação" className={estiloEntradaCompacta} value={situacao} onChange={e => setSituacao(e.target.value)}>
              <option value="">Todos os pesquisadores</option>
              <option value="cumpriu">Cumpriram a carga</option>
              <option value="nao_cumpriu">Não cumpriram (inadimplentes)</option>
            </select>
          )}
          {dados?.subtitulo && <span className="text-sm text-slate-500">{dados.subtitulo}</span>}
        </div>

        {dados?.resumo?.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {dados.resumo.map(r => <span key={r.rotulo}><span className="text-slate-500">{r.rotulo}:</span> <strong>{r.valor}</strong></span>)}
          </div>
        )}

        {carregando && !dados ? <Carregando /> : erro ? <ErroCarga mensagem={erro} aoTentar={recarregar} /> : (
          <Tabela chave="__i" linhas={dados.linhas.map((l, i) => ({ ...l, __i: i }))} vazio="Nenhum dado para o período."
            colunas={dados.colunas.map(c => ({ titulo: c.titulo, render: l => formatar(l[c.chave], c.tipo) }))} />
        )}
      </Cartao>

      {ehAdmin && <Fechamentos />}
    </>
  );
}
