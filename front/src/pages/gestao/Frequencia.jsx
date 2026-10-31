import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../api';
import { useCarregar } from '../../utils/useCarregar';
import { BarraProgresso, Cartao, Carregando, ErroCarga, SeletorMes, Selo, Tabela, Titulo, estiloEntrada } from '../../components/ui';
import { horas, mesAtual, percentual } from '../../utils/formato';

export default function Frequencia() {
  const navegar = useNavigate();
  const [mes, setMes] = useState(mesAtual());
  const [busca, setBusca] = useState('');
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/relatorios/mensal', { params: { mes } }).then(r => r.data), [mes]);

  const linhas = (dados?.linhas || []).filter(l => !busca || `${l.nome} ${l.numero_usp}`.toLowerCase().includes(busca.toLowerCase()));
  return (
    <>
      <Titulo subtitulo={dados?.subtitulo} acao={<SeletorMes mes={mes} aoMudar={setMes} maximo={mesAtual()} />}>Frequência da equipe</Titulo>
      <Cartao acao={null}>
        <input type="search" placeholder="Buscar por nome ou Nº USP" aria-label="Buscar pesquisador" className={`${estiloEntrada} mb-4 max-w-sm`} value={busca} onChange={e => setBusca(e.target.value)} />
        {carregando && !dados ? <Carregando /> : erro ? <ErroCarga mensagem={erro} aoTentar={recarregar} /> : (
          <Tabela chave="usuario_id" linhas={linhas} vazio="Nenhum pesquisador com carga horária neste mês." colunas={[
            { titulo: 'Pesquisador', render: l => (
              <button type="button" className="text-left font-medium text-sky-700 hover:underline" onClick={() => navegar(`/frequencia/${l.usuario_id}?mes=${mes}`)}>
                {l.nome}<span className="block text-xs font-normal text-slate-500">{l.numero_usp}</span>
              </button>
            ) },
            { titulo: 'Modalidade', campo: 'modalidade' },
            { titulo: 'Realizadas', render: l => horas(l.realizados) },
            { titulo: 'Abonadas', render: l => horas(l.abonados) },
            { titulo: 'Exigidas', render: l => horas(l.exigidos) },
            { titulo: 'Cumprimento', classe: 'min-w-40', render: l => (
              <div><span className="text-xs">{percentual(l.percentual)}</span><BarraProgresso valor={l.percentual} rotulo={l.nome} /></div>
            ) },
            { titulo: 'Situação', render: l => l.cumpriu ? <Selo cor="verde">Cumpriu</Selo> : <Selo cor={dados.subtitulo.startsWith('Parcial') ? 'cinza' : 'vermelho'}>Faltam {horas(l.pendentes)}</Selo> },
            { titulo: 'Atrasos', render: l => l.atrasos || '—' }
          ]} />
        )}
      </Cartao>
    </>
  );
}
