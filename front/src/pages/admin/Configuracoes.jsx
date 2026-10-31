import { useEffect, useState } from 'react';
import api, { mensagemErro } from '../../api';
import { useAviso } from '../../contexto/Aviso';
import { useCarregar } from '../../utils/useCarregar';
import { Botao, Campo, Cartao, Carregando, ErroCarga, Titulo, estiloEntrada } from '../../components/ui';

function Opcao({ rotulo, descricao, checked, onChange }) {
  return (
    <label className="flex items-start gap-3 rounded-lg border border-slate-200 p-4">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
      <span><span className="block font-medium text-slate-800">{rotulo}</span><span className="text-sm text-slate-500">{descricao}</span></span>
    </label>
  );
}

export default function Configuracoes() {
  const avisar = useAviso();
  const { dados, carregando, erro, recarregar } = useCarregar(() => api.get('/configuracoes').then(r => r.data.configuracao));
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => { if (dados) setForm(dados); }, [dados]);

  const salvar = async (e) => {
    e.preventDefault();
    setSalvando(true);
    try {
      await api.put('/configuracoes', form);
      avisar('Configurações salvas.');
      recarregar();
    } catch (err) {
      avisar(mensagemErro(err), 'erro');
    } finally {
      setSalvando(false);
    }
  };

  if (carregando && !form) return <Carregando />;
  if (erro) return <ErroCarga mensagem={erro} aoTentar={recarregar} />;
  if (!form) return null;
  const muda = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  return (
    <>
      <Titulo subtitulo="Regras gerais de frequência do laboratório.">Configurações</Titulo>
      <form onSubmit={salvar} className="space-y-6">
        <Cartao titulo="Frequência">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Tolerância de atraso (minutos)" ajuda="Entradas até este tempo depois do horário planejado não contam como atraso.">
              {id => <input id={id} type="number" min="0" max="240" required className={estiloEntrada} value={form.tolerancia_atraso_minutos} onChange={muda('tolerancia_atraso_minutos')} />}
            </Campo>
            <Campo rotulo="Limite de baixa frequência (%)" ajuda="No painel, pesquisadores abaixo deste percentual do esperado até o dia aparecem em alerta.">
              {id => <input id={id} type="number" min="1" max="100" required className={estiloEntrada} value={form.percentual_frequencia_baixa} onChange={muda('percentual_frequencia_baixa')} />}
            </Campo>
          </div>
          <div className="mt-4">
            <Opcao rotulo="Banco de horas" checked={form.banco_horas_ativo} onChange={muda('banco_horas_ativo')}
              descricao="Horas excedentes ou faltantes de um mês são acumuladas no saldo do pesquisador nos meses seguintes." />
          </div>
        </Cartao>
        <Cartao titulo="Notificações">
          <div className="space-y-3">
            <Opcao rotulo="Lembretes de registro de ponto" checked={form.lembretes_ativos} onChange={muda('lembretes_ativos')}
              descricao="Avisa quem tem expediente previsto e ainda não registrou entrada, e quem esqueceu de registrar a saída." />
            <Opcao rotulo="Enviar notificações também por e-mail" checked={form.emails_ativos} onChange={muda('emails_ativos')}
              descricao="Requer servidor de e-mail (SMTP) configurado no servidor. Sem ele, as notificações ficam só no sistema." />
          </div>
        </Cartao>
        <div className="flex justify-end"><Botao type="submit" carregando={salvando}>Salvar configurações</Botao></div>
      </form>
    </>
  );
}
