import { useEffect, useState } from 'react';
import api, { mensagemErro } from '../api';
import { useAviso } from '../contexto/Aviso';
import { useCarregar } from '../utils/useCarregar';
import { BarraProgresso, Botao, Cartao, Carregando, ErroCarga, Titulo, Vazio, estiloEntrada } from '../components/ui';
import { DIAS_SEMANA, TURNOS, horas } from '../utils/formato';

const paraMinutos = (h) => {
  if (!/^\d{2}:\d{2}$/.test(h || '')) return null;
  const [a, b] = h.split(':').map(Number);
  return a * 60 + b;
};

// Sugere o turno a partir do horário
function sugerirTurno(entrada, saida) {
  const e = paraMinutos(entrada), s = paraMinutos(saida);
  if (e === null || s === null) return 'MANHA';
  if (s - e >= 7 * 60) return 'INTEGRAL';
  if (e < 12 * 60) return 'MANHA';
  if (e < 18 * 60) return 'TARDE';
  return 'NOITE';
}

const duracao = (h) => {
  const e = paraMinutos(h.hora_entrada), s = paraMinutos(h.hora_saida);
  return e === null || s === null || s <= e ? 0 : Math.max(0, s - e - Number(h.intervalo_minutos || 0));
};

const novoHorario = (dia = 1) => ({ dia_semana: dia, hora_entrada: '08:00', hora_saida: '12:00', intervalo_minutos: 0, turno: 'MANHA' });

export default function Agenda() {
  const avisar = useAviso();
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/horarios/minha').then(r => r.data));
  const [horarios, setHorarios] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState(null);

  useEffect(() => {
    if (dados) setHorarios(dados.horarios.map(h => ({ ...h, hora_entrada: h.hora_entrada.slice(0, 5), hora_saida: h.hora_saida.slice(0, 5) })));
  }, [dados]);

  const alterar = (i, campo, valor) => setHorarios(lista => lista.map((h, j) => {
    if (j !== i) return h;
    const novo = { ...h, [campo]: valor };
    if (campo === 'hora_entrada' || campo === 'hora_saida') novo.turno = sugerirTurno(novo.hora_entrada, novo.hora_saida);
    return novo;
  }));

  // Copia o primeiro horário para os dias úteis que ainda não têm horário
  const repetirDiasUteis = () => {
    const base = horarios[0];
    const existentes = new Set(horarios.map(h => Number(h.dia_semana)));
    setHorarios([...horarios, ...[1, 2, 3, 4, 5].filter(d => !existentes.has(d)).map(d => ({ ...base, id: undefined, dia_semana: d }))]
      .sort((a, b) => a.dia_semana - b.dia_semana || a.hora_entrada.localeCompare(b.hora_entrada)));
  };

  const salvar = async () => {
    setSalvando(true);
    setErroSalvar(null);
    try {
      await api.put('/horarios/minha', { horarios: horarios.map(h => ({ ...h, dia_semana: Number(h.dia_semana), intervalo_minutos: Number(h.intervalo_minutos || 0) })) });
      avisar('Agenda semanal salva.');
      recarregar();
    } catch (e) {
      setErroSalvar(mensagemErro(e));
    } finally {
      setSalvando(false);
    }
  };

  if (carregando && !dados) return <Carregando />;
  if (erro) return <ErroCarga mensagem={erro} aoTentar={recarregar} />;

  const total = horarios.reduce((s, h) => s + duracao(h), 0);
  const minimo = dados.minimoSemanal;
  return (
    <>
      <Titulo subtitulo="Informe os dias e horários em que você trabalha no laboratório. A jornada precisa atender ao mínimo da sua modalidade.">
        Minha agenda semanal
      </Titulo>

      <Cartao className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-sm text-slate-500">Jornada planejada</p>
            <p className="text-2xl font-bold">{horas(total)} <span className="text-base font-normal text-slate-500">de {horas(minimo)} mínimas ({dados.modalidade?.nome})</span></p>
          </div>
          <p className={`text-sm font-medium ${total >= minimo ? 'text-emerald-700' : 'text-red-600'}`}>
            {total >= minimo ? 'Atende ao mínimo da modalidade' : `Faltam ${horas(minimo - total)} para o mínimo`}
          </p>
        </div>
        <div className="mt-3"><BarraProgresso valor={minimo ? (total / minimo) * 100 : 100} rotulo="Jornada planejada" /></div>
      </Cartao>

      <Cartao titulo="Horários" acao={
        <div className="flex flex-wrap gap-2">
          {horarios.length > 0 && <Botao variante="secundario" tamanho="sm" onClick={repetirDiasUteis}>Repetir o 1º horário de segunda a sexta</Botao>}
          <Botao variante="secundario" tamanho="sm" onClick={() => setHorarios([...horarios, novoHorario(horarios.length ? Math.min(6, Number(horarios[horarios.length - 1].dia_semana) + 1) : 1)])}>Adicionar horário</Botao>
        </div>
      }>
        {horarios.length === 0 ? <Vazio titulo="Nenhum horário definido">Adicione os horários em que você trabalha.</Vazio> : (
          <div className="space-y-3">
            {horarios.map((h, i) => (
              <div key={i} className="grid grid-cols-2 items-end gap-3 rounded-lg border border-slate-200 p-3 sm:grid-cols-6">
                <label className="col-span-2 text-xs font-medium text-slate-600 sm:col-span-1">Dia
                  <select className={`${estiloEntrada} mt-1`} value={h.dia_semana} onChange={e => alterar(i, 'dia_semana', e.target.value)}>
                    {DIAS_SEMANA.map((d, n) => <option key={d} value={n}>{d}</option>)}
                  </select>
                </label>
                <label className="text-xs font-medium text-slate-600">Entrada
                  <input type="time" className={`${estiloEntrada} mt-1`} value={h.hora_entrada} onChange={e => alterar(i, 'hora_entrada', e.target.value)} />
                </label>
                <label className="text-xs font-medium text-slate-600">Saída
                  <input type="time" className={`${estiloEntrada} mt-1`} value={h.hora_saida} onChange={e => alterar(i, 'hora_saida', e.target.value)} />
                </label>
                <label className="text-xs font-medium text-slate-600">Intervalo (min)
                  <input type="number" min="0" step="5" className={`${estiloEntrada} mt-1`} value={h.intervalo_minutos} onChange={e => alterar(i, 'intervalo_minutos', e.target.value)} />
                </label>
                <label className="text-xs font-medium text-slate-600">Turno
                  <select className={`${estiloEntrada} mt-1`} value={h.turno} onChange={e => alterar(i, 'turno', e.target.value)}>
                    {Object.entries(TURNOS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <div className="col-span-2 flex items-center justify-between sm:col-span-1 sm:justify-end sm:gap-3">
                  <span className="text-sm text-slate-500">{horas(duracao(h))}</span>
                  <Botao variante="fantasma" tamanho="sm" className="text-red-600 hover:bg-red-50" onClick={() => setHorarios(horarios.filter((_, j) => j !== i))} aria-label="Remover horário">Remover</Botao>
                </div>
              </div>
            ))}
          </div>
        )}
        {erroSalvar && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700" role="alert">{erroSalvar}</p>}
        <div className="mt-4 flex justify-end">
          <Botao onClick={salvar} carregando={salvando} disabled={horarios.length === 0}>Salvar agenda</Botao>
        </div>
      </Cartao>
    </>
  );
}
