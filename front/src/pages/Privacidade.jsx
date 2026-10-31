import { useState } from 'react';
import { baixarArquivo, mensagemErro } from '../api';
import { useAviso } from '../contexto/Aviso';
import { Botao, Cartao, Titulo } from '../components/ui';

// RNF07 — informações sobre o tratamento de dados (LGPD) e acesso aos próprios dados
export default function Privacidade() {
  const avisar = useAviso();
  const [baixando, setBaixando] = useState(false);

  const baixar = async () => {
    setBaixando(true);
    try {
      await baixarArquivo('/privacidade/meus-dados');
    } catch (e) {
      avisar(mensagemErro(e), 'erro');
    } finally {
      setBaixando(false);
    }
  };

  return (
    <>
      <Titulo>Privacidade e seus dados</Titulo>
      <div className="space-y-6">
        <Cartao titulo="Quais dados tratamos e por quê">
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li><strong>Cadastro:</strong> nome, e-mail, telefone, Número USP, data de ingresso, modalidade e orientador — para identificar você e definir sua carga horária.</li>
            <li><strong>Frequência:</strong> horários de entrada e saída, agenda semanal, justificativas e ajustes — para calcular e comprovar o cumprimento da carga horária exigida pela sua modalidade.</li>
            <li><strong>Segurança:</strong> data, endereço IP e navegador dos acessos e operações — para auditoria e proteção contra uso indevido.</li>
          </ul>
          <p className="mt-4 text-sm text-slate-600">
            Os dados são usados exclusivamente para a gestão da frequência do laboratório e só podem ser vistos por você,
            pela coordenação e pela administração do sistema. O telefone é armazenado criptografado.
          </p>
        </Cartao>

        <Cartao titulo="Seus direitos">
          <p className="text-sm text-slate-700">
            Pela Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você pode acessar e obter uma cópia dos seus dados,
            pedir a correção de informações incorretas e tirar dúvidas sobre o tratamento.
            Para corrigir dados cadastrais ou registros de ponto, procure a coordenação ou use as solicitações de ajuste.
          </p>
          <Botao className="mt-4" variante="secundario" carregando={baixando} onClick={baixar}>Baixar uma cópia dos meus dados</Botao>
        </Cartao>

        <Cartao titulo="Senha e acesso">
          <p className="text-sm text-slate-700">
            O acesso é feito pela Senha Única USP; este sistema não armazena a sua senha. Para criar ou redefinir a senha, acesse o{' '}
            <a className="font-medium text-sky-700 hover:underline" href="https://uspdigital.usp.br/" target="_blank" rel="noreferrer">USP Digital</a>.
          </p>
        </Cartao>
      </div>
    </>
  );
}
